use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Password reset token stored in MongoDB.
/// The raw 6-digit OTP is never persisted — only its SHA-256 hex digest.
/// A TTL index on `expires_at` automatically purges expired documents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordResetToken {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    /// SHA-256 hex digest of the 6-digit OTP
    pub otp_hash: String,
    /// Token expires 15 minutes after creation
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub expires_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

impl PasswordResetToken {
    pub fn new(user_id: ObjectId, otp_hash: String) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            user_id,
            otp_hash,
            expires_at: now + chrono::Duration::minutes(15),
            created_at: now,
        }
    }
}
