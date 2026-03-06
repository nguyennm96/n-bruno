use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::models::item::generate_uid;

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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
        }
    }
}
