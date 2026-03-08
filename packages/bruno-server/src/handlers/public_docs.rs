use axum::{
    extract::{Extension, Multipart, Path, State},
    http::StatusCode,
    response::Json,
    Json as JsonBody,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use bson::oid::ObjectId;
use serde_json::{json, Value};

use crate::{
    errors::{AppError, AppResult},
    middleware::extract_user_id,
    models::{
        public_docs::{
            PublishDocsRequest, UpdateDocsRequest, VerifyPasswordRequest,
        },
        token::Claims,
    },
    state::AppState,
};

// ── Protected Endpoints (require workspace authentication) ───────────────

/// POST /api/collections/:id/docs/publish
/// Publish collection documentation
pub async fn publish_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<PublishDocsRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required to publish documentation".into(),
        ));
    }

    // Hash password if visibility is Password
    let visibility = match body.visibility {
        crate::models::public_docs::DocVisibility::Password { hash } => {
            // The hash field is actually the plain password from the client
            let hashed_password = state.public_docs_service.hash_password(&hash)?;
            crate::models::public_docs::DocVisibility::Password {
                hash: hashed_password,
            }
        }
        other => other,
    };

    // Publish the docs
    let result = state
        .public_docs_service
        .publish(&collection_id, visibility, body.settings, body.custom_slug)
        .await?;

    Ok((StatusCode::CREATED, Json(json!({ "data": result }))))
}

/// PATCH /api/collections/:id/docs
/// Update documentation settings/visibility
pub async fn update_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<UpdateDocsRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required to update documentation".into(),
        ));
    }

    // Hash password if visibility is being updated to Password
    let update_req = UpdateDocsRequest {
        visibility: match body.visibility {
            Some(crate::models::public_docs::DocVisibility::Password { hash }) => {
                let hashed_password = state.public_docs_service.hash_password(&hash)?;
                Some(crate::models::public_docs::DocVisibility::Password {
                    hash: hashed_password,
                })
            }
            other => other,
        },
        settings: body.settings,
    };

    // Update the docs
    state
        .public_docs_service
        .update(&collection_id, update_req)
        .await?;

    Ok(Json(json!({ "message": "Documentation updated successfully" })))
}

/// DELETE /api/collections/:id/docs/unpublish
/// Unpublish documentation
pub async fn unpublish_docs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required to unpublish documentation".into(),
        ));
    }

    // Unpublish the docs
    state
        .public_docs_service
        .unpublish(&collection_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/collections/:id/docs/status
/// Get documentation status (for collection owner)
pub async fn get_docs_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let _collection = state.collection_service.get(&collection_id, user_id).await?;

    // Get status
    let status = state
        .public_docs_service
        .get_status(&collection_id)
        .await?;

    Ok(Json(json!({ "data": status })))
}

// ── Public Endpoints (no auth required) ──────────────────────────────────

