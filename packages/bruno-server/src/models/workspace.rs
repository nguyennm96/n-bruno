use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::item::generate_uid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceRole {
    Owner,
    Editor,
    Viewer,
}

impl WorkspaceRole {
    pub fn can_write(&self) -> bool {
        matches!(self, WorkspaceRole::Owner | WorkspaceRole::Editor)
    }
    pub fn is_owner(&self) -> bool {
        matches!(self, WorkspaceRole::Owner)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID.
    pub uid: String,
    pub name: String,
    pub description: Option<String>,
    /// Internal reference to the owner user (MongoDB ObjectId — auth layer).
    pub owner_id: ObjectId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Workspace {
    pub fn new(name: String, description: Option<String>, owner_id: ObjectId) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            name,
            description,
            owner_id,
            created_at: now,
            updated_at: now,
        }
    }
}

/// Internal membership record — uses ObjectId for MongoDB joins with users/workspaces.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMember {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub user_id: ObjectId,
    pub role: WorkspaceRole,
    pub joined_at: DateTime<Utc>,
}

impl WorkspaceMember {
    pub fn new(workspace_id: ObjectId, user_id: ObjectId, role: WorkspaceRole) -> Self {
        Self {
            id: None,
            workspace_id,
            user_id,
            role,
            joined_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceResponse {
    pub uid: String,
    pub name: String,
    pub description: Option<String>,
    /// Owner's hex ObjectId (users do not have a nanoid uid yet).
    #[serde(rename = "ownerUid")]
    pub owner_uid: String,
    pub role: WorkspaceRole,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
