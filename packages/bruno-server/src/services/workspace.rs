use bson::{doc, oid::ObjectId};
use chrono::Utc;
use mongodb::{Collection, Database};

use crate::{
    errors::{AppError, AppResult},
    models::workspace::{Workspace, WorkspaceMember, WorkspaceResponse, WorkspaceRole},
};

#[derive(Clone)]
pub struct WorkspaceService {
    workspaces: Collection<Workspace>,
    members: Collection<WorkspaceMember>,
}

impl WorkspaceService {
    pub fn new(db: &Database) -> Self {
        Self {
            workspaces: db.collection("workspaces"),
            members: db.collection("workspace_members"),
        }
    }

    pub async fn create(&self, name: String, description: Option<String>, owner_id: ObjectId) -> AppResult<WorkspaceResponse> {
        let mut ws = Workspace::new(name, description, owner_id);
        let res = self.workspaces.insert_one(&ws).await.map_err(AppError::from)?;
        let ws_id = res.inserted_id.as_object_id().unwrap();
        ws.id = Some(ws_id);

        // Auto-assign creator as OWNER
        let member = WorkspaceMember::new(ws_id, owner_id, WorkspaceRole::Owner);
        self.members.insert_one(&member).await.map_err(AppError::from)?;

        Ok(WorkspaceResponse {
            id: ws_id.to_hex(),
            name: ws.name,
            description: ws.description,
            owner_id: owner_id.to_hex(),
            role: WorkspaceRole::Owner,
            created_at: ws.created_at,
            updated_at: ws.updated_at,
        })
    }

    pub async fn list_for_user(&self, user_id: ObjectId) -> AppResult<Vec<WorkspaceResponse>> {
        use futures::StreamExt;
        let mut cursor = self
            .members
            .find(doc! { "user_id": user_id })
            .await
            .map_err(AppError::from)?;

        let mut result = Vec::new();
        while let Some(Ok(member)) = cursor.next().await {
            if let Ok(Some(ws)) = self
                .workspaces
                .find_one(doc! { "_id": member.workspace_id })
                .await
            {
                result.push(WorkspaceResponse {
                    id: ws.id.unwrap_or_default().to_hex(),
                    name: ws.name,
                    description: ws.description,
                    owner_id: ws.owner_id.to_hex(),
                    role: member.role,
                    created_at: ws.created_at,
                    updated_at: ws.updated_at,
                });
            }
        }
        Ok(result)
    }

    pub async fn get_with_role(&self, workspace_id: &str, user_id: ObjectId) -> AppResult<(Workspace, WorkspaceRole)> {
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        // Use 404 even for non-members (security: don't reveal existence)
        let member = self
            .members
            .find_one(doc! { "workspace_id": ws_oid, "user_id": user_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

        let ws = self
            .workspaces
            .find_one(doc! { "_id": ws_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

        Ok((ws, member.role))
    }

    pub async fn update(&self, workspace_id: &str, user_id: ObjectId, name: Option<String>, description: Option<String>) -> AppResult<WorkspaceResponse> {
        let (ws, role) = self.get_with_role(workspace_id, user_id).await?;
        if !role.is_owner() {
            return Err(AppError::Forbidden("Only owner can update workspace".into()));
        }

        let ws_oid = ws.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_millis(now.timestamp_millis()) };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(d) = &description { update.insert("description", d); }

        self.workspaces
            .update_one(doc! { "_id": ws_oid }, doc! { "$set": update })
            .await
            .map_err(AppError::from)?;

        Ok(WorkspaceResponse {
            id: ws_oid.to_hex(),
            name: name.unwrap_or(ws.name),
            description: description.or(ws.description),
            owner_id: ws.owner_id.to_hex(),
            role,
            created_at: ws.created_at,
            updated_at: now,
        })
    }

    pub async fn delete(&self, workspace_id: &str, user_id: ObjectId) -> AppResult<()> {
        let (ws, role) = self.get_with_role(workspace_id, user_id).await?;
        if !role.is_owner() {
            return Err(AppError::Forbidden("Only owner can delete workspace".into()));
        }
        let ws_oid = ws.id.unwrap();
        self.workspaces.delete_one(doc! { "_id": ws_oid }).await.map_err(AppError::from)?;
        self.members.delete_many(doc! { "workspace_id": ws_oid }).await.map_err(AppError::from)?;
        Ok(())
    }

    pub async fn list_members(&self, workspace_id: &str, user_id: ObjectId) -> AppResult<Vec<WorkspaceMember>> {
        self.get_with_role(workspace_id, user_id).await?; // access check
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        use futures::StreamExt;
        let mut cursor = self
            .members
            .find(doc! { "workspace_id": ws_oid })
            .await
            .map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(m)) = cursor.next().await { result.push(m); }
        Ok(result)
    }

    pub async fn add_member(&self, workspace_id: &str, requester_id: ObjectId, target_user_id: ObjectId, role: WorkspaceRole) -> AppResult<()> {
        let (_, req_role) = self.get_with_role(workspace_id, requester_id).await?;
        if !req_role.can_write() {
            return Err(AppError::Forbidden("Insufficient permissions to add members".into()));
        }
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        // Check not already member
        if self.members.find_one(doc! { "workspace_id": ws_oid, "user_id": target_user_id }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict("User is already a member".into()));
        }

        let member = WorkspaceMember::new(ws_oid, target_user_id, role);
        self.members.insert_one(&member).await.map_err(AppError::from)?;
        Ok(())
    }

    pub async fn remove_member(&self, workspace_id: &str, requester_id: ObjectId, target_user_id: ObjectId) -> AppResult<()> {
        let (ws, req_role) = self.get_with_role(workspace_id, requester_id).await?;
        if !req_role.is_owner() {
            return Err(AppError::Forbidden("Only owner can remove members".into()));
        }
        if ws.owner_id == target_user_id {
            return Err(AppError::BadRequest("Cannot remove workspace owner".into()));
        }
        let ws_oid = ws.id.unwrap();
        self.members
            .delete_one(doc! { "workspace_id": ws_oid, "user_id": target_user_id })
            .await
            .map_err(AppError::from)?;
        Ok(())
    }
}
