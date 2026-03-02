use bson::{oid::ObjectId, Document};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub item_id: ObjectId,
    pub status_code: u16,
    pub headers: Document,
    pub body: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Example {
    pub fn new(
        name: String,
        item_id: ObjectId,
        status_code: u16,
        headers: Document,
        body: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            name,
            item_id,
            status_code,
            headers,
            body,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleResponse {
    pub id: String,
    pub name: String,
    pub item_id: String,
    pub status_code: u16,
    pub headers: Document,
    pub body: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Example> for ExampleResponse {
    fn from(e: Example) -> Self {
        Self {
            id: e.id.unwrap_or_default().to_hex(),
            name: e.name,
            item_id: e.item_id.to_hex(),
            status_code: e.status_code,
            headers: e.headers,
            body: e.body,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}
