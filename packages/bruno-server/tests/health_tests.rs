mod helpers;

use axum::http::StatusCode;
use serde_json::json;

#[tokio::test]
async fn health_returns_200_with_status_ok() {
    let app = helpers::TestApp::spawn().await;
    let resp = app.server.get("/api/health").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["status"], "ok");
    assert!(body["version"].is_string());
    assert!(body["env"].is_string());
}

#[tokio::test]
async fn health_requires_no_auth() {
    let app = helpers::TestApp::spawn().await;
    // No Authorization header — must still succeed.
    let resp = app.server.get("/api/health").await;
    resp.assert_status_ok();
}
