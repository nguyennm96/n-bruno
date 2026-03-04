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
    pub bruno_config: Option<Value>,
    pub root: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct CloneCollectionRequest {
    pub name: String,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResequenceItem {
    pub id: String,
    pub sort_order: f64,
}

#[derive(Debug, Deserialize)]
pub struct ResequenceRequest {
    pub items: Vec<ResequenceItem>,
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
    let col = state.collection_service.update(&collection_id, user_id, body.name, body.description, body.bruno_config, body.root).await?;
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

pub async fn clone_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<CloneCollectionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let cloned = state.collection_service
        .clone_collection(&collection_id, user_id, body.name, body.workspace_id)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": cloned }))))
}

pub async fn resequence_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<ResequenceRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let updates: Vec<(String, f64)> = body.items
        .into_iter()
        .map(|item| (item.id, item.sort_order))
        .collect();

    let updated = state.collection_service
        .resequence_items(&collection_id, user_id, updates)
        .await?;

    Ok(Json(json!({
        "data": {
            "updated": updated,
            "failed": 0
        }
    })))
}
