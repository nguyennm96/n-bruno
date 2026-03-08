use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Authentication failed: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl From<mongodb::error::Error> for AppError {
    fn from(e: mongodb::error::Error) -> Self {
        tracing::error!("MongoDB error: {:?}", e);
        AppError::Database(e.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized(format!("Invalid token: {}", e))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", msg.as_str()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, "FORBIDDEN", msg.as_str()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.as_str()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg.as_str()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg.as_str()),
            AppError::Validation(msg) => (StatusCode::UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", msg.as_str()),
            AppError::Database(msg) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", msg.as_str()),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", msg.as_str()),
            AppError::ServiceUnavailable(msg) => (StatusCode::SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", msg.as_str()),
        };

        let body = Json(json!({
            "error": {
                "code": code,
                "message": message,
            }
        }));

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    fn status_of(e: AppError) -> StatusCode {
        e.into_response().status()
    }

    fn body_of(e: AppError) -> serde_json::Value {
        let resp = e.into_response();
        let bytes = futures::executor::block_on(async {
            use axum::body::to_bytes;
            to_bytes(resp.into_body(), usize::MAX).await.unwrap()
        });
        serde_json::from_slice(&bytes).unwrap()
    }

    #[test]
    fn unauthorized_maps_to_401() {
        assert_eq!(status_of(AppError::Unauthorized("x".into())), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn forbidden_maps_to_403() {
        assert_eq!(status_of(AppError::Forbidden("x".into())), StatusCode::FORBIDDEN);
    }

    #[test]
    fn not_found_maps_to_404() {
        assert_eq!(status_of(AppError::NotFound("x".into())), StatusCode::NOT_FOUND);
    }

    #[test]
    fn bad_request_maps_to_400() {
        assert_eq!(status_of(AppError::BadRequest("x".into())), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn conflict_maps_to_409() {
        assert_eq!(status_of(AppError::Conflict("x".into())), StatusCode::CONFLICT);
    }

    #[test]
    fn internal_maps_to_500() {
        assert_eq!(status_of(AppError::Internal("x".into())), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn validation_maps_to_422() {
        assert_eq!(status_of(AppError::Validation("x".into())), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[test]
    fn database_maps_to_500() {
        assert_eq!(status_of(AppError::Database("x".into())), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn response_body_has_error_object() {
        let v = body_of(AppError::NotFound("thing not found".into()));
        assert_eq!(v["error"]["code"], "NOT_FOUND");
        // message is the raw inner string, not the thiserror display string
        assert_eq!(v["error"]["message"], "thing not found");
    }

    #[test]
    fn from_jwt_error_is_unauthorized() {
        use jsonwebtoken::{decode, DecodingKey, Validation, errors::ErrorKind};
        // Force a JWT error by decoding garbage
        let err = decode::<serde_json::Value>(
            "not.a.jwt",
            &DecodingKey::from_secret(b"secret"),
            &Validation::default(),
        )
        .unwrap_err();
        let app_err = AppError::from(err);
        assert!(matches!(app_err, AppError::Unauthorized(_)));
    }
}
