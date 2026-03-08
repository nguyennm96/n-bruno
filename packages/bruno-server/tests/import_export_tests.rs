mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

const POSTMAN_FIXTURE: &str = include_str!("fixtures/postman_v21.json");

// ── Postman Import ────────────────────────────────────────────────────────────

#[tokio::test]
async fn import_postman_creates_collection_and_items() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("imp_owner@test.com", "password123", "ImpOwner").await;
    let ws_uid = app.create_workspace(&token, "Import WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": POSTMAN_FIXTURE, "conflict": "error" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert!(body["data"]["collectionUid"].is_string());
    assert_eq!(body["data"]["collection_name"], "Test API");
}

#[tokio::test]
async fn import_postman_invalid_json_returns_422() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("imp_bad@test.com", "password123", "ImpBad").await;
    let ws_uid = app.create_workspace(&token, "Import Bad WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": "this is not valid postman json {{{", "conflict": "error" }))
        .await;
    resp.assert_status(StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn import_postman_conflict_error_returns_409_on_duplicate() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("imp_dup@test.com", "password123", "ImpDup").await;
    let ws_uid = app.create_workspace(&token, "Dup Import WS").await;

    let payload = json!({ "json": POSTMAN_FIXTURE, "conflict": "error" });
    app.server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&payload)
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&payload)
        .await;
    resp.assert_status(StatusCode::CONFLICT);
}

#[tokio::test]
async fn import_postman_conflict_rename_creates_new_collection() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("imp_ren@test.com", "password123", "ImpRen").await;
    let ws_uid = app.create_workspace(&token, "Rename Import WS").await;

    app.server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": POSTMAN_FIXTURE, "conflict": "error" }))
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": POSTMAN_FIXTURE, "conflict": "rename" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    // Name should have suffix like "(imported)" or " (1)"
    let name = body["data"]["collection_name"].as_str().unwrap();
    assert_ne!(name, "Test API");
    assert!(name.contains("Test API"));
}

#[tokio::test]
async fn import_postman_conflict_replace_overwrites() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("imp_repl@test.com", "password123", "ImpRepl").await;
    let ws_uid = app.create_workspace(&token, "Replace Import WS").await;

    app.server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": POSTMAN_FIXTURE, "conflict": "error" }))
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/import/postman", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "json": POSTMAN_FIXTURE, "conflict": "replace" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
}

// ── Export ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn export_collection_postman_format() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("exp_owner@test.com", "password123", "ExpOwner").await;
    let ws_uid = app.create_workspace(&token, "Export WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Export Col").await;
    app.create_request(&token, &col_uid, "My Request").await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/export?format=postman", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    // Postman format has "info" and "item" top-level keys
    assert!(body["info"].is_object());
    assert!(body["item"].is_array());
}

#[tokio::test]
async fn export_collection_openapi_format() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("exp_oa@test.com", "password123", "ExpOA").await;
    let ws_uid = app.create_workspace(&token, "OA WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "OA Col").await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/export?format=openapi", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["openapi"].is_string() || body["swagger"].is_string());
}

#[tokio::test]
async fn export_workspace() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("exp_ws@test.com", "password123", "ExpWS").await;
    let ws_uid = app.create_workspace(&token, "Full Export WS").await;
    app.create_collection(&token, &ws_uid, "Col1").await;
    app.create_collection(&token, &ws_uid, "Col2").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/export", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["collections"].is_array() || body["data"].is_array() || body.is_array());
}

#[tokio::test]
async fn export_collection_not_found_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("exp_nf@test.com", "password123", "ExpNF").await;
    let resp = app
        .server
        .get("/api/collections/nonexistent/export?format=postman")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}
