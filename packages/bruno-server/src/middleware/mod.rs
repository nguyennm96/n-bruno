use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use bson::oid::ObjectId;

use crate::{
    errors::{AppError, AppResult},
    models::token::Claims,
    state::AppState,
};

/// Extracts and validates JWT from Authorization header.
/// Inserts `Claims` as a request extension.
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let claims = extract_claims(&request, &state)?;
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

fn extract_claims(request: &Request, state: &AppState) -> AppResult<Claims> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".into()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::Unauthorized("Authorization header must start with 'Bearer '".into()));
    }

    let token = &auth_header["Bearer ".len()..];
    state.auth_service.verify_access_token(token)
}

/// Helper to extract user_id (ObjectId) from claims in request extensions.
pub fn extract_user_id(claims: &Claims) -> AppResult<ObjectId> {
    ObjectId::parse_str(&claims.sub)
        .map_err(|_| AppError::Internal("Invalid user ID in token".into()))
}
