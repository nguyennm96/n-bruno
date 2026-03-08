use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::workspace::WorkspaceRole;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InviteStatus {
    Pending,
    Accepted,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInvite {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    /// Email address of the invitee (may not have a Bruno account yet).
    pub email: String,
    pub role: WorkspaceRole,
    /// SHA-256 hex digest of the raw token. Never expose this over the wire.
    pub token_hash: String,
    /// Who sent the invite.
    pub invited_by: ObjectId,
    /// UTC expiry — also used as MongoDB TTL field.
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub expires_at: DateTime<Utc>,
    #[serde(default, with = "crate::serde_helpers::flexible_bson_datetime_optional")]
    pub accepted_at: Option<DateTime<Utc>>,
    pub status: InviteStatus,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

impl WorkspaceInvite {
    pub fn new(
        workspace_id: ObjectId,
        email: String,
        role: WorkspaceRole,
        token_hash: String,
        invited_by: ObjectId,
        expires_days: i64,
    ) -> Self {
        let now = Utc::now();
        let expires_at = now + chrono::Duration::days(expires_days);
        Self {
            id: None,
            workspace_id,
            email,
            role,
            token_hash,
            invited_by,
            expires_at,
            accepted_at: None,
            status: InviteStatus::Pending,
            created_at: now,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn is_usable(&self) -> bool {
        self.status == InviteStatus::Pending && !self.is_expired()
    }
}

/// Public-safe DTO for listing pending invites.
#[derive(Debug, Serialize)]
pub struct InviteResponse {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub email: String,
    pub role: WorkspaceRole,
    #[serde(rename = "invitedBy")]
    pub invited_by: String,
    pub status: InviteStatus,
    #[serde(rename = "expiresAt")]
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub expires_at: DateTime<Utc>,
    #[serde(rename = "createdAt")]
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

impl From<WorkspaceInvite> for InviteResponse {
    fn from(i: WorkspaceInvite) -> Self {
        Self {
            id: i.id.unwrap_or_default().to_hex(),
            workspace_id: i.workspace_id.to_hex(),
            email: i.email,
            role: i.role,
            invited_by: i.invited_by.to_hex(),
            status: i.status,
            expires_at: i.expires_at,
            created_at: i.created_at,
        }
    }
}

/// Returned when validating a token before accepting (public endpoint, no auth).
#[derive(Debug, Serialize)]
pub struct InviteValidationResponse {
    pub valid: bool,
    pub email: Option<String>,
    pub role: Option<WorkspaceRole>,
    #[serde(rename = "workspaceName")]
    pub workspace_name: Option<String>,
    #[serde(rename = "workspaceUid")]
    pub workspace_uid: Option<String>,
    #[serde(rename = "invitedByName")]
    pub invited_by_name: Option<String>,
    #[serde(rename = "invitedByEmail")]
    pub invited_by_email: Option<String>,
}
