mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

// ── Create Folder ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_folder_at_root_returns_201() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("folder_owner@test.com", "password123", "FOwner").await;
    let ws_uid = app.create_workspace(&token, "Folder WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Folder Col").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/folders", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Auth" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["type"], "folder");
    assert_eq!(body["data"]["name"], "Auth");
    assert!(body["data"]["parentUid"].is_null());
}

#[tokio::test]
async fn create_nested_folder_sets_parent_uid() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("nested_f@test.com", "password123", "NestedF").await;
    let ws_uid = app.create_workspace(&token, "NF WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "NF Col").await;
    let parent_uid = app.create_folder(&token, &col_uid, "Parent").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/folders", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Child", "parentUid": parent_uid }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["parentUid"], parent_uid);
}

#[tokio::test]
async fn create_folder_nonexistent_collection_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("fnf@test.com", "password123", "FNF").await;
    let resp = app
        .server
        .post("/api/collections/nonexistent_col/folders")
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Ghost Folder" }))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Create Request ────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_request_returns_201_with_defaults() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("req_owner@test.com", "password123", "ROwner").await;
    let ws_uid = app.create_workspace(&token, "Req WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Req Col").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/requests", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Get Users",
            "request": {
                "method": "GET",
                "url": "https://api.example.com/users",
                "headers": [],
                "params": [],
                "body": { "mode": "none" }
            }
        }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["type"], "request");
    assert_eq!(body["data"]["request"]["method"], "GET");
    assert_eq!(body["data"]["request"]["url"], "https://api.example.com/users");
}

#[tokio::test]
async fn create_request_in_folder() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("req_in_f@test.com", "password123", "RIF").await;
    let ws_uid = app.create_workspace(&token, "RIF WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "RIF Col").await;
    let folder_uid = app.create_folder(&token, &col_uid, "Users").await;

    let resp = app
        .server
        .post(&format!("/api/collections/{}/requests", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Get User", "method": "GET", "url": "https://api.example.com/users/1", "parentUid": folder_uid }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["parentUid"], folder_uid);
}

// ── List Items ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_items_returns_flat_ordered_list() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("lister_i@test.com", "password123", "ListerI").await;
    let ws_uid = app.create_workspace(&token, "List Items WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "List Items Col").await;

    app.create_folder(&token, &col_uid, "Folder A").await;
    app.create_request(&token, &col_uid, "Request B").await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/items", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    let items = body["data"].as_array().unwrap();
    assert_eq!(items.len(), 2);
}

#[tokio::test]
async fn list_items_empty_collection() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("empty_items@test.com", "password123", "EmptyItems").await;
    let ws_uid = app.create_workspace(&token, "Empty Items WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Empty Items Col").await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/items", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 0);
}

// ── Get Item ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_item_success() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("get_item@test.com", "password123", "GetItem").await;
    let ws_uid = app.create_workspace(&token, "GI WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "GI Col").await;
    let req_uid = app.create_request(&token, &col_uid, "My Request").await;

    let resp = app
        .server
        .get(&format!("/api/items/{}", req_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["uid"], req_uid);
}

#[tokio::test]
async fn get_item_not_found_returns_404() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("gi_nf@test.com", "password123", "GINF").await;
    let resp = app
        .server
        .get("/api/items/nonexistent_item_uid")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Update Item ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn update_item_changes_name() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("upd_item@test.com", "password123", "UpdItem").await;
    let ws_uid = app.create_workspace(&token, "UI WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "UI Col").await;
    let req_uid = app.create_request(&token, &col_uid, "Old Name").await;

    let resp = app
        .server
        .patch(&format!("/api/items/{}", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "New Name" }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "New Name");
}

// ── Delete Item ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_item_removes_it() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("del_item@test.com", "password123", "DelItem").await;
    let ws_uid = app.create_workspace(&token, "DI WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "DI Col").await;
    let req_uid = app.create_request(&token, &col_uid, "To Delete").await;

    let resp = app
        .server
        .delete(&format!("/api/items/{}", req_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);

    let resp = app
        .server
        .get(&format!("/api/items/{}", req_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_folder_cascades_children() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("casc_folder@test.com", "password123", "CascFolder").await;
    let ws_uid = app.create_workspace(&token, "Casc WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Casc Col").await;
    let folder_uid = app.create_folder(&token, &col_uid, "Parent Folder").await;

    // Create a child request inside the folder
    let resp = app
        .server
        .post(&format!("/api/collections/{}/requests", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Child Req", "method": "GET", "url": "https://example.com", "parentUid": folder_uid }))
        .await;
    let child_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    // Delete the folder
    app.server
        .delete(&format!("/api/items/{}", folder_uid))
        .add_header("Authorization", bearer(&token))
        .await;

    // Child should also be gone
    let resp = app
        .server
        .get(&format!("/api/items/{}", child_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Move Item ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn move_item_to_folder() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("move_item@test.com", "password123", "MoveItem").await;
    let ws_uid = app.create_workspace(&token, "Move WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Move Col").await;
    let folder_uid = app.create_folder(&token, &col_uid, "Destination Folder").await;
    let req_uid = app.create_request(&token, &col_uid, "To Move").await;

    let resp = app
        .server
        .patch(&format!("/api/items/{}/move", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "parentUid": folder_uid }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["parentUid"], folder_uid);
}

#[tokio::test]
async fn move_item_to_root() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("move_root@test.com", "password123", "MoveRoot").await;
    let ws_uid = app.create_workspace(&token, "MRoot WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "MRoot Col").await;
    let folder_uid = app.create_folder(&token, &col_uid, "Source Folder").await;

    // Create request inside folder
    let resp = app
        .server
        .post(&format!("/api/collections/{}/requests", col_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Nested Req", "method": "GET", "url": "https://example.com", "parentUid": folder_uid }))
        .await;
    let req_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    // Move to root
    let resp = app
        .server
        .patch(&format!("/api/items/{}/move", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "parentUid": null }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["data"]["parentUid"].is_null());
}

// ── Clone Item ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn clone_request_creates_new_uid() {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("clone_item@test.com", "password123", "CloneItem").await;
    let ws_uid = app.create_workspace(&token, "Clone Item WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Clone Item Col").await;
    let req_uid = app.create_request(&token, &col_uid, "Original").await;

    let resp = app
        .server
        .post(&format!("/api/items/{}/clone", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Original Copy" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    let clone_uid = body["data"]["uid"].as_str().unwrap();
    assert_ne!(clone_uid, req_uid.as_str());
}
