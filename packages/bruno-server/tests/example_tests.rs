mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

async fn setup() -> (TestApp, String, String, String) {
    let app = TestApp::spawn().await;
    let (token, _) = app.register_and_login("ex_owner@test.com", "password123", "ExOwner").await;
    let ws_uid = app.create_workspace(&token, "Ex WS").await;
    let col_uid = app.create_collection(&token, &ws_uid, "Ex Col").await;
    let req_uid = app.create_request(&token, &col_uid, "Ex Request").await;
    (app, token, col_uid, req_uid)
}

// ── Create ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_example_returns_201() {
    let (app, token, _, req_uid) = setup().await;

    let resp = app
        .server
        .post(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Success 200",
            "status_code": 200,
            "status_text": "OK",
            "headers": { "content-type": "application/json" },
            "body": "{\"id\": 1, \"name\": \"Alice\"}",
            "requestSnapshot": {
                "url": "https://api.example.com/users/1",
                "method": "GET",
                "headers": [],
                "params": [],
                "body": null
            },
            "responseTime": 145,
            "responseSize": 512
        }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["name"], "Success 200");
    assert_eq!(body["data"]["status_code"], 200);
    assert_eq!(body["data"]["requestUid"], req_uid);
}

#[tokio::test]
async fn create_example_nonexistent_request_returns_404() {
    let (app, token, _, _) = setup().await;
    let resp = app
        .server
        .post("/api/items/nonexistent_req_uid/examples")
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Ghost Example",
            "status_code": 200,
            "headers": {},
            "body": null
        }))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── List (Summary) ────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_examples_returns_summary_without_body() {
    let (app, token, _, req_uid) = setup().await;

    // Create two examples
    for (name, status) in [("OK 200", 200u16), ("Not Found 404", 404u16)] {
        app.server
            .post(&format!("/api/items/{}/examples", req_uid))
            .add_header("Authorization", bearer(&token))
            .json(&json!({
                "name": name,
                "status_code": status,
                "headers": {},
                "body": format!("{{\"status\": {}}}", status)
            }))
            .await;
    }

    let resp = app
        .server
        .get(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    let items = body["data"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    // Summary should NOT include body or requestSnapshot
    assert!(items[0]["body"].is_null());
    assert!(items[0]["requestSnapshot"].is_null());
}

#[tokio::test]
async fn list_examples_by_collection() {
    let (app, token, col_uid, req_uid) = setup().await;

    app.server
        .post(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Ex", "status_code": 200, "headers": {}, "body": null }))
        .await;

    let resp = app
        .server
        .get(&format!("/api/collections/{}/examples", col_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(!body["data"].as_array().unwrap().is_empty());
}

// ── Get Full ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_example_returns_full_body_and_snapshot() {
    let (app, token, _, req_uid) = setup().await;

    let resp = app
        .server
        .post(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({
            "name": "Full Ex",
            "status_code": 200,
            "headers": { "x-request-id": "abc-123" },
            "body": "{\"ok\": true}",
            "request_snapshot": { "url": "https://example.com", "method": "GET" }
        }))
        .await;
    let ex_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    let resp = app
        .server
        .get(&format!("/api/examples/{}", ex_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    // Full response includes body and requestSnapshot
    assert_eq!(body["data"]["body"], "{\"ok\": true}");
    assert!(body["data"]["requestSnapshot"].is_object());
}

#[tokio::test]
async fn get_example_not_found_returns_404() {
    let (app, token, _, _) = setup().await;
    let resp = app
        .server
        .get("/api/examples/nonexistent_ex_uid")
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}

// ── Update ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn update_example_changes_status_code() {
    let (app, token, _, req_uid) = setup().await;

    let resp = app
        .server
        .post(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Update Me", "status_code": 200, "headers": {}, "body": null }))
        .await;
    let ex_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    let resp = app
        .server
        .patch(&format!("/api/examples/{}", ex_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "status_code": 201, "body": "{\"created\": true}" }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["status_code"], 201);
}

// ── Delete ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_example_returns_204() {
    let (app, token, _, req_uid) = setup().await;

    let resp = app
        .server
        .post(&format!("/api/items/{}/examples", req_uid))
        .add_header("Authorization", bearer(&token))
        .json(&json!({ "name": "Del Me", "status_code": 200, "headers": {}, "body": null }))
        .await;
    let ex_uid = resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string();

    let resp = app
        .server
        .delete(&format!("/api/examples/{}", ex_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);

    let resp = app
        .server
        .get(&format!("/api/examples/{}", ex_uid))
        .add_header("Authorization", bearer(&token))
        .await;
    resp.assert_status(StatusCode::NOT_FOUND);
}
