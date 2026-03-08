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
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
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
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
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
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_can_write_and_is_owner() {
        assert!(WorkspaceRole::Owner.can_write());
        assert!(WorkspaceRole::Owner.is_owner());
    }

    #[test]
    fn editor_can_write_but_not_owner() {
        assert!(WorkspaceRole::Editor.can_write());
        assert!(!WorkspaceRole::Editor.is_owner());
    }

    #[test]
    fn viewer_cannot_write_and_not_owner() {
        assert!(!WorkspaceRole::Viewer.can_write());
        assert!(!WorkspaceRole::Viewer.is_owner());
    }

    #[test]
    fn workspace_new_has_correct_fields() {
        use bson::oid::ObjectId;
        let owner = ObjectId::new();
        let ws = Workspace::new("My Workspace".into(), Some("desc".into()), owner);
        assert_eq!(ws.name, "My Workspace");
        assert_eq!(ws.description, Some("desc".into()));
        assert_eq!(ws.owner_id, owner);
        assert!(ws.id.is_none());
        assert_eq!(ws.uid.len(), 21);
    }

    #[test]
    fn workspace_new_without_description() {
        use bson::oid::ObjectId;
        let ws = Workspace::new("No Desc".into(), None, ObjectId::new());
        assert!(ws.description.is_none());
    }

    #[test]
    fn workspace_member_new_sets_correct_fields() {
        use bson::oid::ObjectId;
        let ws_id = ObjectId::new();
        let user_id = ObjectId::new();
        let m = WorkspaceMember::new(ws_id, user_id, WorkspaceRole::Editor);
        assert_eq!(m.workspace_id, ws_id);
        assert_eq!(m.user_id, user_id);
        assert!(matches!(m.role, WorkspaceRole::Editor));
        assert!(m.id.is_none());
    }
}
