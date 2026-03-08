use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// An OAuth provider linked to a user account.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OauthProvider {
    pub provider: String,
    pub provider_user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(default)]
    pub oauth_providers: Vec<OauthProvider>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn new(email: String, password_hash: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            email,
            password_hash,
            name,
            avatar: None,
            oauth_providers: vec![],
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a user from an OAuth provider (no password).
    pub fn new_from_oauth(
        email: String,
        name: String,
        avatar: Option<String>,
        provider: String,
        provider_user_id: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            email,
            password_hash: String::new(), // no password for OAuth-only accounts
            name,
            avatar,
            oauth_providers: vec![OauthProvider { provider, provider_user_id }],
            created_at: now,
            updated_at: now,
        }
    }
}

/// Safe user response (no password_hash)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(u: User) -> Self {
        Self {
            id: u.id.unwrap_or_default().to_hex(),
            email: u.email,
            name: u.name,
            avatar: u.avatar,
            created_at: u.created_at,
        }
    }
}
