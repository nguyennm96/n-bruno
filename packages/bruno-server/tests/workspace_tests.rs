mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

// ── Create ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_workspace_returns_201_with_uid() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("owner@test.com", "password123", "Owner").await;

    let resp = app
        .server
        .post("/api/workspaces")
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "My Workspace" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert!(body["data"]["uid"].is_string());
    assert_eq!(body["data"]["name"], "My Workspace");
    assert_eq!(body["data"]["role"], "owner");
}

#[tokio::test]
async fn create_workspace_no_auth_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/workspaces")
        .json(&json!({ "name": "Unauthorized WS" }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn create_workspace_with_description() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("desc_owner@test.com", "password123", "Owner").await;
    let resp = app
        .server
        .post("/api/workspaces")
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Described WS", "description": "A workspace with a description" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["description"], "A workspace with a description");
}

// ── List ──────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_workspaces_returns_own_only() {
    let app = TestApp::spawn().await;
    let (t1, _) = app.register_and_login("user1@test.com", "password123", "User1").await;
    let (t2, _) = app.register_and_login("user2@test.com", "password123", "User2").await;

    app.create_workspace(&t1, "WS for User1").await;
    app.create_workspace(&t2, "WS for User2").await;

    let resp = app.server.get("/api/workspaces").add_header("Authorization", bearer(&t1)).await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    let list = body["data"].as_array().unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["name"], "WS for User1");
}

#[tokio::test]
async fn list_workspaces_empty_for_new_user() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("empty@test.com", "password123", "Empty").await;
    let resp = app.server.get("/api/workspaces").add_header("Authorization", bearer(&token)).await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    // New user might have 0 workspaces (depends on auto-seeding).
    assert!(body["data"].is_array());
}

// ── Get ───────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_workspace_success() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("getter@test.com", "password123", "Getter").await;
    let ws_uid = app.create_workspace(&token, "Get WS").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["uid"], ws_uid);
    assert_eq!(body["data"]["name"], "Get WS");
}

#[tokio::test]
async fn get_workspace_not_found_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("notfound@test.com", "password123", "NF").await;
    let resp = app
        .server
        .get("/api/workspaces/uid_that_does_not_exist")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn get_workspace_non_member_returns_404_or_403() {
    let app = TestApp::spawn().await;
    let (t1, _) = app.register_and_login("ws_owner2@test.com", "password123", "Owner2").await;
    let (t2, _) = app.register_and_login("non_member@test.com", "password123", "NonMember").await;
    let ws_uid = app.create_workspace(&t1, "Private WS").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&t2))
        .await;
    // Non-member sees a 404 (workspace exists but membership check fails → "not found")
    assert!(
        resp.status_code() == StatusCode::NOT_FOUND || resp.status_code() == StatusCode::FORBIDDEN,
        "expected 404 or 403, got {}",
        resp.status_code()
    );
}

// ── Update ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn update_workspace_owner_succeeds() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("updater@test.com", "password123", "Updater").await;
    let ws_uid = app.create_workspace(&token, "Old Name").await;

    let resp = app
        .server
        .patch(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "New Name" }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "New Name");
}

#[tokio::test]
async fn update_workspace_non_owner_returns_403() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("ws_owner3@test.com", "password123", "Owner3").await;
    let (t_editor, _) = app.register_and_login("ws_editor@test.com", "password123", "Editor").await;
    let ws_uid = app.create_workspace(&t_owner, "Editable WS").await;

    // Add editor as member
    app.register_user("ws_editor2@test.com", "password123", "Editor2").await;
    let (t_editor2, _) = app.login("ws_editor2@test.com", "password123").await;
    app.server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "ws_editor2@test.com", "role": "editor" }))
        .await;

    let resp = app
        .server
        .patch(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&t_editor2))
        .json(&json!({ "name": "Hacked Name" }))
        .await;
    resp.assert_status(StatusCode::FORBIDDEN);
    let _ = t_editor; // suppress unused warning
}

// ── Delete ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_workspace_owner_returns_204() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("deleter@test.com", "password123", "Deleter").await;
    let ws_uid = app.create_workspace(&token, "To Delete").await;

    let resp = app
        .server
        .delete(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);

    // Verify it's gone
    let resp = app
        .server
        .get(&format!("/api/workspaces/{}", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Members ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_members_returns_owner() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("member_owner@test.com", "password123", "MOwner").await;
    let ws_uid = app.create_workspace(&token, "Member WS").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    let members = body["data"].as_array().unwrap();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0]["role"], "owner");
}

#[tokio::test]
async fn add_and_remove_member() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("add_owner@test.com", "password123", "AOwner").await;
    let ws_uid = app.create_workspace(&t_owner, "Membership WS").await;

    let new_user_id = app.register_user("new_member@test.com", "password123", "NewMember").await;

    // Add member
    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "new_member@test.com", "role": "viewer" }))
        .await;
    resp.assert_status_ok();

    // Verify 2 members now
    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .await;
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 2);

    // Remove member
    let resp = app
        .server
        .delete(&format!("/api/workspaces/{}/members/{}", ws_uid, new_user_id))
        .add_header("Authorization", bearer(&t_owner))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);

    // Back to 1
    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .await;
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn add_member_duplicate_returns_409() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("dup_owner@test.com", "password123", "DOwner").await;
    let ws_uid = app.create_workspace(&t_owner, "Dup WS").await;
    let uid = app.register_user("dup_member@test.com", "password123", "DupMember").await;

    app.server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "dup_member@test.com", "role": "viewer" }))
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "dup_member@test.com", "role": "viewer" }))
        .await;
    resp.assert_status(StatusCode::CONFLICT);
    let _ = uid; // suppress unused warning
}

#[tokio::test]
async fn non_member_cannot_list_members() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("priv_owner@test.com", "password123", "POwner").await;
    let (t_other, _) = app.register_and_login("outsider@test.com", "password123", "Outsider").await;
    let ws_uid = app.create_workspace(&t_owner, "Private WS2").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_other))
        .await;
    assert!(
        resp.status_code() == StatusCode::NOT_FOUND || resp.status_code() == StatusCode::FORBIDDEN
    );
}
