use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::{
    config::Config,
    errors::{AppError, AppResult},
    models::{
        invite::{InviteResponse, InviteValidationResponse, WorkspaceInvite},
        user::User,
        workspace::{Workspace, WorkspaceMember, WorkspaceRole},
    },
    services::mailer::MailerService,
};

const INVITE_EXPIRES_DAYS: i64 = 7;

#[derive(Clone)]
pub struct InviteService {
    invites: Collection<WorkspaceInvite>,
    workspaces: Collection<Workspace>,
    members: Collection<WorkspaceMember>,
    users: Collection<User>,
    mailer: MailerService,
    app_url: String,
}

impl InviteService {
    pub fn new(db: &Database, config: &Config, mailer: MailerService) -> Self {
        Self {
            invites: db.collection("workspace_invites"),
            workspaces: db.collection("workspaces"),
            members: db.collection("workspace_members"),
            users: db.collection("users"),
            mailer,
            app_url: config.app_url.clone(),
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn generate_token() -> (String, String) {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let raw = hex::encode(bytes);
        let hash = format!("{:x}", Sha256::digest(raw.as_bytes()));
        (raw, hash)
    }

    fn hash_token(raw: &str) -> String {
        format!("{:x}", Sha256::digest(raw.as_bytes()))
    }

    fn render_invite_email(
        inviter_name: &str,
        inviter_email: &str,
        workspace_name: &str,
        role: &WorkspaceRole,
        accept_url: &str,
    ) -> String {
        let template = include_str!("../templates/invite_email.html");
        let (role_class, role_label) = match role {
            WorkspaceRole::Editor => ("editor", "Editor"),
            WorkspaceRole::Viewer => ("viewer", "Viewer"),
            WorkspaceRole::Owner => ("editor", "Editor"), // Owner invites can never grant Owner
        };
        template
            .replace("{inviter_name}", inviter_name)
            .replace("{inviter_email}", inviter_email)
            .replace("{workspace_name}", workspace_name)
            .replace("{role_class}", role_class)
            .replace("{role_label}", role_label)
            .replace("{accept_url}", accept_url)
    }

    async fn require_workspace(&self, workspace_uid: &str) -> AppResult<Workspace> {
        self.workspaces
            .find_one(doc! { "uid": workspace_uid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))
    }

    async fn require_owner(&self, workspace_id: ObjectId, requester_id: ObjectId) -> AppResult<()> {
        let m = self.members
            .find_one(doc! { "workspace_id": workspace_id, "user_id": requester_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::Forbidden("Not a member of this workspace".into()))?;
        if !m.role.is_owner() {
            return Err(AppError::Forbidden("Only owner can manage invites".into()));
        }
        Ok(())
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Send an invite email. If a pending invite for this email already exists,
    /// refresh its expiry and resend. Returns the raw token (to embed in URL).
    pub async fn create_invite(
        &self,
        workspace_uid: &str,
        email: String,
        role: WorkspaceRole,
        requester_id: ObjectId,
    ) -> AppResult<InviteResponse> {
        // Role guard — Owner only
        let ws = self.require_workspace(workspace_uid).await?;
        let ws_oid = ws.id.ok_or_else(|| AppError::Internal("Workspace missing _id".into()))?;
        self.require_owner(ws_oid, requester_id).await?;

        // Cannot invite with Owner role
        if role.is_owner() {
            return Err(AppError::BadRequest("Cannot invite with Owner role".into()));
        }

        // Check if email is already a member
        let existing_user = self.users.find_one(doc! { "email": &email }).await.map_err(AppError::from)?;
        if let Some(ref u) = existing_user {
            let uid = u.id.unwrap();
            if self.members.find_one(doc! { "workspace_id": ws_oid, "user_id": uid }).await.map_err(AppError::from)?.is_some() {
                return Err(AppError::Conflict("User is already a member of this workspace".into()));
            }
        }

        // Upsert: if pending invite exists for this email → refresh it
        let (raw_token, token_hash) = Self::generate_token();
        let now = Utc::now();
        let expires_at = now + chrono::Duration::days(INVITE_EXPIRES_DAYS);

        let existing_invite = self.invites
            .find_one(doc! { "workspace_id": ws_oid, "email": &email, "status": "pending" })
            .await
            .map_err(AppError::from)?;

        let invite = if let Some(mut inv) = existing_invite {
            // Refresh token + expiry
            let inv_oid = inv.id.unwrap();
            self.invites.update_one(
                doc! { "_id": inv_oid },
                doc! { "$set": {
                    "token_hash": &token_hash,
                    "expires_at": bson::DateTime::from_millis(expires_at.timestamp_millis()),
                    "invited_by": requester_id,
                }},
            ).await.map_err(AppError::from)?;
            inv.token_hash = token_hash;
            inv.expires_at = expires_at;
            inv.invited_by = requester_id;
            inv
        } else {
            let inv = WorkspaceInvite::new(ws_oid, email.clone(), role, token_hash, requester_id, INVITE_EXPIRES_DAYS);
            let res = self.invites.insert_one(&inv).await.map_err(AppError::from)?;
            let mut inv = inv;
            inv.id = Some(res.inserted_id.as_object_id().unwrap());
            inv
        };

        // Fetch inviter info for email body
        let inviter = self.users
            .find_one(doc! { "_id": requester_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::Internal("Requester not found".into()))?;

        let accept_url = format!("{}/invite/accept?token={}", self.app_url, raw_token);
        let html = Self::render_invite_email(&inviter.name, &inviter.email, &ws.name, &invite.role, &accept_url);
        let subject = format!("You're invited to join \"{}\" on Bruno", ws.name);

        self.mailer.send_email(&email, &subject, &html).await?;

        Ok(InviteResponse::from(invite))
    }

    /// Validate a raw token without consuming it (public endpoint).
    pub async fn validate_token(&self, raw_token: &str) -> AppResult<InviteValidationResponse> {
        let hash = Self::hash_token(raw_token);
        let invite = self.invites
            .find_one(doc! { "token_hash": &hash })
            .await
            .map_err(AppError::from)?;

        let Some(invite) = invite else {
            return Ok(InviteValidationResponse { valid: false, email: None, role: None, workspace_name: None, workspace_uid: None, invited_by_name: None, invited_by_email: None });
        };

        if !invite.is_usable() {
            return Ok(InviteValidationResponse { valid: false, email: None, role: None, workspace_name: None, workspace_uid: None, invited_by_name: None, invited_by_email: None });
        }

        let ws = self.workspaces.find_one(doc! { "_id": invite.workspace_id }).await.map_err(AppError::from)?;
        let inviter = self.users.find_one(doc! { "_id": invite.invited_by }).await.map_err(AppError::from)?;

        Ok(InviteValidationResponse {
            valid: true,
            email: Some(invite.email),
            role: Some(invite.role),
            workspace_name: ws.as_ref().map(|w| w.name.clone()),
            workspace_uid: ws.map(|w| w.uid),
            invited_by_name: inviter.as_ref().map(|u| u.name.clone()),
            invited_by_email: inviter.map(|u| u.email),
        })
    }

    /// Accept an invite. Adds the authenticated user as a workspace member.
    pub async fn accept_invite(&self, raw_token: &str, user_id: ObjectId) -> AppResult<String> {
        let hash = Self::hash_token(raw_token);
        let invite = self.invites
            .find_one(doc! { "token_hash": &hash })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Invite not found or already used".into()))?;

        if !invite.is_usable() {
            return Err(AppError::BadRequest("Invite has expired or been revoked".into()));
        }

        // Verify the accepting user's email matches the invite
        let user = self.users.find_one(doc! { "_id": user_id }).await.map_err(AppError::from)?
            .ok_or_else(|| AppError::Unauthorized("User not found".into()))?;
        if user.email.to_lowercase() != invite.email.to_lowercase() {
            return Err(AppError::Forbidden("This invite was sent to a different email address".into()));
        }

        // Guard: already a member?
        if self.members.find_one(doc! { "workspace_id": invite.workspace_id, "user_id": user_id }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict("You are already a member of this workspace".into()));
        }

        // Add member
        let member = WorkspaceMember::new(invite.workspace_id, user_id, invite.role.clone());
        self.members.insert_one(&member).await.map_err(AppError::from)?;

        // Mark invite as accepted
        let inv_oid = invite.id.unwrap();
        let now = Utc::now();
        self.invites.update_one(
            doc! { "_id": inv_oid },
            doc! { "$set": { "status": "accepted", "accepted_at": bson::DateTime::from_millis(now.timestamp_millis()) }},
        ).await.map_err(AppError::from)?;

        // Return workspace uid for redirect
        let ws = self.workspaces.find_one(doc! { "_id": invite.workspace_id }).await.map_err(AppError::from)?
            .ok_or_else(|| AppError::Internal("Workspace no longer exists".into()))?;
        Ok(ws.uid)
    }

    /// List all pending invites for a workspace (Owner only).
    pub async fn list_pending(&self, workspace_uid: &str, requester_id: ObjectId) -> AppResult<Vec<InviteResponse>> {
        let ws = self.require_workspace(workspace_uid).await?;
        let ws_oid = ws.id.unwrap();
        self.require_owner(ws_oid, requester_id).await?;

        let mut cursor = self.invites
            .find(doc! { "workspace_id": ws_oid, "status": "pending" })
            .await
            .map_err(AppError::from)?;

        let mut result = Vec::new();
        while let Some(Ok(inv)) = cursor.next().await {
            result.push(InviteResponse::from(inv));
        }
        Ok(result)
    }

    /// Cancel (revoke) a pending invite by its ObjectId (Owner only).
    pub async fn revoke_invite(&self, workspace_uid: &str, invite_id: &str, requester_id: ObjectId) -> AppResult<()> {
        let ws = self.require_workspace(workspace_uid).await?;
        let ws_oid = ws.id.unwrap();
        self.require_owner(ws_oid, requester_id).await?;

        let inv_oid = ObjectId::parse_str(invite_id)
            .map_err(|_| AppError::BadRequest("Invalid invite ID".into()))?;

        let result = self.invites.update_one(
            doc! { "_id": inv_oid, "workspace_id": ws_oid, "status": "pending" },
            doc! { "$set": { "status": "revoked" } },
        ).await.map_err(AppError::from)?;

        if result.matched_count == 0 {
            return Err(AppError::NotFound("Invite not found".into()));
        }
        Ok(())
    }
}
