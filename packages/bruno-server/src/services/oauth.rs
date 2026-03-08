use bson::{doc, oid::ObjectId};
use chrono::Utc;
use mongodb::{Collection, Database};
use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::{
    config::Config,
    errors::{AppError, AppResult},
    models::{
        oauth::OauthCode,
        user::{OauthProvider, User},
    },
};

/// User info returned from an OAuth provider after token exchange.
#[derive(Debug)]
pub struct OauthUserInfo {
    pub provider: String,
    pub provider_user_id: String,
    pub email: Option<String>,
    pub name: String,
    pub avatar: Option<String>,
}

/// Response shapes from Google token endpoint
#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    sub: String,
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

/// Response shapes from GitHub token endpoint
#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct GitHubUserInfo {
    id: i64,
    login: String,
    name: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubEmail {
    email: String,
    primary: bool,
    verified: bool,
}

/// Serialized form for building OAuth state (CSRF protection).
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct OauthState {
    nonce: String,
}

#[derive(Clone)]
pub struct OauthService {
    users: Collection<User>,
    oauth_codes: Collection<OauthCode>,
    config: Config,
    http: reqwest::Client,
}

impl OauthService {
    pub fn new(db: &Database, config: Config) -> Self {
        Self {
            users: db.collection("users"),
            oauth_codes: db.collection("oauth_codes"),
            config,
            http: reqwest::Client::new(),
        }
    }

    // ── State / CSRF ──────────────────────────────────────────────────────────

    /// Generate a signed state token for CSRF protection.
    /// Format: `<nonce>.<hmac_hex>` — the nonce is random bytes, hmac uses JWT secret.
    pub fn generate_state(&self) -> String {
        let nonce: String = (0..32)
            .map(|_| format!("{:02x}", rand::thread_rng().gen::<u8>()))
            .collect();
        let hmac = self.sign_nonce(&nonce);
        format!("{}.{}", nonce, hmac)
    }

    pub fn verify_state(&self, state: &str) -> bool {
        let parts: Vec<&str> = state.splitn(2, '.').collect();
        if parts.len() != 2 {
            return false;
        }
        let expected = self.sign_nonce(parts[0]);
        parts[1] == expected
    }

