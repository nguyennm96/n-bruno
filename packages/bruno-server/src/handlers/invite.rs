use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::{AppError, AppResult},
    middleware::extract_user_id,
    models::{workspace::WorkspaceRole, token::Claims},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SendInviteRequest {
    pub email: String,
    pub role: WorkspaceRole,
}

#[derive(Debug, Deserialize)]
pub struct AcceptInviteRequest {
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct ValidateTokenQuery {
    pub token: String,
}

/// POST /api/workspaces/:id/invites — send invite (Owner only)
pub async fn send_invite(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<SendInviteRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    if body.email.is_empty() {
        return Err(AppError::Validation("Email is required".into()));
    }
    let invite = state.invite_service
        .create_invite(&workspace_id, body.email, body.role, user_id)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": invite }))))
}

/// GET /api/workspaces/:id/invites — list pending invites (Owner only)
pub async fn list_invites(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let invites = state.invite_service.list_pending(&workspace_id, user_id).await?;
    Ok(Json(json!({ "data": invites })))
}

/// DELETE /api/workspaces/:id/invites/:invite_id — cancel invite (Owner only)
pub async fn cancel_invite(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((workspace_id, invite_id)): Path<(String, String)>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.invite_service.revoke_invite(&workspace_id, &invite_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/invites/validate?token=xxx — public (no auth required)
pub async fn validate_invite(
    State(state): State<AppState>,
    Query(params): Query<ValidateTokenQuery>,
) -> AppResult<Json<Value>> {
    let result = state.invite_service.validate_token(&params.token).await?;
    Ok(Json(json!({ "data": result })))
}

/// POST /api/invites/accept — accept invite (requires auth)
pub async fn accept_invite(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    JsonBody(body): JsonBody<AcceptInviteRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let workspace_uid = state.invite_service.accept_invite(&body.token, user_id).await?;
    Ok(Json(json!({ "data": { "workspaceUid": workspace_uid } })))
}
