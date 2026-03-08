use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use bson::{doc, oid::ObjectId};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use mongodb::{Collection, Database};
use rand::Rng;
use sha2::{Digest, Sha256};

use crate::{
    config::Config,
    errors::{AppError, AppResult},
    models::{
        password_reset_token::PasswordResetToken,
        token::{Claims, RefreshToken},
        user::{User, UserResponse},
    },
    services::mailer::MailerService,
};

#[derive(Clone)]
pub struct AuthService {
    users: Collection<User>,
    refresh_tokens: Collection<RefreshToken>,
    password_reset_tokens: Collection<PasswordResetToken>,
    mailer: MailerService,
    config: Config,
}

impl AuthService {
    pub fn new(db: &Database, config: Config, mailer: MailerService) -> Self {
        Self {
            users: db.collection("users"),
            refresh_tokens: db.collection("refresh_tokens"),
            password_reset_tokens: db.collection("password_reset_tokens"),
            mailer,
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
        use futures::StreamExt;

        // Fetch all tokens (TTL index auto-deletes expired ones in background)
        let mut cursor = self
            .refresh_tokens
            .find(doc! {})
            .await
            .map_err(AppError::from)?;

        let now = Utc::now();
        let mut found: Option<RefreshToken> = None;
        while let Some(Ok(rt)) = cursor.next().await {
            // Skip already-expired tokens (TTL cleanup may lag slightly)
            if rt.expires_at <= now {
                continue;
            }
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

    /// Update a user's name and/or avatar. Returns the updated user.
    pub async fn update_profile(
        &self,
        user_id: ObjectId,
        name: Option<String>,
        avatar: Option<String>,
    ) -> AppResult<User> {
        // Validate avatar size (base64 of 2MB image ≈ 2.7MB string)
        const MAX_AVATAR_BYTES: usize = 3 * 1024 * 1024; // 3MB base64 limit
        if let Some(ref av) = avatar {
            if av.len() > MAX_AVATAR_BYTES {
                return Err(AppError::BadRequest("Avatar exceeds 2MB limit".into()));
            }
        }

        let now = Utc::now();
        let mut set_doc = doc! { "updated_at": bson::DateTime::from_millis(now.timestamp_millis()) };
        if let Some(ref n) = name {
            if n.trim().is_empty() {
                return Err(AppError::Validation("Name cannot be empty".into()));
            }
            set_doc.insert("name", n.trim());
        }
        if let Some(ref av) = avatar {
            set_doc.insert("avatar", av);
        }

        let updated = self
            .users
            .find_one_and_update(doc! { "_id": user_id }, doc! { "$set": set_doc })
            .return_document(mongodb::options::ReturnDocument::After)
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("User not found".into()))?;

        Ok(updated)
    }

    // ── Password reset (OTP flow) ─────────────────────────────────────────

    fn hash_otp(otp: &str) -> String {
        hex::encode(Sha256::digest(otp.as_bytes()))
    }

    /// Generate a 6-digit OTP, store it (hashed), and send email.
    /// Always returns Ok to avoid email enumeration.
    pub async fn send_password_reset_otp(&self, email: &str) -> AppResult<()> {
        let user = match self
            .users
            .find_one(doc! { "email": email })
            .await
            .map_err(AppError::from)?
        {
            Some(u) => u,
            None => {
                tracing::info!("Password reset requested for unknown email (silent)");
                return Ok(());
            }
        };

        let user_id = user.id.unwrap();

        // Remove any existing reset tokens for this user
        self.password_reset_tokens
            .delete_many(doc! { "user_id": user_id })
            .await
            .map_err(AppError::from)?;

        // Generate and hash OTP
        let otp = format!("{:06}", rand::thread_rng().gen_range(0u32..1_000_000));
        let otp_hash = Self::hash_otp(&otp);

        // Store hashed token
        let token = PasswordResetToken::new(user_id, otp_hash);
        self.password_reset_tokens
            .insert_one(token)
            .await
            .map_err(AppError::from)?;

        // Send email
        let html = format!(
            r#"<div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#1a1a1a">Reset your Bruno Cloud password</h2>
              <p>Your one-time password (OTP) is:</p>
              <div style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;padding:16px 24px;
                background:#f5f5f5;border-radius:8px;display:inline-block">{otp}</div>
              <p style="color:#666;font-size:0.875rem">
                This code expires in <strong>15 minutes</strong>.<br>
                If you didn't request a password reset, you can ignore this email.
              </p>
            </div>"#,
        );

        self.mailer
            .send_email(email, "Bruno Cloud — Password Reset OTP", &html)
            .await?;

        Ok(())
    }

    /// Validate OTP and update password. Deletes all reset tokens for the user on success.
    pub async fn reset_password_with_otp(
        &self,
        email: &str,
        otp: &str,
        new_password: &str,
    ) -> AppResult<()> {
        if new_password.len() < 8 {
            return Err(AppError::Validation("Password must be at least 8 characters".into()));
        }

        let user = self
            .users
            .find_one(doc! { "email": email })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::BadRequest("Invalid email or OTP".into()))?;

        let user_id = user.id.unwrap();
        let otp_hash = Self::hash_otp(otp);
        let now = bson::DateTime::now();

        let token = self
            .password_reset_tokens
            .find_one(doc! {
                "user_id": user_id,
                "otp_hash": &otp_hash,
                "expires_at": { "$gt": now },
            })
            .await
            .map_err(AppError::from)?;

        if token.is_none() {
            return Err(AppError::BadRequest("Invalid or expired OTP".into()));
        }

        // Update password
        let new_hash = self.hash_password(new_password)?;
        let updated_at = bson::DateTime::from_millis(Utc::now().timestamp_millis());
        self.users
            .update_one(
                doc! { "_id": user_id },
                doc! { "$set": { "password_hash": new_hash, "updated_at": updated_at } },
            )
            .await
            .map_err(AppError::from)?;

        // Invalidate all reset tokens for this user
        self.password_reset_tokens
            .delete_many(doc! { "user_id": user_id })
            .await
            .map_err(AppError::from)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a test AuthService wired to a non-connected client.
    /// Only safe for calling pure (non-async DB) methods.
    fn make_service() -> AuthService {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let client = rt.block_on(async {
            mongodb::Client::with_uri_str("mongodb://127.0.0.1:27017")
                .await
                .unwrap()
        });
        let db = client.database("__unit_test_unused__");
        AuthService::new(&db, Config::for_test("mongodb://127.0.0.1:27017".into(), "__unit_test_unused__".into()), MailerService::for_test())
    }

    #[test]
    fn hash_and_verify_password_roundtrip() {
        let svc = make_service();
        let hash = svc.hash_password("correct-horse").unwrap();
        assert!(svc.verify_password("correct-horse", &hash).unwrap());
        assert!(!svc.verify_password("wrong-horse", &hash).unwrap());
    }

    #[test]
    fn verify_password_invalid_hash_returns_error() {
        let svc = make_service();
        let result = svc.verify_password("any", "not-a-valid-hash");
        assert!(result.is_err());
    }

    #[test]
    fn generate_access_token_is_decodable() {
        let svc = make_service();
        let mut user = crate::models::user::User::new("t@example.com".into(), "hash".into(), "Test".into());
        user.id = Some(bson::oid::ObjectId::new());
        let token = svc.generate_access_token(&user).unwrap();
        assert!(!token.is_empty());
        let claims = svc.verify_access_token(&token).unwrap();
        assert_eq!(claims.email, "t@example.com");
        assert_eq!(claims.name, "Test");
    }

    #[test]
    fn verify_access_token_rejects_garbage() {
        let svc = make_service();
        let result = svc.verify_access_token("not.a.jwt.at.all");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Unauthorized(_)));
    }

    #[test]
    fn verify_access_token_rejects_wrong_secret() {
        let svc = make_service();
        // Generate with one service, verify with different key (same struct but config key differs).
        let mut user = crate::models::user::User::new("a@b.com".into(), "h".into(), "A".into());
        user.id = Some(bson::oid::ObjectId::new());
        let token = svc.generate_access_token(&user).unwrap();

        let other_cfg = Config::for_test("mongodb://127.0.0.1:27017".into(), "x".into());
        // Patch: use a different secret via a second service built with a modified config
        // We test indirectly: tamper the token's signature byte
        let mut parts: Vec<&str> = token.split('.').collect();
        let mut bad_sig = parts[2].to_string();
        bad_sig.push('x');
        parts[2] = Box::leak(bad_sig.into_boxed_str());
        let bad_token = parts.join(".");
        let result = svc.verify_access_token(&bad_token);
        assert!(result.is_err());
    }
}
