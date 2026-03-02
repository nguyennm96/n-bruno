use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: Option<String>,
    pub workspace_id: ObjectId,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Collection {
    pub fn new(name: String, description: Option<String>, workspace_id: ObjectId) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            name,
            description,
            workspace_id,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub workspace_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Collection> for CollectionResponse {
    fn from(c: Collection) -> Self {
        Self {
            id: c.id.unwrap_or_default().to_hex(),
            name: c.name,
            description: c.description,
            workspace_id: c.workspace_id.to_hex(),
            created_at: c.created_at,
            updated_at: c.updated_at,
        }
    }
}
