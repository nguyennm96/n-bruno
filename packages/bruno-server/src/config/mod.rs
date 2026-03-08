use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub app_env: String,
    pub host: String,
    pub port: u16,
    pub mongodb_uri: String,
    pub mongodb_database: String,
    pub jwt_secret: String,
    pub jwt_access_expires_minutes: i64,
    pub jwt_refresh_expires_days: i64,
    pub cors_allowed_origins: Vec<String>,
    pub public_docs_base_url: String,
    pub app_url: String,
    pub sendgrid_api_key: Option<String>,
    pub sendgrid_from_email: String,
    pub sendgrid_from_name: String,
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub ai_provider: String,
    // OAuth providers
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Config {
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            host: env::var("APP_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("APP_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            mongodb_uri: env::var("MONGODB_URI")
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            mongodb_database: env::var("MONGODB_DATABASE")
                .unwrap_or_else(|_| "bruno_server".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET must be set"),
            jwt_access_expires_minutes: env::var("JWT_ACCESS_EXPIRES_IN_MINUTES")
                .unwrap_or_else(|_| "15".to_string())
                .parse()
                .unwrap_or(15),
            jwt_refresh_expires_days: env::var("JWT_REFRESH_EXPIRES_IN_DAYS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            cors_allowed_origins: env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            public_docs_base_url: env::var("PUBLIC_DOCS_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            app_url: env::var("APP_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            sendgrid_api_key: env::var("SENDGRID_API_KEY").ok(),
            sendgrid_from_email: env::var("SENDGRID_FROM_EMAIL")
                .unwrap_or_else(|_| "noreply@usebruno.com".to_string()),
            sendgrid_from_name: env::var("SENDGRID_FROM_NAME")
                .unwrap_or_else(|_| "Bruno".to_string()),
            openai_api_key: env::var("OPENAI_API_KEY").ok(),
            anthropic_api_key: env::var("ANTHROPIC_API_KEY").ok(),
            ai_provider: env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string()),
            google_client_id: env::var("GOOGLE_CLIENT_ID").ok(),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").ok(),
            github_client_id: env::var("GITHUB_CLIENT_ID").ok(),
            github_client_secret: env::var("GITHUB_CLIENT_SECRET").ok(),
        })
    }

    /// Create a config suitable for integration tests.
    /// Avoids relying on shared env vars (which cause race conditions in parallel tests).
    pub fn for_test(mongodb_uri: String, db_name: String) -> Self {
        Config {
            app_env: "test".to_string(),
            host: "127.0.0.1".to_string(),
            port: 0,
            mongodb_uri,
            mongodb_database: db_name,
            jwt_secret: "test-only-secret-do-not-use-in-production-32".to_string(),
            jwt_access_expires_minutes: 15,
            jwt_refresh_expires_days: 30,
            cors_allowed_origins: vec!["http://localhost:3000".to_string()],
            public_docs_base_url: "http://localhost:3000".to_string(),
            app_url: "http://localhost:3000".to_string(),
            sendgrid_api_key: None,
            sendgrid_from_email: "noreply@usebruno.com".to_string(),
            sendgrid_from_name: "Bruno".to_string(),
            openai_api_key: None,
            anthropic_api_key: None,
            ai_provider: "openai".to_string(),
            google_client_id: None,
            google_client_secret: None,
            github_client_id: None,
            github_client_secret: None,
        }
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}

