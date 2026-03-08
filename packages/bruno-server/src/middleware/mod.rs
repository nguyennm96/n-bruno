use std::{net::SocketAddr, time::Instant};

use axum::{
    extract::{ConnectInfo, Request, State},
    middleware::Next,
    response::Response,
};
use bson::oid::ObjectId;
use tracing::Instrument;
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::token::Claims,
    state::AppState,
};

// ── Request Logger ────────────────────────────────────────────────────────────

/// Structured per-request/response logger.
///
/// Logs one line per completed request that includes:
///   `request_id`, `method`, `path`, `query`, `ip`, `user_agent`,
///   `content_type`, `content_length_bytes`, `status`, `latency_ms`, `user_id`
///
/// `user_id` is left empty for public routes and filled in by
/// `auth_middleware` (which runs inside the span created here).
///
/// Log level is driven by the response status:
///   - 5xx → ERROR
///   - 4xx → WARN
///   - 2xx / 3xx → INFO
pub async fn request_logger(
    connect_info: Option<ConnectInfo<SocketAddr>>,
    request: Request,
    next: Next,
) -> Response {
    let request_id = Uuid::new_v4().to_string();
    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let query = request.uri().query().unwrap_or("").to_string();

    // Prefer X-Forwarded-For (reverse-proxy setups); fall back to TCP peer addr.
    let ip = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| connect_info.map(|ci| ci.0.ip().to_string()))
        .unwrap_or_else(|| "-".to_string());

    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();

    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();

    let content_length_bytes: u64 = request
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let start = Instant::now();

    // Build a span with placeholder fields that will be filled after the response.
    // auth_middleware — which runs inside next.run() — can call
    // `tracing::Span::current().record("user_id", &sub)` to populate user_id.
    let span = tracing::info_span!(
        "http",
        request_id  = %request_id,
        method      = %method,
        path        = %path,
        query       = %query,
        ip          = %ip,
        user_agent  = %user_agent,
        content_type        = %content_type,
        content_length_bytes = content_length_bytes,
        // filled in below after the response
        status      = tracing::field::Empty,
        latency_ms  = tracing::field::Empty,
        // filled in by auth_middleware when present
        user_id     = tracing::field::Empty,
    );

    // Run the rest of the middleware chain (including auth + handler) inside the span
    // so that auth_middleware can record user_id into the current span.
    let response = next.run(request).instrument(span.clone()).await;

    let latency_ms = start.elapsed().as_millis();
    let status = response.status().as_u16();

    span.record("status", status);
    span.record("latency_ms", latency_ms);

    // Emit the final log event at a level matching the status code.
    span.in_scope(|| {
        if status >= 500 {
            tracing::error!("← response");
        } else if status >= 400 {
            tracing::warn!("← response");
        } else {
            tracing::info!("← response");
        }
    });

    response
}

// ── Auth Middleware ───────────────────────────────────────────────────────────

/// Extracts and validates JWT from Authorization header.
/// Inserts `Claims` as a request extension and records `user_id`
/// in the active tracing span (set by `request_logger`).
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let claims = extract_claims(&request, &state)?;

    // Propagate user identity to the enclosing request_logger span.
    tracing::Span::current().record("user_id", &claims.sub.as_str());

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
        return Err(AppError::Unauthorized(
            "Authorization header must start with 'Bearer '".into(),
        ));
    }

    let token = &auth_header["Bearer ".len()..];
    state.auth_service.verify_access_token(token)
}

/// Helper to extract user_id (ObjectId) from claims in request extensions.
pub fn extract_user_id(claims: &Claims) -> AppResult<ObjectId> {
    ObjectId::parse_str(&claims.sub)
        .map_err(|_| AppError::Internal("Invalid user ID in token".into()))
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::token::Claims;

    fn make_claims(sub: &str) -> Claims {
        Claims {
            sub: sub.to_string(),
            email: "t@test.com".into(),
            name: "T".into(),
            exp: 9999999999,
            iat: 0,
        }
    }

    #[test]
    fn extract_user_id_valid_hex() {
        let oid = bson::oid::ObjectId::new();
        let claims = make_claims(&oid.to_hex());
        let result = extract_user_id(&claims);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), oid);
    }

    #[test]
    fn extract_user_id_invalid_hex_returns_internal_error() {
        let claims = make_claims("not-a-valid-object-id");
        let result = extract_user_id(&claims);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Internal(_)));
    }

    #[test]
    fn extract_user_id_empty_string_returns_internal_error() {
        let claims = make_claims("");
        assert!(matches!(extract_user_id(&claims), Err(AppError::Internal(_))));
    }
}
