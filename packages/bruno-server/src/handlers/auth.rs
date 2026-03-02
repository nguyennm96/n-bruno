use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::Json,
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
        "created_at": user.created_at,
    }})))
}