/// GET /api/public/docs/:slug
/// Fetch published collection documentation (public access)
pub async fn get_public_docs(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    auth_header: Option<TypedHeader<Authorization<Bearer>>>,
) -> AppResult<Json<Value>> {
    // Get collection by slug
    let collection = state
        .public_docs_service
        .get_collection_by_slug(&slug)
        .await?;

    let public_docs = collection
        .public_docs
        .as_ref()
        .ok_or_else(|| AppError::NotFound("Documentation not found".into()))?;

    // Check visibility permissions
    match &public_docs.visibility {
        crate::models::public_docs::DocVisibility::Public => {
            // No check needed
        }
        crate::models::public_docs::DocVisibility::Password { .. } => {
            // Check for doc token in header
            if let Some(TypedHeader(auth)) = auth_header {
                // Verify the doc token
                verify_doc_token(&state, auth.token(), &slug)?;
            } else {
                return Err(AppError::Unauthorized(
                    "Password required to access this documentation".into(),
                ));
            }
        }
        crate::models::public_docs::DocVisibility::WorkspaceMembers => {
            // Require valid JWT token for workspace member
            if let Some(TypedHeader(auth)) = auth_header {
                let user_id = verify_jwt_token(&state, auth.token())?;
                // Check if user is workspace member
                state
                    .workspace_service
                    .get_with_role(&collection.workspace_uid, user_id)
                    .await?;
            } else {
                return Err(AppError::Unauthorized(
                    "Workspace membership required to access this documentation".into(),
                ));
            }
        }
        crate::models::public_docs::DocVisibility::CustomList { user_ids } => {
            // Require valid JWT token and check if user is in the list
            if let Some(TypedHeader(auth)) = auth_header {
                let user_id = verify_jwt_token(&state, auth.token())?;
                let user_id_str = user_id.to_hex();
                if !user_ids.contains(&user_id_str) {
                    return Err(AppError::Forbidden(
                        "You do not have permission to access this documentation".into(),
                    ));
                }
            } else {
                return Err(AppError::Unauthorized(
                    "Authentication required to access this documentation".into(),
                ));
            }
        }
    }

    // Increment view count
    let _ = state.public_docs_service.increment_views(&slug).await;

    // Get the full documentation response
    let docs = state.public_docs_service.get_by_slug(&slug).await?;

    Ok(Json(json!({ "data": docs })))
}

/// POST /api/public/docs/:slug/verify-password
/// Verify password for password-protected docs
pub async fn verify_password(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    JsonBody(body): JsonBody<VerifyPasswordRequest>,
) -> AppResult<Json<Value>> {
    // Get collection by slug
    let collection = state
        .public_docs_service
        .get_collection_by_slug(&slug)
        .await?;

    let public_docs = collection
        .public_docs
        .as_ref()
        .ok_or_else(|| AppError::NotFound("Documentation not found".into()))?;

    // Check if it's password-protected
    match &public_docs.visibility {
        crate::models::public_docs::DocVisibility::Password { hash } => {
            if state
                .public_docs_service
                .verify_password(&body.password, hash)?
            {
                // Generate short-lived token for this doc (24 hours)
                let token = generate_doc_token(&state, &slug)?;
                Ok(Json(json!({ "token": token })))
            } else {
                Err(AppError::Unauthorized("Invalid password".into()))
            }
        }
        _ => Err(AppError::BadRequest(
            "This documentation is not password-protected".into(),
        )),
    }
}

// ── Helper functions ──────────────────────────────────────────────────────

/// Verify JWT token and extract user ID
fn verify_jwt_token(state: &AppState, token: &str) -> AppResult<ObjectId> {
    use jsonwebtoken::{decode, DecodingKey, Validation};

    let decoding_key = DecodingKey::from_secret(state.config.jwt_secret.as_bytes());
    let validation = Validation::default();

    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|_| AppError::Unauthorized("Invalid token".into()))?;

    ObjectId::parse_str(&token_data.claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in token".into()))
}

/// Generate a doc-specific token (simple JWT with slug claim)
fn generate_doc_token(state: &AppState, slug: &str) -> AppResult<String> {
    use chrono::{Duration, Utc};
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct DocClaims {
        slug: String,
        exp: i64,
    }

    let exp = Utc::now() + Duration::hours(24);
    let claims = DocClaims {
        slug: slug.to_string(),
        exp: exp.timestamp(),
    };

    let encoding_key = EncodingKey::from_secret(state.config.jwt_secret.as_bytes());
    encode(&Header::default(), &claims, &encoding_key)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {e}")))
}

/// Verify doc-specific token
fn verify_doc_token(state: &AppState, token: &str, slug: &str) -> AppResult<()> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct DocClaims {
        slug: String,
        exp: i64,
    }

    let decoding_key = DecodingKey::from_secret(state.config.jwt_secret.as_bytes());
    let validation = Validation::default();

    let token_data = decode::<DocClaims>(token, &decoding_key, &validation)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))?;

    if token_data.claims.slug != slug {
        return Err(AppError::Unauthorized(
            "Token is not valid for this documentation".into(),
        ));
    }

    Ok(())
}

