use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{Json, Redirect},
    Json as JsonBody,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use validator::Validate;

use crate::{
    errors::{AppError, AppResult},
    middleware::extract_user_id,
    models::token::Claims,
    state::AppState,
};

// ── Request bodies ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn register(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<RegisterRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if let Err(e) = body.validate() {
        return Err(AppError::Validation(e.to_string()));
    }

    let user = state.auth_service.register(body.email, body.password, body.name).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "data": user })),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<LoginRequest>,
) -> AppResult<Json<Value>> {
    if let Err(e) = body.validate() {
        return Err(AppError::Validation(e.to_string()));
    }

    let (user, access_token, refresh_token) = state.auth_service.login(&body.email, &body.password).await?;

    Ok(Json(json!({
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "user": {
                "id": user.id.unwrap_or_default().to_hex(),
                "email": user.email,
                "name": user.name,
                "avatar": user.avatar,
            }
        }
    })))
}

pub async fn refresh(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<RefreshRequest>,
) -> AppResult<Json<Value>> {
    let (user, new_refresh_token) = state.auth_service.rotate_refresh_token(&body.refresh_token).await?;
    let access_token = state.auth_service.generate_access_token(&user)?;

    Ok(Json(json!({
        "data": {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "Bearer",
        }
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    JsonBody(body): JsonBody<LogoutRequest>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.auth_service.revoke_refresh_token(user_id, &body.refresh_token).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Value>> {
    let user = state.auth_service.get_user_by_id(&claims.sub).await?;
    Ok(Json(json!({ "data": {
        "id": user.id.unwrap_or_default().to_hex(),
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar,
        "created_at": user.created_at,
    }})))
}

// ── Profile update ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProfileRequest {
    #[validate(length(min = 1, message = "Name cannot be empty"))]
    pub name: Option<String>,
    pub avatar: Option<String>,
}

pub async fn update_me_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    JsonBody(body): JsonBody<UpdateProfileRequest>,
) -> AppResult<Json<Value>> {
    if let Err(e) = body.validate() {
        return Err(AppError::Validation(e.to_string()));
    }
    let user_id = extract_user_id(&claims)?;
    let user = state.auth_service.update_profile(user_id, body.name, body.avatar).await?;
    Ok(Json(json!({ "data": {
        "id": user.id.unwrap_or_default().to_hex(),
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar,
        "created_at": user.created_at,
    }})))
}

// ── Forgot / reset password ───────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
}

pub async fn forgot_password(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<ForgotPasswordRequest>,
) -> AppResult<Json<Value>> {
    if let Err(e) = body.validate() {
        return Err(AppError::Validation(e.to_string()));
    }
    state.auth_service.send_password_reset_otp(&body.email).await?;
    Ok(Json(json!({
        "message": "If that email address is registered, you will receive an OTP shortly."
    })))
}

#[derive(Debug, Deserialize, Validate)]
pub struct ResetPasswordRequest {
    #[validate(email(message = "Invalid email address"))]
    pub email: String,
    #[validate(length(min = 6, max = 6, message = "OTP must be 6 digits"))]
    pub otp: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub new_password: String,
}

pub async fn reset_password(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<ResetPasswordRequest>,
) -> AppResult<Json<Value>> {
    if let Err(e) = body.validate() {
        return Err(AppError::Validation(e.to_string()));
    }
    state
        .auth_service
        .reset_password_with_otp(&body.email, &body.otp, &body.new_password)
        .await?;
    Ok(Json(json!({ "message": "Password updated successfully." })))
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct OauthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OauthExchangeRequest {
    pub code: String,
}

/// GET /api/auth/oauth/:provider/authorize
/// Returns the OAuth authorization URL for the given provider.
pub async fn oauth_authorize(
    State(state): State<AppState>,
    Path(provider): Path<String>,
) -> AppResult<Json<Value>> {
    let url = state.oauth_service.build_authorize_url(&provider)?;
    Ok(Json(json!({ "data": { "url": url } })))
}

/// GET /api/auth/oauth/:provider/callback
/// Handles the OAuth callback from the provider.
/// Exchanges code for user info, finds/creates user, issues OTC, redirects to bruno://
pub async fn oauth_callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<OauthCallbackQuery>,
) -> AppResult<Redirect> {
    if let Some(err) = query.error {
        let error_url = format!("bruno://oauth?error={}", urlencoding::encode(&err));
        return Ok(Redirect::temporary(&error_url));
    }

    let code = query.code.ok_or_else(|| AppError::BadRequest("Missing code parameter".to_string()))?;
    let state_param = query.state.ok_or_else(|| AppError::BadRequest("Missing state parameter".to_string()))?;

    if !state.oauth_service.verify_state(&state_param) {
        return Err(AppError::Unauthorized("Invalid OAuth state — possible CSRF attack".to_string()));
    }

    let user_info = state.oauth_service.exchange_code(&provider, &code).await?;
    let user = state.oauth_service.find_or_create_user(&user_info).await?;
    let user_id = user.id.ok_or_else(|| AppError::Internal("User has no ID".to_string()))?;

    let otc = state.oauth_service.create_oauth_code(user_id, &provider).await?;

    let redirect_url = format!(
        "bruno://oauth?code={}&provider={}",
        urlencoding::encode(&otc),
        urlencoding::encode(&provider),
    );
    Ok(Redirect::temporary(&redirect_url))
}

/// POST /api/auth/oauth/exchange
/// Exchanges a one-time OAuth code for JWT tokens.
pub async fn oauth_exchange(
    State(state): State<AppState>,
    JsonBody(body): JsonBody<OauthExchangeRequest>,
) -> AppResult<Json<Value>> {
    let user = state.oauth_service.exchange_oauth_code(&body.code).await?;
    let access_token = state.auth_service.generate_access_token(&user)?;
    let user_id = user.id.ok_or_else(|| AppError::Internal("User has no ID".to_string()))?;
    let refresh_token = state.auth_service.create_refresh_token(user_id).await?;

    Ok(Json(json!({
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "user": {
                "id": user.id.unwrap_or_default().to_hex(),
                "email": user.email,
                "name": user.name,
                "avatar": user.avatar,
            }
        }
    })))
}
