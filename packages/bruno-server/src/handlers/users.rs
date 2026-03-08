use axum::{
    extract::{Extension, Query, State},
    response::Json,
};
use bson::doc;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    errors::{AppError, AppResult},
    middleware::extract_user_id,
    models::{token::Claims, user::User},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct UserSearchQuery {
    pub email: String,
}

/// GET /api/users/search?email=xxx — find a user by exact email (authenticated).
/// Returns public fields only (id, name, email). Used for invite autocomplete.
pub async fn search_user(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<UserSearchQuery>,
) -> AppResult<Json<Value>> {
    let _caller_id = extract_user_id(&claims)?;

    if params.email.is_empty() {
        return Err(AppError::Validation("email query parameter is required".into()));
    }

    let users = state.db.collection::<User>("users");
    let user = users
        .find_one(doc! { "email": params.email.to_lowercase() })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    match user {
        Some(u) => Ok(Json(json!({ "data": {
            "id": u.id.unwrap_or_default().to_hex(),
            "name": u.name,
            "email": u.email,
        }}))),
        None => Ok(Json(json!({ "data": null }))),
    }
}

