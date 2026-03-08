mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

// ── Workspace-level environments ──────────────────────────────────────────────

#[tokio::test]
async fn create_workspace_environment_returns_201() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("env_owner@test.com", "password123", "EnvOwner").await;
    let ws_uid = app.create_workspace(&token, "Env WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Production",
            "variables": [
                { "name": "baseUrl", "value": "https://api.example.com", "enabled": true }
            ]
        }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "Production");
    assert_eq!(body["data"]["workspaceUid"], ws_uid);
    assert_eq!(body["data"]["variables"][0]["name"], "baseUrl");
}

#[tokio::test]
async fn list_workspace_environments() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("env_lister@test.com", "password123", "EnvLister").await;
    let ws_uid = app.create_workspace(&token, "Env List WS").await;

    app.server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Dev", "variables": [] }))
        .await;
    app.server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Prod", "variables": [] }))
        .await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
}

// ── Collection-level environments ─────────────────────────────────────────────

#[tokio::test]
async fn create_collection_environment_returns_201() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("col_env@test.com", "password123", "ColEnv").await;
    let ws_uid = app.create_workspace(&token, "Col Env WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Col Env Col").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/environments", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Staging",
            "variables": [
                { "name": "host", "value": "staging.api.example.com", "enabled": true, "secret": false }
            ]
        }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "Staging");
    assert_eq!(body["data"]["collectionUid"], col_uid);
}

#[tokio::test]
async fn list_collection_environments() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("col_env_list@test.com", "password123", "ColEnvList").await;
    let ws_uid = app.create_workspace(&token, "CEL WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "CEL Col").await;

    app.server
        .post(&format!("/api/collections/{}/environments", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Local", "variables": [] }))
        .await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/environments", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

// ── Update ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn update_environment_modifies_variables() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("upd_env@test.com", "password123", "UpdEnv").await;
    let ws_uid = app.create_workspace(&token, "UpdEnv WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Dev", "variables": [{ "name": "key", "value": "old", "enabled": true }] }))
        .await;
    let env_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    let resp = app
        .server
        .patch(&format!("/api/environments/{}", env_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "variables": [{ "name": "key", "value": "new", "enabled": true }]
        }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["variables"][0]["value"], "new");
}

#[tokio::test]
async fn update_environment_preserves_secret_flag() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("sec_env@test.com", "password123", "SecEnv").await;
    let ws_uid = app.create_workspace(&token, "Sec WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Secrets",
            "variables": [{ "name": "api_key", "value": "secret123", "enabled": true, "secret": true }]
        }))
        .await;
    let env_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    // Update with secret=true preserved
    let resp = app
        .server
        .patch(&format!("/api/environments/{}", env_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "variables": [{ "name": "api_key", "value": "newsecret", "enabled": true, "secret": true }]
        }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["variables"][0]["secret"], true);
}

// ── Delete ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_environment_returns_204() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("del_env@test.com", "password123", "DelEnv").await;
    let ws_uid = app.create_workspace(&token, "Del Env WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "To Delete", "variables": [] }))
        .await;
    let env_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    let resp = app
        .server
        .delete(&format!("/api/environments/{}", env_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn delete_environment_not_found_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("del_env_nf@test.com", "password123", "DelEnvNF").await;
    let resp = app
        .server
        .delete("/api/environments/nonexistent_env_uid")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Auth enforcement ──────────────────────────────────────────────────────────

#[tokio::test]
async fn create_environment_viewer_returns_403() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("env_guard@test.com", "password123", "EnvGuard").await;
    let ws_uid = app.create_workspace(&t_owner, "Guard Env WS").await;

    app.register_user("env_viewer@test.com", "password123", "EnvViewer").await;
    let (t_viewer, _) = app.login("env_viewer@test.com", "password123").await;

    app.server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "env_viewer@test.com", "role": "viewer" }))
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/environments", ws_uid))
        .add_header("Authorization", bearer(&t_viewer))
        .json(&json!({ "name": "Blocked", "variables": [] }))
        .await;
    resp.assert_status(StatusCode::FORBIDDEN);
}
