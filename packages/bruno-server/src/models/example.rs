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
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    #[serde(default, with = "crate::serde_helpers::flexible_bson_datetime_optional")]
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

/// Lightweight summary returned by list endpoints — excludes `body` and
/// `requestSnapshot` so bulk responses stay small for large collections.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleSummary {
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
    #[serde(rename = "responseTime", skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i64>,
    #[serde(rename = "responseSize", skip_serializing_if = "Option::is_none")]
    pub response_size: Option<i64>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

impl From<Example> for ExampleSummary {
    fn from(e: Example) -> Self {
        Self {
            uid: e.uid,
            name: e.name,
            description: e.description,
            request_uid: e.request_uid,
            status_code: e.status_code,
            status_text: e.status_text,
            headers: e.headers,
            response_time: e.response_time,
            response_size: e.response_size,
            created_at: e.created_at,
            updated_at: e.updated_at,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(rename = "requestSnapshot", skip_serializing_if = "Option::is_none")]
    pub request_snapshot: Option<Value>,
    #[serde(rename = "responseTime", skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i64>,
    #[serde(rename = "responseSize", skip_serializing_if = "Option::is_none")]
    pub response_size: Option<i64>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
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

#[cfg(test)]
mod tests {
    use super::*;
    use bson::doc;

    fn make_example(uid: Option<String>) -> Example {
        Example::new(
            uid,
            "200 OK".into(),
            Some("Success response".into()),
            "req-uid-001".into(),
            200,
            Some("OK".into()),
            doc! { "Content-Type": "application/json" },
            Some(r#"{"ok": true}"#.into()),
            None,
            Some(120),
            Some(42),
        )
    }

    #[test]
    fn example_new_with_custom_uid() {
        let e = make_example(Some("my-custom-uid-xx".into()));
        assert_eq!(e.uid, "my-custom-uid-xx");
        assert_eq!(e.name, "200 OK");
        assert_eq!(e.status_code, 200);
        assert_eq!(e.request_uid, "req-uid-001");
        assert!(e.id.is_none());
        assert!(e.deleted_at.is_none());
    }

    #[test]
    fn example_new_without_uid_generates_uid() {
        let e = make_example(None);
        assert_eq!(e.uid.len(), 21, "auto-generated uid should be 21 chars");
    }

    #[test]
    fn example_uid_is_unique_when_auto_generated() {
        let uids: std::collections::HashSet<_> =
            (0..50).map(|_| make_example(None).uid).collect();
        assert_eq!(uids.len(), 50);
    }

    #[test]
    fn example_summary_from_excludes_body_and_snapshot() {
        let e = make_example(None);
        let summary = ExampleSummary::from(e.clone());
        assert_eq!(summary.uid, e.uid);
        assert_eq!(summary.name, e.name);
        assert_eq!(summary.status_code, e.status_code);
        assert_eq!(summary.request_uid, e.request_uid);
        assert_eq!(summary.response_time, e.response_time);
        assert_eq!(summary.response_size, e.response_size);
        // ExampleSummary does NOT have body/request_snapshot fields
    }

    #[test]
    fn example_response_from_includes_body() {
        let e = make_example(None);
        let resp = ExampleResponse::from(e.clone());
        assert_eq!(resp.uid, e.uid);
        assert_eq!(resp.body, e.body);
        assert_eq!(resp.request_snapshot, e.request_snapshot);
        assert_eq!(resp.status_text, e.status_text);
    }
}
