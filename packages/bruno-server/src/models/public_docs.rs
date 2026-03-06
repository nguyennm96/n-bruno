use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicDocs {
    /// Is public documentation enabled?
    pub enabled: bool,
    /// Unique slug (e.g., "my-api-v2")
    pub slug: String,
    /// When the docs were first published
    pub published_at: DateTime<Utc>,
    /// Permissions/visibility settings
    pub visibility: DocVisibility,
    /// Customization settings
    pub settings: DocSettings,
    /// Optional analytics data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analytics: Option<DocAnalytics>,
}

impl PublicDocs {
    pub fn new(slug: String, visibility: DocVisibility, settings: DocSettings) -> Self {
        Self {
            enabled: true,
            slug,
            published_at: Utc::now(),
            visibility,
            settings,
            analytics: Some(DocAnalytics::default()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DocVisibility {
    /// Anyone with the link can view
    Public,
    /// Password-protected access
    Password {
        /// bcrypt/argon2 hash of the password
        hash: String,
    },
    /// Only workspace members can view
    WorkspaceMembers,
    /// Specific list of users
    CustomList {
        /// List of user UIDs
        user_ids: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSettings {
    /// Show example requests/responses
    #[serde(default = "default_true")]
    pub show_examples: bool,
    /// Show authentication details
    #[serde(default = "default_true")]
    pub show_auth: bool,
    /// Custom CSS for branding
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_css: Option<String>,
    /// Custom logo URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_logo_url: Option<String>,
}

impl Default for DocSettings {
    fn default() -> Self {
        Self {
            show_examples: true,
            show_auth: true,
            custom_css: None,
            custom_logo_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocAnalytics {
    /// Total number of views
    #[serde(default)]
    pub views: i32,
    /// Unique visitors (tracked by IP hash)
    #[serde(default)]
    pub unique_visitors: i32,
    /// Last time the docs were viewed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_viewed: Option<DateTime<Utc>>,
}

fn default_true() -> bool {
    true
}

// DTOs for API requests/responses

#[derive(Debug, Deserialize)]
pub struct PublishDocsRequest {
    pub visibility: DocVisibility,
    #[serde(default)]
    pub settings: DocSettings,
    pub custom_slug: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PublishDocsResponse {
    pub slug: String,
    pub public_url: String,
    pub published_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocsRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<DocVisibility>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings: Option<DocSettings>,
}

#[derive(Debug, Serialize)]
pub struct DocsStatusResponse {
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analytics: Option<DocAnalytics>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyPasswordRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyPasswordResponse {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct PublicDocResponse {
    pub collection: serde_json::Value,
    pub settings: DocSettings,
    pub published_at: DateTime<Utc>,
}
