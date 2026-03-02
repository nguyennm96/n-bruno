use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::AppResult,
    middleware::extract_user_id,
    models::{environment::EnvVariable, token::Claims},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateEnvRequest {
    pub name: String,
    pub variables: Option<Vec<EnvVariable>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEnvRequest {
    pub name: Option<String>,
    pub variables: Option<Vec<EnvVariable>>,
}

pub async fn create_environment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<CreateEnvRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let env = state.environment_service.create(&workspace_id, user_id, body.name, body.variables.unwrap_or_default()).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": env }))))
}

pub async fn list_environments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let envs = state.environment_service.list(&workspace_id, user_id).await?;
    Ok(Json(json!({ "data": envs })))
}

pub async fn update_environment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(env_id): Path<String>,
    JsonBody(body): JsonBody<UpdateEnvRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let env = state.environment_service.update(&env_id, user_id, body.name, body.variables).await?;
    Ok(Json(json!({ "data": env })))
}

pub async fn delete_environment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(env_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.environment_service.delete(&env_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
