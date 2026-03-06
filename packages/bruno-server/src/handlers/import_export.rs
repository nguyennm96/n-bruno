use axum::{
    extract::{Extension, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Json, Response},
    Json as JsonBody,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::AppResult,
    middleware::extract_user_id,
    models::token::Claims,
    services::import_export::postman::ImportConflict,
    state::AppState,
};

// ── Import ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ImportPostmanBody {
    pub json: String,
    pub conflict: Option<ImportConflict>,
}

#[derive(Debug, Deserialize)]
pub struct ImportInsomniaBody {
    pub json: String,
}

pub async fn import_postman(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<ImportPostmanBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let conflict = body.conflict.unwrap_or(ImportConflict::Error);

    let result = state.postman_service.import(&workspace_id, user_id, &body.json, conflict).await?;

    Ok((StatusCode::CREATED, Json(json!({
        "data": {
            "collectionUid": result.collection_uid,
            "collection_name": result.collection_name,
            "imported": {
                "folders": result.stats.folders_created,
                "requests": result.stats.requests_created,
                "examples": result.stats.examples_created,
                "environments": result.stats.environments_created,
            },
            "warnings": result.stats.warnings,
        }
    }))))
}

pub async fn import_insomnia(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    JsonBody(body): JsonBody<ImportInsomniaBody>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let result = state.insomnia_service.import(&workspace_id, user_id, &body.json).await?;

    Ok((StatusCode::CREATED, Json(json!({
        "data": {
            "collectionUid": result.collection_uid,
            "collection_name": result.collection_name,
            "imported": {
                "folders": result.stats.folders_created,
                "requests": result.stats.requests_created,
            },
        }
    }))))
}

// ── Export ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub format: Option<String>,
    pub server_url: Option<String>,
    pub host: Option<String>,
    pub base_path: Option<String>,
}

pub async fn export_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Query(params): Query<ExportQuery>,
) -> AppResult<Response> {
    let user_id = extract_user_id(&claims)?;
    let format = params.format.as_deref().unwrap_or("postman");

    match format {
        "postman" => {
            let pm = state.postman_service.export_collection(&collection_id, user_id).await?;
            let json_str = serde_json::to_string_pretty(&pm)
                .map_err(|e| crate::errors::AppError::Internal(e.to_string()))?;
            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/json"),
                 (header::CONTENT_DISPOSITION, "attachment; filename=\"collection.postman.json\"")],
                json_str,
            ).into_response())
        }
        "openapi" | "openapi3" => {
            let spec = state.openapi_service.export_openapi3(
                &collection_id,
                user_id,
                params.server_url.clone(),
            ).await?;
            let json_str = serde_json::to_string_pretty(&spec)
                .map_err(|e| crate::errors::AppError::Internal(e.to_string()))?;
            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/json"),
                 (header::CONTENT_DISPOSITION, "attachment; filename=\"openapi.json\"")],
                json_str,
            ).into_response())
        }
        "swagger" | "swagger2" => {
            let spec = state.openapi_service.export_swagger2(
                &collection_id,
                user_id,
                params.host.clone(),
                params.base_path.clone(),
            ).await?;
            let json_str = serde_json::to_string_pretty(&spec)
                .map_err(|e| crate::errors::AppError::Internal(e.to_string()))?;
            Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/json"),
                 (header::CONTENT_DISPOSITION, "attachment; filename=\"swagger.json\"")],
                json_str,
            ).into_response())
        }
        _ => Err(crate::errors::AppError::BadRequest(
            format!("Unknown format '{}'. Valid: postman, openapi, swagger", format)
        )),
    }
}

pub async fn export_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Response> {
    let user_id = extract_user_id(&claims)?;
    let collections = state.postman_service.export_workspace(&workspace_id, user_id).await?;
    let json_str = serde_json::to_string_pretty(&collections)
        .map_err(|e| crate::errors::AppError::Internal(e.to_string()))?;
    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json"),
         (header::CONTENT_DISPOSITION, "attachment; filename=\"workspace.postman.json\"")],
        json_str,
    ).into_response())
}
