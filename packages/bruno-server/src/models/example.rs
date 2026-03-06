use bson::{oid::ObjectId, Document};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::item::generate_uid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID.
    pub uid: String,
    pub name: String,
    /// UID of the parent request item.
    #[serde(rename = "requestUid")]
    pub request_uid: String,
    pub status_code: u16,
    pub headers: Document,
    pub body: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Example {
    pub fn new(
        name: String,
        request_uid: String,
        status_code: u16,
        headers: Document,
        body: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            name,
            request_uid,
            status_code,
            headers,
            body,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleResponse {
    pub uid: String,
    pub name: String,
    #[serde(rename = "requestUid")]
    pub request_uid: String,
    pub status_code: u16,
    pub headers: Document,
    pub body: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Example> for ExampleResponse {
    fn from(e: Example) -> Self {
        Self {
            uid: e.uid,
            name: e.name,
            request_uid: e.request_uid,
            status_code: e.status_code,
            headers: e.headers,
            body: e.body,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}
