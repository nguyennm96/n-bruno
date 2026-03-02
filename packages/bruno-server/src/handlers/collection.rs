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
    models::token::Claims,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCollectionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
}

pub async fn create_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<CreateCollectionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let col = state.collection_service.create(&workspace_id, user_id, body.name, body.description).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": col }))))
}

pub async fn list_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let collections = state.collection_service.list(&workspace_id, user_id).await?;
    Ok(Json(json!({ "data": collections })))
}

pub async fn get_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let col = state.collection_service.get(&collection_id, user_id).await?;
    Ok(Json(json!({ "data": col })))
}

pub async fn update_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<UpdateCollectionRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let col = state.collection_service.update(&collection_id, user_id, body.name, body.description).await?;
    Ok(Json(json!({ "data": col })))
}

pub async fn delete_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.collection_service.delete(&collection_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
