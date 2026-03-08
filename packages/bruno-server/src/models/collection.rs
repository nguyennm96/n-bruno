use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::models::item::generate_uid;
use crate::models::public_docs::PublicDocs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID.
    pub uid: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "workspaceUid")]
    pub workspace_uid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bruno_config: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<JsonValue>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    #[serde(default, with = "crate::serde_helpers::flexible_bson_datetime_optional")]
    pub deleted_at: Option<DateTime<Utc>>,
    /// Public documentation settings (if published)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_docs: Option<PublicDocs>,
}

impl Collection {
    pub fn new(name: String, description: Option<String>, workspace_uid: String) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            name,
            description,
            workspace_uid,
            bruno_config: None,
            root: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            public_docs: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub uid: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "workspaceUid")]
    pub workspace_uid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bruno_config: Option<JsonValue>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<JsonValue>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_docs: Option<PublicDocs>,
}

impl From<Collection> for CollectionResponse {
    fn from(c: Collection) -> Self {
        Self {
            uid: c.uid,
            name: c.name,
            description: c.description,
            workspace_uid: c.workspace_uid,
            bruno_config: c.bruno_config,
            root: c.root,
            created_at: c.created_at,
            updated_at: c.updated_at,
            public_docs: c.public_docs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collection_new_sets_correct_fields() {
        let c = Collection::new(
            "Test API".into(),
            Some("desc".into()),
            "ws-uid-123".into(),
        );
        assert_eq!(c.name, "Test API");
        assert_eq!(c.description, Some("desc".into()));
        assert_eq!(c.workspace_uid, "ws-uid-123");
        assert_eq!(c.uid.len(), 21);
        assert!(c.id.is_none());
        assert!(c.deleted_at.is_none());
        assert!(c.public_docs.is_none());
        assert!(c.bruno_config.is_none());
    }

    #[test]
    fn collection_new_without_description() {
        let c = Collection::new("API".into(), None, "ws".into());
        assert!(c.description.is_none());
    }

    #[test]
    fn collection_uid_is_unique() {
        let uids: std::collections::HashSet<_> = (0..50)
            .map(|_| Collection::new("X".into(), None, "ws".into()).uid)
            .collect();
        assert_eq!(uids.len(), 50, "UIDs should all be unique");
    }

    #[test]
    fn collection_response_from_preserves_fields() {
        let c = Collection::new("My Collection".into(), Some("d".into()), "ws".into());
        let uid = c.uid.clone();
        let resp = CollectionResponse::from(c);
        assert_eq!(resp.uid, uid);
        assert_eq!(resp.name, "My Collection");
        assert_eq!(resp.description, Some("d".into()));
        assert_eq!(resp.workspace_uid, "ws");
    }
}
