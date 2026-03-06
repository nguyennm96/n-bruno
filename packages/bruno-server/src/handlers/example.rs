use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use bson::doc;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::AppResult,
    middleware::extract_user_id,
    models::token::Claims,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateExampleRequest {
    /// Client-provided UID; server generates one if omitted.
    pub uid: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status_code: u16,
    pub status_text: Option<String>,
    pub headers: Option<serde_json::Map<String, Value>>,
    pub body: Option<String>,
    pub request_snapshot: Option<Value>,
    pub response_time: Option<i64>,
    pub response_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExampleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status_code: Option<u16>,
    pub status_text: Option<String>,
    pub headers: Option<serde_json::Map<String, Value>>,
    pub body: Option<String>,
    pub request_snapshot: Option<Value>,
    pub response_time: Option<i64>,
    pub response_size: Option<i64>,
}

pub async fn create_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
    JsonBody(body): JsonBody<CreateExampleRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let headers = json_map_to_doc(body.headers.unwrap_or_default());
    let example = state.example_service.create(
        &item_id, user_id,
        body.uid, body.name, body.description,
        body.status_code, body.status_text,
        headers, body.body,
        body.request_snapshot, body.response_time, body.response_size,
    ).await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": example }))))
}

pub async fn list_examples(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let examples = state.example_service.list(&item_id, user_id).await?;
    Ok(Json(json!({ "data": examples })))
}

pub async fn list_collection_examples(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let examples = state.example_service.list_for_collection(&collection_id, user_id).await?;
    Ok(Json(json!({ "data": examples })))
}

pub async fn update_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(example_id): Path<String>,
    JsonBody(body): JsonBody<UpdateExampleRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let example = state.example_service.update(
        &example_id, user_id,
        body.name, body.description,
        body.status_code, body.status_text,
        body.headers.map(json_map_to_doc),
        body.body, body.request_snapshot,
        body.response_time, body.response_size,
    ).await?;
    Ok(Json(json!({ "data": example })))
}

pub async fn delete_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(example_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.example_service.delete(&example_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

fn json_map_to_doc(map: serde_json::Map<String, Value>) -> bson::Document {
    let mut doc = doc! {};
    for (k, v) in map {
        if let Some(s) = v.as_str() {
            doc.insert(k, s.to_string());
        }
    }
    doc
}
