use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A one-time code issued after a successful OAuth callback.
/// Electron app exchanges this code for JWT tokens.
/// MongoDB TTL index on `expires_at` auto-deletes expired documents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OauthCode {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub code: String,
    pub user_id: ObjectId,
    pub provider: String,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub expires_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

impl OauthCode {
    pub fn new(code: String, user_id: ObjectId, provider: String) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            code,
            user_id,
            provider,
            expires_at: now + chrono::Duration::minutes(5),
            created_at: now,
        }
    }
}
