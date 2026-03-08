use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::{AppError, AppResult},
    middleware::extract_user_id,
    models::{token::Claims, workspace::WorkspaceRole},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

/// Invite or add member by email + role.
#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub email: String,
    pub role: WorkspaceRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: WorkspaceRole,
}

#[derive(Debug, Deserialize)]
pub struct TransferOwnershipRequest {
    /// ObjectId hex of the user who will become the new Owner.
    pub user_id: String,
}


pub async fn create_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    JsonBody(body): JsonBody<CreateWorkspaceRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    if body.name.is_empty() {
        return Err(AppError::Validation("Workspace name is required".into()));
    }
    let ws = state.workspace_service.create(body.name, body.description, user_id).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": ws }))))
}

pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let workspaces = state.workspace_service.list_for_user(user_id).await?;
    Ok(Json(json!({ "data": workspaces })))
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let (ws, role) = state.workspace_service.get_with_role(&workspace_id, user_id).await?;
    Ok(Json(json!({ "data": {
        "uid": ws.uid,
        "name": ws.name,
        "description": ws.description,
        "ownerUid": ws.owner_id.to_hex(),
        "role": role,
        "created_at": ws.created_at,
        "updated_at": ws.updated_at,
    }})))
}

pub async fn update_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<UpdateWorkspaceRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let ws = state.workspace_service.update(&workspace_id, user_id, body.name, body.description).await?;
    Ok(Json(json!({ "data": ws })))
}

pub async fn delete_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service.delete(&workspace_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/workspaces/:id/members — returns members with name + email.
pub async fn list_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let members = state.workspace_service.list_members_with_info(&workspace_id, user_id).await?;
    Ok(Json(json!({ "data": members })))
}

/// POST /api/workspaces/:id/members — invite/add by email + role (Owner only).
pub async fn add_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<AddMemberRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let result = state.workspace_service
        .add_member_by_email(&workspace_id, user_id, body.email, body.role, &state.invite_service)
        .await?;
    Ok((StatusCode::OK, Json(json!({ "data": result }))))
}

/// DELETE /api/workspaces/:id/members/:user_id — remove member (Owner only).
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((workspace_id, target_user_id)): Path<(String, String)>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service.remove_member(&workspace_id, user_id, &target_user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// PATCH /api/workspaces/:id/members/:user_id — update role (Owner only).
pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((workspace_id, target_user_id)): Path<(String, String)>,
    JsonBody(body): JsonBody<UpdateMemberRoleRequest>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service.update_member_role(&workspace_id, user_id, &target_user_id, body.role).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/workspaces/:id/leave — leave workspace (Editor/Viewer only).
pub async fn leave_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service.leave_workspace(&workspace_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// PATCH /api/workspaces/:id/transfer-ownership — transfer ownership (Owner only).
pub async fn transfer_ownership(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<TransferOwnershipRequest>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service.transfer_ownership(&workspace_id, user_id, &body.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
