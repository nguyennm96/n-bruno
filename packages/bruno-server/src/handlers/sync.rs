use axum::{
    extract::{Extension, Path, Query, State},
    response::Json,
};
use chrono::DateTime;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{errors::AppResult, middleware::extract_user_id, models::token::Claims, state::AppState};

#[derive(Deserialize)]
pub struct SyncQuery {
    pub since: Option<String>, // ISO 8601 / RFC 3339 timestamp
}

pub async fn get_workspace_changes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_uid): Path<String>,
    Query(params): Query<SyncQuery>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let since = params
        .since
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    let changes = state.sync_service.get_changes(&workspace_uid, user_id, since).await?;
    Ok(Json(json!({ "data": changes })))
}
