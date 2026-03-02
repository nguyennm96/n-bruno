use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshToken {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    pub token_hash: String,   // bcrypt hash of the actual token
    pub expires_at: DateTime<Utc>, // MongoDB TTL index on this field
    pub created_at: DateTime<Utc>,
}

impl RefreshToken {
    pub fn new(user_id: ObjectId, token_hash: String, expires_at: DateTime<Utc>) -> Self {
        Self {
            id: None,
            user_id,
            token_hash,
            expires_at,
            created_at: Utc::now(),
        }
    }
}

/// Claims stored inside JWT access token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,   // user_id (ObjectId hex)
    pub email: String,
    pub name: String,
    pub exp: i64,      // expiry timestamp (Unix)
    pub iat: i64,      // issued at
}
