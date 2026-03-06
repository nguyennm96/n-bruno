use bson::{oid::ObjectId, Document};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::item::generate_uid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID (client-provided or server-generated).
    pub uid: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// UID of the parent request item.
    #[serde(rename = "requestUid")]
    pub request_uid: String,
    pub status_code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_text: Option<String>,
    pub headers: Document,
    pub body: Option<String>,
    /// Full request snapshot (url, method, headers, params, body).
    #[serde(rename = "requestSnapshot", skip_serializing_if = "Option::is_none")]
    pub request_snapshot: Option<Value>,
    #[serde(rename = "responseTime", skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i64>,
    #[serde(rename = "responseSize", skip_serializing_if = "Option::is_none")]
    pub response_size: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Example {
    pub fn new(
        uid: Option<String>,
        name: String,
        description: Option<String>,
        request_uid: String,
        status_code: u16,
        status_text: Option<String>,
        headers: Document,
        body: Option<String>,
        request_snapshot: Option<Value>,
        response_time: Option<i64>,
        response_size: Option<i64>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: uid.unwrap_or_else(generate_uid),
            name,
            description,
            request_uid,
            status_code,
            status_text,
            headers,
            body,
            request_snapshot,
            response_time,
            response_size,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "requestUid")]
    pub request_uid: String,
    pub status_code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_text: Option<String>,
    pub headers: Document,
    pub body: Option<String>,
    #[serde(rename = "requestSnapshot", skip_serializing_if = "Option::is_none")]
    pub request_snapshot: Option<Value>,
    #[serde(rename = "responseTime", skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i64>,
    #[serde(rename = "responseSize", skip_serializing_if = "Option::is_none")]
    pub response_size: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Example> for ExampleResponse {
    fn from(e: Example) -> Self {
        Self {
            uid: e.uid,
            name: e.name,
            description: e.description,
            request_uid: e.request_uid,
            status_code: e.status_code,
            status_text: e.status_text,
            headers: e.headers,
            body: e.body,
            request_snapshot: e.request_snapshot,
            response_time: e.response_time,
            response_size: e.response_size,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}
