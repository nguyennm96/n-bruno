use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use serde_json::{json, Value};

use crate::{
    errors::{AppError, AppResult},
    models::{
        user::User,
        workspace::{Workspace, WorkspaceMember, WorkspaceResponse, WorkspaceRole},
    },
    services::invite::InviteService,
};

#[derive(Clone)]
pub struct WorkspaceService {
    workspaces: Collection<Workspace>,
    members: Collection<WorkspaceMember>,
    users: Collection<User>,
}

impl WorkspaceService {
    pub fn new(db: &Database) -> Self {
        Self {
            workspaces: db.collection("workspaces"),
            members: db.collection("workspace_members"),
            users: db.collection("users"),
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    pub async fn find_by_uid(&self, workspace_uid: &str) -> AppResult<Workspace> {
        self.workspaces
            .find_one(doc! { "uid": workspace_uid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))
    }

    async fn find_member(&self, workspace_id: ObjectId, user_id: ObjectId) -> AppResult<Option<WorkspaceMember>> {
        self.members
            .find_one(doc! { "workspace_id": workspace_id, "user_id": user_id })
            .await
            .map_err(AppError::from)
    }

    // ── Public API ────────────────────────────────────────────────────────────

    pub async fn create(&self, name: String, description: Option<String>, owner_id: ObjectId) -> AppResult<WorkspaceResponse> {
        let mut ws = Workspace::new(name, description, owner_id);
        let res = self.workspaces.insert_one(&ws).await.map_err(AppError::from)?;
        let ws_id = res.inserted_id.as_object_id().unwrap();
        ws.id = Some(ws_id);

        let member = WorkspaceMember::new(ws_id, owner_id, WorkspaceRole::Owner);
        self.members.insert_one(&member).await.map_err(AppError::from)?;

        Ok(WorkspaceResponse {
            uid: ws.uid,
            name: ws.name,
            description: ws.description,
            owner_uid: owner_id.to_hex(),
            role: WorkspaceRole::Owner,
            created_at: ws.created_at,
            updated_at: ws.updated_at,
        })
    }

    pub async fn list_for_user(&self, user_id: ObjectId) -> AppResult<Vec<WorkspaceResponse>> {
        let mut cursor = self.members.find(doc! { "user_id": user_id }).await.map_err(AppError::from)?;

        let mut result = Vec::new();
        while let Some(Ok(member)) = cursor.next().await {
            if let Ok(Some(ws)) = self.workspaces.find_one(doc! { "_id": member.workspace_id }).await {
                result.push(WorkspaceResponse {
                    uid: ws.uid,
                    name: ws.name,
                    description: ws.description,
                    owner_uid: ws.owner_id.to_hex(),
                    role: member.role,
                    created_at: ws.created_at,
                    updated_at: ws.updated_at,
                });
            }
        }
        Ok(result)
    }

    pub async fn get_with_role(&self, workspace_uid: &str, user_id: ObjectId) -> AppResult<(Workspace, WorkspaceRole)> {
        let ws = self.find_by_uid(workspace_uid).await?;
        let ws_oid = ws.id.ok_or_else(|| AppError::Internal("Workspace has no _id".into()))?;
        let member = self.find_member(ws_oid, user_id).await?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;
        Ok((ws, member.role))
    }

    pub async fn update(&self, workspace_uid: &str, user_id: ObjectId, name: Option<String>, description: Option<String>) -> AppResult<WorkspaceResponse> {
        let (ws, role) = self.get_with_role(workspace_uid, user_id).await?;
        if !role.is_owner() {
            return Err(AppError::Forbidden("Only owner can update workspace".into()));
        }

        let ws_oid = ws.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_millis(now.timestamp_millis()) };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(d) = &description { update.insert("description", d); }

        self.workspaces.update_one(doc! { "_id": ws_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;

        Ok(WorkspaceResponse {
            uid: ws.uid,
            name: name.unwrap_or(ws.name),
            description: description.or(ws.description),
            owner_uid: ws.owner_id.to_hex(),
            role,
            created_at: ws.created_at,
            updated_at: now,
        })
    }

    pub async fn delete(&self, workspace_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let (ws, role) = self.get_with_role(workspace_uid, user_id).await?;
        if !role.is_owner() {
            return Err(AppError::Forbidden("Only owner can delete workspace".into()));
        }
        let ws_oid = ws.id.unwrap();
        self.workspaces.delete_one(doc! { "_id": ws_oid }).await.map_err(AppError::from)?;
        self.members.delete_many(doc! { "workspace_id": ws_oid }).await.map_err(AppError::from)?;
        Ok(())
    }

    /// List members with user info (name + email) joined from `users` collection.
    pub async fn list_members_with_info(&self, workspace_uid: &str, requester_id: ObjectId) -> AppResult<Vec<Value>> {
        let (ws, _) = self.get_with_role(workspace_uid, requester_id).await?;
        let ws_oid = ws.id.unwrap();

        let mut cursor = self.members.find(doc! { "workspace_id": ws_oid }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(m)) = cursor.next().await {
            let user = self.users.find_one(doc! { "_id": m.user_id }).await.map_err(AppError::from)?;
            result.push(json!({
                "userId": m.user_id.to_hex(),
                "role": m.role,
                "joinedAt": m.joined_at,
                "user": user.map(|u| json!({
                    "id": u.id.unwrap_or_default().to_hex(),
                    "name": u.name,
                    "email": u.email,
                })),
            }));
        }
        Ok(result)
    }

    /// Add member by email. If user exists → add directly; otherwise → send invite via InviteService.
    pub async fn add_member_by_email(
        &self,
        workspace_uid: &str,
        requester_id: ObjectId,
        email: String,
        role: WorkspaceRole,
        invite_service: &InviteService,
    ) -> AppResult<Value> {
        let (ws, req_role) = self.get_with_role(workspace_uid, requester_id).await?;
        if !req_role.is_owner() {
            return Err(AppError::Forbidden("Only owner can add members".into()));
        }
        if role.is_owner() {
            return Err(AppError::BadRequest("Cannot assign Owner role directly".into()));
        }

        let ws_oid = ws.id.unwrap();

        // Check if user with this email exists
        if let Some(user) = self.users.find_one(doc! { "email": &email }).await.map_err(AppError::from)? {
            let target_id = user.id.unwrap();
            // Already a member?
            if self.find_member(ws_oid, target_id).await?.is_some() {
                return Err(AppError::Conflict("User is already a member of this workspace".into()));
            }
            // Add directly
            let member = WorkspaceMember::new(ws_oid, target_id, role.clone());
            self.members.insert_one(&member).await.map_err(AppError::from)?;
            return Ok(json!({
                "action": "added",
                "member": {
                    "userId": target_id.to_hex(),
                    "role": role,
                    "user": { "id": target_id.to_hex(), "name": user.name, "email": user.email }
                }
            }));
        }

        // User doesn't exist — send invite
        let invite = invite_service.create_invite(workspace_uid, email, role, requester_id).await?;
        Ok(json!({ "action": "invited", "invite": invite }))
    }

    /// Remove member by user ObjectId hex (Owner only). Prevents removing the last owner.
    pub async fn remove_member(&self, workspace_uid: &str, requester_id: ObjectId, target_user_id: &str) -> AppResult<()> {
        let (ws, req_role) = self.get_with_role(workspace_uid, requester_id).await?;
        if !req_role.is_owner() {
            return Err(AppError::Forbidden("Only owner can remove members".into()));
        }
        let target_oid = ObjectId::parse_str(target_user_id)
            .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
        if target_oid == requester_id {
            return Err(AppError::BadRequest("Owner cannot remove themselves — use leave or transfer ownership first".into()));
        }
        let ws_oid = ws.id.unwrap();
        self.members.delete_one(doc! { "workspace_id": ws_oid, "user_id": target_oid }).await.map_err(AppError::from)?;
        Ok(())
    }

    /// Update a member's role (Owner only). Cannot change own role or grant Owner.
    pub async fn update_member_role(&self, workspace_uid: &str, requester_id: ObjectId, target_user_id: &str, new_role: WorkspaceRole) -> AppResult<()> {
        let (ws, req_role) = self.get_with_role(workspace_uid, requester_id).await?;
        if !req_role.is_owner() {
            return Err(AppError::Forbidden("Only owner can change member roles".into()));
        }
        if new_role.is_owner() {
            return Err(AppError::BadRequest("Use transfer-ownership to assign the Owner role".into()));
        }
        let target_oid = ObjectId::parse_str(target_user_id)
            .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
        if target_oid == requester_id {
            return Err(AppError::BadRequest("Cannot change your own role".into()));
        }
        let ws_oid = ws.id.unwrap();
        let result = self.members.update_one(
            doc! { "workspace_id": ws_oid, "user_id": target_oid },
            doc! { "$set": { "role": bson::to_bson(&new_role).unwrap() } },
        ).await.map_err(AppError::from)?;
        if result.matched_count == 0 {
            return Err(AppError::NotFound("Member not found".into()));
        }
        Ok(())
    }

    /// Leave a workspace (Editor/Viewer only — Owner must transfer first).
    pub async fn leave_workspace(&self, workspace_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let (ws, role) = self.get_with_role(workspace_uid, user_id).await?;
        if role.is_owner() {
            return Err(AppError::BadRequest("Owner cannot leave — transfer ownership first or delete the workspace".into()));
        }
        let ws_oid = ws.id.unwrap();
        self.members.delete_one(doc! { "workspace_id": ws_oid, "user_id": user_id }).await.map_err(AppError::from)?;
        Ok(())
    }

    /// Transfer ownership to another member. Requester becomes Editor; target becomes Owner.
    pub async fn transfer_ownership(&self, workspace_uid: &str, requester_id: ObjectId, target_user_id: &str) -> AppResult<()> {
        let (ws, req_role) = self.get_with_role(workspace_uid, requester_id).await?;
        if !req_role.is_owner() {
            return Err(AppError::Forbidden("Only owner can transfer ownership".into()));
        }
        let target_oid = ObjectId::parse_str(target_user_id)
            .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
        if target_oid == requester_id {
            return Err(AppError::BadRequest("Cannot transfer ownership to yourself".into()));
        }
        let ws_oid = ws.id.unwrap();

        // Ensure target is a member
        if self.find_member(ws_oid, target_oid).await?.is_none() {
            return Err(AppError::NotFound("Target user is not a member of this workspace".into()));
        }

        // Demote current owner → Editor
        self.members.update_one(
            doc! { "workspace_id": ws_oid, "user_id": requester_id },
            doc! { "$set": { "role": "editor" } },
        ).await.map_err(AppError::from)?;

        // Promote target → Owner
        self.members.update_one(
            doc! { "workspace_id": ws_oid, "user_id": target_oid },
            doc! { "$set": { "role": "owner" } },
        ).await.map_err(AppError::from)?;

        // Update workspace.owner_id
        self.workspaces.update_one(
            doc! { "_id": ws_oid },
            doc! { "$set": { "owner_id": target_oid, "updated_at": bson::DateTime::from_millis(Utc::now().timestamp_millis()) } },
        ).await.map_err(AppError::from)?;

        Ok(())
    }
}

