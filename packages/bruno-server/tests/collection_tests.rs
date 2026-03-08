mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

// ── Create ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_collection_returns_201() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("col_owner@test.com", "password123", "ColOwner").await;
    let ws_uid = app.create_workspace(&token, "Col WS").await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/collections", ws_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "My API", "description": "Test collection" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert!(body["data"]["uid"].is_string());
    assert_eq!(body["data"]["name"], "My API");
    assert_eq!(body["data"]["workspaceUid"], ws_uid);
}

#[tokio::test]
async fn create_collection_viewer_returns_403() {
    let app = TestApp::spawn().await;
    let (t_owner, _) = app.register_and_login("cowner2@test.com", "password123", "COwner2").await;
    let ws_uid = app.create_workspace(&t_owner, "Guarded WS").await;
    // Register viewer first to get their email, then login separately (avoid double-register)
    app.register_user("cviewer@test.com", "password123", "Viewer").await;
    let (t_viewer, _) = app.login("cviewer@test.com", "password123").await;

    app.server
        .post(&format!("/api/workspaces/{}/members", ws_uid))
        .add_header("Authorization", bearer(&t_owner))
        .json(&json!({ "email": "cviewer@test.com", "role": "viewer" }))
        .await;

    let resp = app
        .server
        .post(&format!("/api/workspaces/{}/collections", ws_uid))
        .add_header("Authorization", bearer(&t_viewer))
        .json(&json!({ "name": "Viewer Collection" }))
        .await;
    resp.assert_status(StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn create_collection_nonexistent_workspace_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("cnf@test.com", "password123", "CNF").await;
    let resp = app
        .server
        .post("/api/workspaces/nonexistent_ws_uid/collections")
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Ghost Collection" }))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── List ──────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_collections_returns_all_in_workspace() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("lister@test.com", "password123", "Lister").await;
    let ws_uid = app.create_workspace(&token, "List WS").await;

    app.create_collection(&token, &ws_uid, "Col A").await;
    app.create_collection(&token, &ws_uid, "Col B").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/collections", ws_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn list_collections_non_member_returns_403_or_404() {
    let app = TestApp::spawn().await;
    let (t1, _) = app.register_and_login("col_owner3@test.com", "password123", "COwner3").await;
    let (t2, _) = app.register_and_login("col_outsider@test.com", "password123", "Outsider").await;
    let ws_uid = app.create_workspace(&t1, "Private Col WS").await;

    let resp = app
        .server
        .get(&format!("/api/workspaces/{}/collections", ws_uid))
        .add_header("Authorization", bearer(&t2))
        .await;
    assert!(
        resp.status_code() == StatusCode::FORBIDDEN || resp.status_code() == StatusCode::NOT_FOUND
    );
}

// ── Get ───────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_collection_success() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("getc@test.com", "password123", "GetC").await;
    let ws_uid = app.create_workspace(&token, "Get Col WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Get Me").await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["uid"], col_uid);
}

#[tokio::test]
async fn get_collection_not_found_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("getc_nf@test.com", "password123", "GetCNF").await;
    let resp = app
        .server
        .get("/api/collections/nonexistent_col_uid")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Update ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn update_collection_editor_succeeds() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("updc@test.com", "password123", "UpdC").await;
    let ws_uid = app.create_workspace(&token, "Upd Col WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Original Name").await;

    let resp = app
        .server
        .patch(&format!("/api/collections/{}", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Updated Name" }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "Updated Name");
}

// ── Delete ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_collection_removes_it() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("delc@test.com", "password123", "DelC").await;
    let ws_uid = app.create_workspace(&token, "Del Col WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "To Delete").await;

    let resp = app
        .server
        .delete(&format!("/api/collections/{}", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);

    let resp = app
        .server
        .get(&format!("/api/collections/{}", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_collection_cascades_items() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("casc_del@test.com", "password123", "CascDel").await;
    let ws_uid = app.create_workspace(&token, "Cascade WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Has Items").await;

    // Create items
    let req_uid = app.create_request(&token, &col_uid, "Request").await;

    // Delete collection
    app.server
        .delete(&format!("/api/collections/{}", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;

    // Item should also be gone
    let resp = app
        .server
        .get(&format!("/api/items/{}", req_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Clone ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn clone_collection_creates_new_collection() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("clone_owner@test.com", "password123", "CloneOwner").await;
    let ws_uid = app.create_workspace(&token, "Clone WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Original").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/clone", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Cloned Collection" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    let clone_uid = body["data"]["uid"].as_str().unwrap();
    assert_ne!(clone_uid, col_uid.as_str());
}

// ── Resequence ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn resequence_items_returns_200() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("reseq@test.com", "password123", "Reseq").await;
    let ws_uid = app.create_workspace(&token, "Reseq WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Reseq Col").await;

    let r1 = app.create_request(&token, &col_uid, "Req1").await;
    let r2 = app.create_request(&token, &col_uid, "Req2").await;

    let resp = app
        .server
        .patch(&format!("/api/collections/{}/resequence", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "items": [{ "uid": r2, "seq": 1 }, { "uid": r1, "seq": 2 }] }))
        .await;
    resp.assert_status_ok();
}
