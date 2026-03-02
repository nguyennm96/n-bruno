use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use bson::{doc, oid::ObjectId};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use mongodb::{Collection, Database};
use rand::Rng;

use crate::{
    config::Config,
    errors::{AppError, AppResult},
    models::{
        token::{Claims, RefreshToken},
        user::{User, UserResponse},
    },
};

#[derive(Clone)]
pub struct AuthService {
    users: Collection<User>,
    refresh_tokens: Collection<RefreshToken>,
    config: Config,
}

impl AuthService {
    pub fn new(db: &Database, config: Config) -> Self {
        Self {
            users: db.collection("users"),
            refresh_tokens: db.collection("refresh_tokens"),
            config,
        }
    }

    // ── Password hashing ─────────────────────────────────────────────────

    pub fn hash_password(&self, password: &str) -> AppResult<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|e| AppError::Internal(format!("Password hashing failed: {e}")))
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> AppResult<bool> {
        let parsed = PasswordHash::new(hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {e}")))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok())
    }

    // ── JWT ───────────────────────────────────────────────────────────────

    pub fn generate_access_token(&self, user: &User) -> AppResult<String> {
        let now = Utc::now();
        let exp = now + Duration::minutes(self.config.jwt_access_expires_minutes);
        let claims = Claims {
            sub: user.id.unwrap_or_default().to_hex(),
            email: user.email.clone(),
            name: user.name.clone(),
            iat: now.timestamp(),
            exp: exp.timestamp(),
        };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Token generation failed: {e}")))
    }

    pub fn verify_access_token(&self, token: &str) -> AppResult<Claims> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {e}")))
    }

    // ── Refresh tokens ────────────────────────────────────────────────────

    fn generate_refresh_token_value() -> String {
        let mut rng = rand::thread_rng();
        (0..64)
            .map(|_| format!("{:02x}", rng.gen::<u8>()))
            .collect()
    }

    pub async fn create_refresh_token(&self, user_id: ObjectId) -> AppResult<String> {
        let raw_token = Self::generate_refresh_token_value();
        let token_hash = self.hash_password(&raw_token)?;
        let expires_at = Utc::now() + Duration::days(self.config.jwt_refresh_expires_days);

        let rt = RefreshToken::new(user_id, token_hash, expires_at);
        self.refresh_tokens
            .insert_one(rt)
            .await
            .map_err(AppError::from)?;

        Ok(raw_token)
    }

    /// Validates refresh token and returns (user, new_refresh_token)
    pub async fn rotate_refresh_token(&self, raw_token: &str) -> AppResult<(User, String)> {
        // Find all non-expired tokens for candidate matching
        let mut cursor = self
            .refresh_tokens
            .find(doc! { "expires_at": { "$gt": bson::DateTime::from_millis(Utc::now().timestamp_millis()) } })
            .await
            .map_err(AppError::from)?;

        use futures::StreamExt;
        let mut found: Option<RefreshToken> = None;
        while let Some(Ok(rt)) = cursor.next().await {
            if self.verify_password(raw_token, &rt.token_hash)? {
                found = Some(rt);
                break;
            }
        }

        let rt = found.ok_or_else(|| AppError::Unauthorized("Invalid or expired refresh token".into()))?;

        // Delete old token (rotation: one-time use)
        self.refresh_tokens
            .delete_one(doc! { "_id": rt.id.unwrap() })
            .await
            .map_err(AppError::from)?;

        // Get user
        let user = self
            .users
            .find_one(doc! { "_id": rt.user_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("User not found".into()))?;

        // Issue new refresh token
        let new_raw = self.create_refresh_token(rt.user_id).await?;

        Ok((user, new_raw))
    }

    pub async fn revoke_refresh_token(&self, user_id: ObjectId, raw_token: &str) -> AppResult<()> {
        let mut cursor = self
            .refresh_tokens
            .find(doc! { "user_id": user_id })
            .await
            .map_err(AppError::from)?;

        use futures::StreamExt;
        while let Some(Ok(rt)) = cursor.next().await {
            if self.verify_password(raw_token, &rt.token_hash)? {
                self.refresh_tokens
                    .delete_one(doc! { "_id": rt.id.unwrap() })
                    .await
                    .map_err(AppError::from)?;
                return Ok(());
            }
        }
        // Even if not found, treat logout as success (idempotent)
        Ok(())
    }

    // ── User CRUD ─────────────────────────────────────────────────────────

    pub async fn register(&self, email: String, password: String, name: String) -> AppResult<UserResponse> {
        // Check duplicate email
        if self
            .users
            .find_one(doc! { "email": &email })
            .await
            .map_err(AppError::from)?
            .is_some()
        {
            return Err(AppError::Conflict("Email already registered".into()));
        }

        let hash = self.hash_password(&password)?;
        let mut user = User::new(email, hash, name);
        let res = self.users.insert_one(&user).await.map_err(AppError::from)?;
        user.id = res.inserted_id.as_object_id();

        Ok(UserResponse::from(user))
    }

    pub async fn login(&self, email: &str, password: &str) -> AppResult<(User, String, String)> {
        let user = self
            .users
            .find_one(doc! { "email": email })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

        if !self.verify_password(password, &user.password_hash)? {
            return Err(AppError::Unauthorized("Invalid credentials".into()));
        }

        let access_token = self.generate_access_token(&user)?;
        let refresh_token = self.create_refresh_token(user.id.unwrap()).await?;

        Ok((user, access_token, refresh_token))
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> AppResult<User> {
        let oid = ObjectId::parse_str(user_id)
            .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
        self.users
            .find_one(doc! { "_id": oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("User not found".into()))
    }
}
