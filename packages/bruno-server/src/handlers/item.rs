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
    models::{
        item::{Request, Settings},
        token::Claims
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    pub name: String,
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<String>,
    pub seq: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRequestBody {
    pub name: String,
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<String>,
    pub seq: Option<f64>,
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemRequest {
    pub name: Option<String>,
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub docs: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MoveItemRequest {
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<String>,
    pub seq: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CloneItemRequest {
    pub name: String,
    #[serde(rename = "parentUid")]
    pub parent_uid: Option<String>,
}

pub async fn create_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_uid): Path<String>,
    JsonBody(body): JsonBody<CreateFolderRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.create_folder(&collection_uid, user_id, body.name, body.parent_uid, body.seq).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": item }))))
}

pub async fn create_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_uid): Path<String>,
    JsonBody(body): JsonBody<CreateRequestBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;

    let method = body.request.as_ref().map(|r| r.method.clone()).unwrap_or_else(|| "GET".to_string());
    let url = body.request.as_ref().map(|r| r.url.clone()).unwrap_or_default();

    let mut item = state.item_service
        .create_request(&collection_uid, user_id, body.name, body.parent_uid, body.seq, method, url)
        .await?;

    // Merge full request/settings if provided
    if let Some(request) = body.request { item.request = Some(request); }
    if let Some(settings) = body.settings { item.settings = Some(settings); }
    if let Some(filename) = body.filename { item.filename = Some(filename); }

    Ok((StatusCode::CREATED, Json(json!({ "data": item }))))
}

pub async fn list_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_uid): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let items = state.item_service.list_by_collection(&collection_uid, user_id).await?;
    Ok(Json(json!({ "data": items })))
}

pub async fn get_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_uid): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.get(&item_uid, user_id).await?;
    Ok(Json(json!({ "data": item })))
}

pub async fn update_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_uid): Path<String>,
    JsonBody(body): JsonBody<UpdateItemRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.update(&item_uid, user_id, body.name, body.request, body.settings, body.docs).await?;
    Ok(Json(json!({ "data": item })))
}

pub async fn delete_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_uid): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.item_service.delete(&item_uid, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn move_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_uid): Path<String>,
    JsonBody(body): JsonBody<MoveItemRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.move_item(&item_uid, user_id, body.parent_uid, body.seq).await?;
    Ok(Json(json!({ "data": item })))
}

pub async fn clone_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_uid): Path<String>,
    JsonBody(body): JsonBody<CloneItemRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let cloned = state.item_service.clone_item(&item_uid, user_id, body.name, body.parent_uid).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": cloned }))))
}
