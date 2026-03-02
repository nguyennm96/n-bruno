use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};

use crate::state::AppState;

pub async fn health_check(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "version": env!("CARGO_PKG_VERSION"),
            "env": state.config.app_env,
        })),
    )
}
