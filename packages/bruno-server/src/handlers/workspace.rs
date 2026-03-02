use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use bson::oid::ObjectId;
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

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: String,
    pub role: WorkspaceRole,
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
        "id": ws.id.unwrap_or_default().to_hex(),
        "name": ws.name,
        "description": ws.description,
        "owner_id": ws.owner_id.to_hex(),
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

pub async fn list_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let members = state.workspace_service.list_members(&workspace_id, user_id).await?;
    let data: Vec<Value> = members.iter().map(|m| json!({
        "user_id": m.user_id.to_hex(),
        "role": m.role,
        "joined_at": m.joined_at,
    })).collect();
    Ok(Json(json!({ "data": data })))
}

pub async fn add_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<AddMemberRequest>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    let target_oid = ObjectId::parse_str(&body.user_id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
    state.workspace_service.add_member(&workspace_id, user_id, target_oid, body.role).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((workspace_id, target_user_id)): Path<(String, String)>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    let target_oid = ObjectId::parse_str(&target_user_id)
        .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
    state.workspace_service.remove_member(&workspace_id, user_id, target_oid).await?;
    Ok(StatusCode::NO_CONTENT)
}