// ── File Upload Endpoints ─────────────────────────────────────────────────

/// POST /api/collections/:id/docs/upload-css
/// Upload custom CSS file
pub async fn upload_custom_css(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required to upload custom CSS".into(),
        ));
    }

    // Process multipart form data
    let mut css_content = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        if name == "css" {
            let data = field.bytes().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read file data: {}", e))
            })?;

            css_content = Some(String::from_utf8(data.to_vec()).map_err(|_| {
                AppError::BadRequest("CSS file must be valid UTF-8".into())
            })?);
        }
    }

    let css = css_content.ok_or_else(|| AppError::BadRequest("No CSS file provided".into()))?;

    // Validate CSS size (max 100KB)
    if css.len() > 100 * 1024 {
        return Err(AppError::BadRequest("CSS file too large (max 100KB)".into()));
    }

    // Store CSS in the collection's public_docs settings
    state
        .public_docs_service
        .update_custom_css(&collection_id, css.clone())
        .await?;

    Ok(Json(json!({
        "message": "Custom CSS uploaded successfully",
        "size": css.len()
    })))
}

/// POST /api/collections/:id/docs/upload-logo
/// Upload custom logo file
pub async fn upload_custom_logo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required to upload custom logo".into(),
        ));
    }

    // Process multipart form data
    let mut logo_data = None;
    let mut content_type = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        if name == "logo" {
            content_type = field.content_type().map(|ct| ct.to_string());

            let data = field.bytes().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read file data: {}", e))
            })?;

            logo_data = Some(data);
        }
    }

    let logo_bytes = logo_data.ok_or_else(|| AppError::BadRequest("No logo file provided".into()))?;

    // Validate file type (must be image)
    let ct = content_type.ok_or_else(|| AppError::BadRequest("No content type provided".into()))?;
    if !ct.starts_with("image/") {
        return Err(AppError::BadRequest("Logo must be an image file".into()));
    }

    // Validate size (max 2MB)
    if logo_bytes.len() > 2 * 1024 * 1024 {
        return Err(AppError::BadRequest("Logo file too large (max 2MB)".into()));
    }

    // Convert to base64 data URL
    let base64_data = base64_encode(&logo_bytes);
    let data_url = format!("data:{};base64,{}", ct, base64_data);

    // Store logo URL in the collection's public_docs settings
    state
        .public_docs_service
        .update_custom_logo(&collection_id, data_url.clone())
        .await?;

    Ok(Json(json!({
        "message": "Custom logo uploaded successfully",
        "size": logo_bytes.len(),
        "logo_url": data_url
    })))
}

/// DELETE /api/collections/:id/docs/custom-css
/// Remove custom CSS
pub async fn delete_custom_css(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required".into(),
        ));
    }

    state
        .public_docs_service
        .update_custom_css(&collection_id, String::new())
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/collections/:id/docs/custom-logo
/// Remove custom logo
pub async fn delete_custom_logo(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;

    // Get collection to verify workspace access
    let collection = state.collection_service.get(&collection_id, user_id).await?;

    // Verify user has write permissions
    let (_, role) = state
        .workspace_service
        .get_with_role(&collection.workspace_uid, user_id)
        .await?;

    if !role.can_write() {
        return Err(AppError::Forbidden(
            "Editor or Owner role required".into(),
        ));
    }

    state
        .public_docs_service
        .update_custom_logo(&collection_id, String::new())
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/collections/docs/check-slug/:slug
/// Check if a slug is available
pub async fn check_slug_availability(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Json<Value>> {
    let available = !state.public_docs_service.slug_exists(&slug).await?;

    Ok(Json(json!({
        "available": available,
        "slug": slug
    })))
}

// Helper function for base64 encoding
fn base64_encode(data: &[u8]) -> String {
    use base64::{engine::general_purpose, Engine as _};
    general_purpose::STANDARD.encode(data)
}
