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
        item::{Request, RequestBody, Settings},
        token::Claims
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest {
    pub name: String,
    pub parent_item_id: Option<String>,
    pub sort_order: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRequestBody {
    pub name: String,
    pub parent_item_id: Option<String>,
    pub sort_order: Option<f64>,
    
    // NEW: Accept nested request object (preferred)
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,
    
    // OLD: Keep backward compatibility
    pub method: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemRequest {
    pub name: Option<String>,
    
    // NEW: Accept nested request object
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    
    // OLD: Keep backward compatibility
    pub method: Option<String>,
    pub url: Option<String>,
    pub body: Option<RequestBody>,
}

#[derive(Debug, Deserialize)]
pub struct MoveItemRequest {
    pub parent_item_id: Option<String>,
    pub sort_order: Option<f64>,
}

pub async fn create_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<CreateFolderRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.create_folder(&collection_id, user_id, body.name, body.parent_item_id, body.sort_order).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": item }))))
}

pub async fn create_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<CreateRequestBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    
    // Support both old (flat) and new (nested) formats
    let method = body.request.as_ref()
        .map(|r| r.method.clone())
        .or(body.method)
        .unwrap_or_else(|| "GET".to_string());
    
    let url = body.request.as_ref()
        .map(|r| r.url.clone())
        .or(body.url)
        .unwrap_or_default();
    
    // Create item with nested structure
    let mut item = state.item_service
        .create_request(&collection_id, user_id, body.name, body.parent_item_id, body.sort_order, method, url)
        .await?;
    
    // If nested request provided, update with full details
    if let Some(request) = body.request {
        item.request = Some(request);
    }
    
    if let Some(settings) = body.settings {
        item.settings = Some(settings);
    }
    
    if let Some(filename) = body.filename {
        item.filename = Some(filename);
    }
    
    Ok((StatusCode::CREATED, Json(json!({ "data": item }))))
}

pub async fn list_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let items = state.item_service.list_by_collection(&collection_id, user_id).await?;
    Ok(Json(json!({ "data": items })))
}

pub async fn get_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.get(&item_id, user_id).await?;
    Ok(Json(json!({ "data": item })))
}

pub async fn update_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
    JsonBody(body): JsonBody<UpdateItemRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.update(&item_id, user_id, body.name, body.method, body.url, body.body).await?;
    Ok(Json(json!({ "data": item })))
}

pub async fn delete_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.item_service.delete(&item_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn move_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
    JsonBody(body): JsonBody<MoveItemRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.move_item(&item_id, user_id, body.parent_item_id, body.sort_order).await?;
    Ok(Json(json!({ "data": item })))
}