    fn sign_nonce(&self, nonce: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.config.jwt_secret.as_bytes());
        hasher.update(b":");
        hasher.update(nonce.as_bytes());
        hex::encode(hasher.finalize())
    }

    // ── Authorization URL ─────────────────────────────────────────────────────

    /// Build the OAuth authorization URL for a given provider.
    pub fn build_authorize_url(&self, provider: &str) -> AppResult<String> {
        let state = self.generate_state();
        let callback_url = format!("{}/api/auth/oauth/{}/callback", self.config.app_url, provider);

        match provider {
            "google" => {
                let client_id = self.config.google_client_id.as_deref().ok_or_else(|| {
                    AppError::Internal("GOOGLE_CLIENT_ID not configured".to_string())
                })?;
                Ok(format!(
                    "https://accounts.google.com/o/oauth2/v2/auth\
                    ?response_type=code\
                    &client_id={}\
                    &redirect_uri={}\
                    &scope=openid%20email%20profile\
                    &state={}\
                    &access_type=offline\
                    &prompt=select_account",
                    urlencoding::encode(client_id),
                    urlencoding::encode(&callback_url),
                    urlencoding::encode(&state),
                ))
            }
            "github" => {
                let client_id = self.config.github_client_id.as_deref().ok_or_else(|| {
                    AppError::Internal("GITHUB_CLIENT_ID not configured".to_string())
                })?;
                Ok(format!(
                    "https://github.com/login/oauth/authorize\
                    ?client_id={}\
                    &redirect_uri={}\
                    &scope=read%3Auser%20user%3Aemail\
                    &state={}",
                    urlencoding::encode(client_id),
                    urlencoding::encode(&callback_url),
                    urlencoding::encode(&state),
                ))
            }
            _ => Err(AppError::BadRequest(format!("Unknown OAuth provider: {}", provider))),
        }
    }

    // ── Exchange code → user info ─────────────────────────────────────────────

    pub async fn exchange_code(&self, provider: &str, code: &str) -> AppResult<OauthUserInfo> {
        let callback_url = format!("{}/api/auth/oauth/{}/callback", self.config.app_url, provider);
        match provider {
            "google" => self.exchange_google_code(code, &callback_url).await,
            "github" => self.exchange_github_code(code, &callback_url).await,
            _ => Err(AppError::BadRequest(format!("Unknown OAuth provider: {}", provider))),
        }
    }

    async fn exchange_google_code(&self, code: &str, redirect_uri: &str) -> AppResult<OauthUserInfo> {
        let client_id = self.config.google_client_id.as_deref().ok_or_else(|| {
            AppError::Internal("GOOGLE_CLIENT_ID not configured".to_string())
        })?;
        let client_secret = self.config.google_client_secret.as_deref().ok_or_else(|| {
            AppError::Internal("GOOGLE_CLIENT_SECRET not configured".to_string())
        })?;

        let token_resp = self
            .http
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Google token request failed: {e}")))?
            .json::<GoogleTokenResponse>()
            .await
            .map_err(|e| AppError::Internal(format!("Google token parse failed: {e}")))?;

        let user_info = self
            .http
            .get("https://www.googleapis.com/oauth2/v3/userinfo")
            .bearer_auth(&token_resp.access_token)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Google userinfo request failed: {e}")))?
            .json::<GoogleUserInfo>()
            .await
            .map_err(|e| AppError::Internal(format!("Google userinfo parse failed: {e}")))?;

        Ok(OauthUserInfo {
            provider: "google".to_string(),
            provider_user_id: user_info.sub,
            email: user_info.email,
            name: user_info.name.unwrap_or_else(|| "User".to_string()),
            avatar: user_info.picture,
        })
    }

    async fn exchange_github_code(&self, code: &str, redirect_uri: &str) -> AppResult<OauthUserInfo> {
        let client_id = self.config.github_client_id.as_deref().ok_or_else(|| {
            AppError::Internal("GITHUB_CLIENT_ID not configured".to_string())
        })?;
        let client_secret = self.config.github_client_secret.as_deref().ok_or_else(|| {
            AppError::Internal("GITHUB_CLIENT_SECRET not configured".to_string())
        })?;

        let token_resp = self
            .http
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("redirect_uri", redirect_uri),
            ])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub token request failed: {e}")))?
            .json::<GitHubTokenResponse>()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub token parse failed: {e}")))?;

        let gh_user = self
            .http
            .get("https://api.github.com/user")
            .bearer_auth(&token_resp.access_token)
            .header("User-Agent", "Bruno")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub user request failed: {e}")))?
            .json::<GitHubUserInfo>()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub user parse failed: {e}")))?;

        // Try to get primary verified email from /user/emails
        let email: Option<String> = async {
            let resp = self
                .http
                .get("https://api.github.com/user/emails")
                .bearer_auth(&token_resp.access_token)
                .header("User-Agent", "Bruno")
                .send()
                .await
                .ok()?;
            let emails: Vec<GitHubEmail> = resp.json().await.ok()?;
            emails.into_iter().find(|e| e.primary && e.verified).map(|e| e.email)
        }
        .await;

        let name = gh_user.name.unwrap_or(gh_user.login);

        Ok(OauthUserInfo {
            provider: "github".to_string(),
            provider_user_id: gh_user.id.to_string(),
            email,
            name,
            avatar: gh_user.avatar_url,
        })
    }

    // ── Find or create user ───────────────────────────────────────────────────

    /// Find-or-create user from OAuth info.
    /// Priority: 1) provider_user_id, 2) email, 3) create new.
    pub async fn find_or_create_user(&self, info: &OauthUserInfo) -> AppResult<User> {
        let provider_entry = doc! {
            "provider": &info.provider,
            "provider_user_id": &info.provider_user_id,
        };

        // 1. Find by provider_user_id
        if let Some(mut user) = self
            .users
            .find_one(doc! { "oauth_providers": { "$elemMatch": &provider_entry } })
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
        {
            // Update avatar/name if changed
            let updated_at = Utc::now();
            self.users
                .update_one(
                    doc! { "_id": user.id },
                    doc! { "$set": { "avatar": &info.avatar, "updated_at": bson::to_bson(&updated_at).unwrap() } },
                )
                .await
                .ok();
            user.avatar = info.avatar.clone();
            return Ok(user);
        }

        // 2. Find by email (link provider to existing account)
        if let Some(email) = &info.email {
            if let Some(mut user) = self
                .users
                .find_one(doc! { "email": email })
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?
            {
                let updated_at = Utc::now();
                self.users
                    .update_one(
                        doc! { "_id": user.id },
                        doc! {
                            "$push": { "oauth_providers": &provider_entry },
                            "$set": { "avatar": &info.avatar, "updated_at": bson::to_bson(&updated_at).unwrap() }
                        },
                    )
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?;
                user.oauth_providers.push(OauthProvider {
                    provider: info.provider.clone(),
                    provider_user_id: info.provider_user_id.clone(),
                });
                user.avatar = info.avatar.clone();
                return Ok(user);
            }
        }

        // 3. Create new user
        let email = info.email.clone().unwrap_or_else(|| {
            format!("{}+{}@oauth.bruno.app", info.provider, info.provider_user_id)
        });
        let new_user = User::new_from_oauth(
            email,
            info.name.clone(),
            info.avatar.clone(),
            info.provider.clone(),
            info.provider_user_id.clone(),
        );
        let result = self
            .users
            .insert_one(&new_user)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let mut created = new_user;
        created.id = result.inserted_id.as_object_id();
        Ok(created)
    }

    // ── OTC (one-time code) ───────────────────────────────────────────────────

    pub async fn create_oauth_code(&self, user_id: ObjectId, provider: &str) -> AppResult<String> {
        let code: String = (0..32)
            .map(|_| format!("{:02x}", rand::thread_rng().gen::<u8>()))
            .collect();
        let doc = OauthCode::new(code.clone(), user_id, provider.to_string());
        self.oauth_codes
            .insert_one(doc)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(code)
    }

    pub async fn exchange_oauth_code(&self, code: &str) -> AppResult<User> {
        let oauth_doc = self
            .oauth_codes
            .find_one_and_delete(doc! { "code": code })
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Unauthorized("Invalid or expired OAuth code".to_string()))?;

        if oauth_doc.expires_at < Utc::now() {
            return Err(AppError::Unauthorized("OAuth code has expired".to_string()));
        }

        self.users
            .find_one(doc! { "_id": oauth_doc.user_id })
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))
    }

    /// Ensure TTL index exists on oauth_codes.expires_at
    pub async fn ensure_indexes(&self) -> anyhow::Result<()> {
        use mongodb::IndexModel;
        use bson::doc;
        let index = IndexModel::builder()
            .keys(doc! { "expires_at": 1 })
            .options(
                mongodb::options::IndexOptions::builder()
                    .expire_after(std::time::Duration::from_secs(0))
                    .build(),
            )
            .build();
        self.oauth_codes.create_index(index).await?;
        Ok(())
    }
}
