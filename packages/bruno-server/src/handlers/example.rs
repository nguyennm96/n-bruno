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
    pub name: String,
    pub status_code: u16,
    pub headers: Option<serde_json::Map<String, Value>>,
    pub body: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExampleRequest {
    pub name: Option<String>,
    pub status_code: Option<u16>,
    pub body: Option<String>,
}

pub async fn create_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
    JsonBody(body): JsonBody<CreateExampleRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    // Convert JSON map to BSON Document
    let headers = json_map_to_doc(body.headers);
    let example = state.example_service.create(&item_id, user_id, body.name, body.status_code, headers, body.body).await?;
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

pub async fn update_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(example_id): Path<String>,
    JsonBody(body): JsonBody<UpdateExampleRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let example = state.example_service.update(&example_id, user_id, body.name, body.status_code, body.body).await?;
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

fn json_map_to_doc(map: Option<serde_json::Map<String, Value>>) -> bson::Document {
    let mut doc = doc! {};
    if let Some(m) = map {
        for (k, v) in m {
            if let Some(s) = v.as_str() {
                doc.insert(k, s.to_string());
            }
        }
    }
    doc
}
