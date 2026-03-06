/// Integration tests for Bruno Server API
/// Uses axum-test to spin up a real app instance against a test MongoDB.
///
/// Run with: cargo test
/// Run with output: cargo test -- --nocapture
use axum_test::TestServer;
use serde_json::{json, Value};

mod common;
use common::*;

// ── Auth Flow ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_health_check() {
    let server = create_test_server().await;
    let resp = server.get("/api/health").await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn test_register_and_login() {
    let server = create_test_server().await;
    let email = unique_email();

    // Register
    let resp = server
        .post("/api/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "name": "Test User"
        }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["email"], email);

    // Login
    let resp = server
        .post("/api/auth/login")
        .json(&json!({
            "email": email,
            "password": "password123"
        }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["data"]["access_token"].is_string());
    assert!(body["data"]["refresh_token"].is_string());
}

#[tokio::test]
async fn test_register_duplicate_email_returns_409() {
    let server = create_test_server().await;
    let email = unique_email();

    server.post("/api/auth/register")
        .json(&json!({ "email": email, "password": "password123", "name": "A" }))
        .await.assert_status(axum::http::StatusCode::CREATED);

    let resp = server.post("/api/auth/register")
        .json(&json!({ "email": email, "password": "password123", "name": "B" }))
        .await;
    resp.assert_status(axum::http::StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_login_wrong_password_returns_401() {
    let server = create_test_server().await;
    let email = unique_email();

    server.post("/api/auth/register")
        .json(&json!({ "email": email, "password": "correct", "name": "User" }))
        .await;

    let resp = server.post("/api/auth/login")
        .json(&json!({ "email": email, "password": "wrong" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_protected_route_requires_auth() {
    let server = create_test_server().await;
    let resp = server.get("/api/auth/me").await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_get_me() {
    let server = create_test_server().await;
    let (token, email) = register_and_login(&server).await;

    let resp = server.get("/api/auth/me")
        .authorization_bearer(&token)
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["email"], email);
}

#[tokio::test]
async fn test_token_refresh() {
    let server = create_test_server().await;
    let email = unique_email();

    server.post("/api/auth/register")
        .json(&json!({ "email": email, "password": "password123", "name": "User" }))
        .await;

    let login_resp: Value = server.post("/api/auth/login")
        .json(&json!({ "email": email, "password": "password123" }))
        .await.json();
    eprintln!("LOGIN: {}", serde_json::to_string_pretty(&login_resp).unwrap());

    let refresh_token = login_resp["data"]["refresh_token"].as_str()
        .or_else(|| login_resp["refresh_token"].as_str())
        .expect("refresh_token not found in login response");

    let resp = server.post("/api/auth/refresh")
        .json(&json!({ "refresh_token": refresh_token }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["data"]["access_token"].is_string());
    let new_rt = body["data"]["refresh_token"].as_str().unwrap();
    assert_ne!(new_rt, refresh_token, "Refresh token should be rotated");
}

// ── Workspace Flow ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_workspace_crud() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;

    // Create
    let resp = server.post("/api/workspaces")
        .authorization_bearer(&token)
        .json(&json!({ "name": "Test WS", "description": "desc" }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();
    eprintln!("CREATE RESP: {}", serde_json::to_string_pretty(&body).unwrap());
    let ws_id = body["data"]["uid"].as_str().unwrap();
    assert_eq!(body["data"]["name"], "Test WS");
    assert_eq!(body["data"]["role"], "owner");

    // Get
    let get_resp = server.get(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token)
        .await;
    get_resp.assert_status_ok();

    // List (before update)
    let list_resp = server.get("/api/workspaces")
        .authorization_bearer(&token)
        .await;
    list_resp.assert_status_ok();
    let list: Value = list_resp.json();
    assert!(
        list["data"].as_array().unwrap().len() >= 1,
        "Expected at least 1 workspace, got: {}", serde_json::to_string(&list).unwrap()
    );

    // Update
    let upd_resp = server.patch(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Updated WS" }))
        .await;
    upd_resp.assert_status_ok();
    let upd_body: Value = upd_resp.json();
    assert_eq!(upd_body["data"]["name"], "Updated WS");
}

#[tokio::test]
async fn test_non_member_cannot_access_workspace() {
    let server = create_test_server().await;
    let (token_a, _) = register_and_login(&server).await;
    let (token_b, _) = register_and_login(&server).await;

    // User A creates workspace
    let resp: Value = server.post("/api/workspaces")
        .authorization_bearer(&token_a)
        .json(&json!({ "name": "Private" }))
        .await.json();
    let ws_id = resp["data"]["uid"].as_str().unwrap();

    // User B tries to access → should get 404 (not 403, for security)
    let resp = server.get(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token_b)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// ── Collection Flow ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_collection_crud() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    // Create
    let resp = server.post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "My API" }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();
    let col_id = body["data"]["uid"].as_str().unwrap();

    // List
    let list: Value = server.get(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token)
        .await.json();
    assert_eq!(list["data"].as_array().unwrap().len(), 1);

    // Update
    let upd: Value = server.patch(&format!("/api/collections/{col_id}"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "My API (v2)" }))
        .await.json();
    assert_eq!(upd["data"]["name"], "My API (v2)");

    // Delete
    let del_resp = server.delete(&format!("/api/collections/{col_id}"))
        .authorization_bearer(&token)
        .await;
    if del_resp.status_code() != axum::http::StatusCode::NO_CONTENT {
        eprintln!("DELETE FAILED: {}", del_resp.text());
    }
    del_resp.assert_status(axum::http::StatusCode::NO_CONTENT);
}

// ── Item Flow ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_item_hierarchy() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;

    // Create folder
    let folder: Value = server.post(&format!("/api/collections/{col_id}/folders"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Users", "seq": 1.0 }))
        .await.json();
    let folder_id = folder["data"]["uid"].as_str().unwrap();
    assert_eq!(folder["data"]["type"], "folder");

    // Create request inside folder
    let req: Value = server.post(&format!("/api/collections/{col_id}/requests"))
        .authorization_bearer(&token)
        .json(&json!({
            "name": "List Users",
            "method": "GET",
            "url": "https://api.example.com/users",
            "parentUid": folder_id,
            "seq": 1.0
        }))
        .await.json();
    let item_id = req["data"]["uid"].as_str().unwrap();
    assert_eq!(req["data"]["type"], "request");
    assert_eq!(req["data"]["parentUid"], folder_id);

    // List items
    let items: Value = server.get(&format!("/api/collections/{col_id}/items"))
        .authorization_bearer(&token)
        .await.json();
    assert_eq!(items["data"].as_array().unwrap().len(), 2);

    // Delete folder → should cascade delete request
    server.delete(&format!("/api/items/{folder_id}"))
        .authorization_bearer(&token)
        .await.assert_status(axum::http::StatusCode::NO_CONTENT);

    let items_after: Value = server.get(&format!("/api/collections/{col_id}/items"))
        .authorization_bearer(&token)
        .await.json();
    assert_eq!(items_after["data"].as_array().unwrap().len(), 0, "cascaded delete should remove child request");
}

// ── Environment Flow ──────────────────────────────────────────────────────────

#[tokio::test]
async fn test_environment_crud() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    // Create
    let resp = server.post(&format!("/api/workspaces/{ws_id}/environments"))
        .authorization_bearer(&token)
        .json(&json!({
            "name": "Dev",
            "variables": [
                { "name": "BASE_URL", "value": "https://dev.api.com", "enabled": true },
                { "name": "SECRET", "value": "dev-secret", "enabled": false }
            ]
        }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();
    let env_id = body["data"]["uid"].as_str().unwrap();
    assert_eq!(body["data"]["variables"].as_array().unwrap().len(), 2);

    // Update - add a variable
    let upd_resp = server.patch(&format!("/api/environments/{env_id}"))
        .authorization_bearer(&token)
        .json(&json!({
            "variables": [
                { "name": "BASE_URL", "value": "https://dev.api.com", "enabled": true },
                { "name": "SECRET", "value": "dev-secret", "enabled": false },
                { "name": "TIMEOUT", "value": "30", "enabled": true }
            ]
        }))
        .await;
    if upd_resp.status_code() != axum::http::StatusCode::OK {
        eprintln!("ENV UPDATE FAILED: {}", upd_resp.text());
    }
    upd_resp.assert_status_ok();
    let upd: Value = upd_resp.json();
    eprintln!("ENV UPDATE: {}", serde_json::to_string_pretty(&upd).unwrap());
    let var_count = upd["data"]["variables"].as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    assert_eq!(var_count, 3, "Expected 3 variables after update, got {var_count}. Response: {upd}");

    // Duplicate name → 409
    let dup_resp = server.post(&format!("/api/workspaces/{ws_id}/environments"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Dev", "variables": [] }))
        .await;
    dup_resp.assert_status(axum::http::StatusCode::CONFLICT);
}

// ── Example Flow ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_examples_only_for_requests() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;

    // Create a folder
    let folder: Value = server.post(&format!("/api/collections/{col_id}/folders"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Folder", "seq": 1.0 }))
        .await.json();
    let folder_id = folder["data"]["uid"].as_str().unwrap();

    // Try to add example to folder → should fail
    let resp = server.post(&format!("/api/items/{folder_id}/examples"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Test", "status_code": 200, "headers": {}, "body": null }))
        .await;
    resp.assert_status(axum::http::StatusCode::BAD_REQUEST);

    // Create a request and add example → should succeed
    let req: Value = server.post(&format!("/api/collections/{col_id}/requests"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Get Users", "method": "GET", "url": "https://api.com/users", "seq": 1.0 }))
        .await.json();
    let item_id = req["data"]["uid"].as_str().unwrap();

    let ex_resp = server.post(&format!("/api/items/{item_id}/examples"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "200 OK", "status_code": 200, "headers": {}, "body": null }))
        .await;
    ex_resp.assert_status(axum::http::StatusCode::CREATED);
}

// ── Import/Export Flow ────────────────────────────────────────────────────

#[tokio::test]
async fn test_import_postman_collection() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "Import Test WS").await;

    // Minimal valid Postman Collection v2.1
    let postman_json = json!({
        "info": {
            "name": "My API Collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": "Users",
                "item": [
                    {
                        "name": "Get User",
                        "request": {
                            "method": "GET",
                            "header": [],
                            "url": {
                                "raw": "https://api.example.com/users/123",
                                "protocol": "https",
                                "host": ["api", "example", "com"],
                                "path": ["users", "123"]
                            }
                        },
                        "response": [
                            {
                                "name": "Success",
                                "status": "OK",
                                "code": 200,
                                "header": [],
                                "body": "{\"id\": 123, \"name\": \"John\"}"
                            }
                        ]
                    }
                ]
            },
            {
                "name": "Create User",
                "request": {
                    "method": "POST",
                    "header": [{"key": "Content-Type", "value": "application/json"}],
                    "body": {
                        "mode": "raw",
                        "raw": "{\"name\": \"Alice\"}"
                    },
                    "url": "https://api.example.com/users"
                }
            }
        ]
    });

    let resp = server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({ "json": postman_json.to_string() }))
        .await;

    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();

    assert_eq!(body["data"]["collection_name"], "My API Collection");
    assert!(body["data"]["collectionUid"].is_string());
    assert_eq!(body["data"]["imported"]["folders"], 1); // "Users" folder
    assert_eq!(body["data"]["imported"]["requests"], 2); // 2 requests
    assert_eq!(body["data"]["imported"]["examples"], 1); // 1 response example
}

#[tokio::test]
async fn test_import_postman_conflict_error() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let postman_json = json!({
        "info": {
            "name": "Test Collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    });

    // Import once
    server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({ "json": postman_json.to_string() }))
        .await
        .assert_status(axum::http::StatusCode::CREATED);

    // Import again with same name → should error by default
    let resp = server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({ "json": postman_json.to_string() }))
        .await;

    resp.assert_status(axum::http::StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_import_postman_conflict_rename() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let postman_json = json!({
        "info": {
            "name": "Test Collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    });

    // Import once
    server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({ "json": postman_json.to_string() }))
        .await
        .assert_status(axum::http::StatusCode::CREATED);

    // Import again with rename strategy
    let resp = server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({
            "json": postman_json.to_string(),
            "conflict": "rename"  // lowercase per serde(rename_all = "lowercase")
        }))
        .await;

    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();

    // Should have renamed (e.g., "Test Collection (1)")
    let name = body["data"]["collection_name"].as_str().unwrap();
    assert!(name.contains("Test Collection"));
}

#[tokio::test]
async fn test_export_collection_to_postman() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "API v1").await;

    // Create some items
    let folder: Value = server.post(&format!("/api/collections/{col_id}/folders"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Endpoints", "seq": 1.0 }))
        .await.json();
    let folder_id = folder["data"]["uid"].as_str().unwrap();

    server.post(&format!("/api/collections/{col_id}/requests"))
        .authorization_bearer(&token)
        .json(&json!({
            "name": "Get Items",
            "method": "GET",
            "url": "https://api.com/items",
            "parentUid": folder_id,
            "seq": 1.0
        }))
        .await;

    // Export to Postman
    let resp = server.get(&format!("/api/collections/{col_id}/export?format=postman"))
        .authorization_bearer(&token)
        .await;

    resp.assert_status_ok();

    // Verify it's valid JSON
    let text = resp.text();
    let postman: Value = serde_json::from_str(&text)
        .expect("Should be valid JSON");

    assert_eq!(postman["info"]["name"], "API v1");
    assert!(postman["item"].is_array());
}

#[tokio::test]
async fn test_export_collection_to_openapi() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "My API").await;

    // Create a request
    server.post(&format!("/api/collections/{col_id}/requests"))
        .authorization_bearer(&token)
        .json(&json!({
            "name": "List Users",
            "method": "GET",
            "url": "https://api.example.com/v1/users",
            "seq": 1.0
        }))
        .await;

    // Export to OpenAPI 3.0
    let resp = server.get(&format!("/api/collections/{col_id}/export?format=openapi"))
        .authorization_bearer(&token)
        .await;

    resp.assert_status_ok();

    let text = resp.text();
    let openapi: Value = serde_json::from_str(&text)
        .expect("Should be valid JSON");

    assert_eq!(openapi["openapi"], "3.0.0");
    assert_eq!(openapi["info"]["title"], "My API");
    assert!(openapi["paths"].is_object());
}

#[tokio::test]
async fn test_export_collection_to_swagger() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Legacy API").await;

    // Export to Swagger 2.0
    let resp = server.get(&format!("/api/collections/{col_id}/export?format=swagger"))
        .authorization_bearer(&token)
        .await;

    resp.assert_status_ok();

    let text = resp.text();
    let swagger: Value = serde_json::from_str(&text)
        .expect("Should be valid JSON");

    assert_eq!(swagger["swagger"], "2.0");
    assert_eq!(swagger["info"]["title"], "Legacy API");
}

#[tokio::test]
async fn test_export_workspace() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "Full WS").await;

    // Create multiple collections
    create_collection(&server, &token, &ws_id, "API v1").await;
    create_collection(&server, &token, &ws_id, "API v2").await;

    // Export entire workspace
    let resp = server.get(&format!("/api/workspaces/{ws_id}/export"))
        .authorization_bearer(&token)
        .await;

    resp.assert_status_ok();

    let text = resp.text();
    let data: Value = serde_json::from_str(&text)
        .expect("Should be valid JSON");

    // Should be array of collections
    assert!(data.is_array());
    assert_eq!(data.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_import_export_roundtrip() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "Roundtrip WS").await;

    // Original Postman collection
    let original = json!({
        "info": {
            "name": "Roundtrip Test",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": "Test Request",
                "request": {
                    "method": "POST",
                    "header": [{"key": "X-Custom", "value": "test"}],
                    "url": "https://api.test.com/data"
                }
            }
        ]
    });

    // Import
    let import_resp: Value = server.post(&format!("/api/workspaces/{ws_id}/import/postman"))
        .authorization_bearer(&token)
        .json(&json!({ "json": original.to_string() }))
        .await.json();

    let col_id = import_resp["data"]["collectionUid"].as_str().unwrap();

    // Export back to Postman
    let export_resp = server.get(&format!("/api/collections/{col_id}/export?format=postman"))
        .authorization_bearer(&token)
        .await;

    let exported: Value = serde_json::from_str(&export_resp.text())
        .expect("Should be valid JSON");

    // Verify key fields preserved
    assert_eq!(exported["info"]["name"], "Roundtrip Test");
    assert!(exported["item"].is_array());
    assert_eq!(exported["item"][0]["name"], "Test Request");
}

// ── WebSocket Flow ────────────────────────────────────────────────────────
// NOTE: WebSocket tests require tokio-tungstenite or similar for WS client testing
// axum-test doesn't provide built-in WebSocket testing helpers
// TODO: Implement WebSocket tests using tokio-tungstenite

/*
#[tokio::test]
async fn test_websocket_connection_requires_auth() {
    let server = create_test_server().await;

    // Try to connect without token
    let ws_result = server.get_websocket("/ws").await;

    // Should fail - connection upgrade should be rejected without valid token
    assert!(ws_result.is_err(), "WebSocket connection should fail without token");
}

#[tokio::test]
async fn test_websocket_subscribe_and_broadcast() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS for WebSocket Test").await;

    // Connect WebSocket with valid token
    let mut ws = server.get_websocket(&format!("/ws?token={}", token))
        .await
        .expect("Should connect with valid token");

    // Subscribe to workspace
    ws.send_text(&json!({
        "type": "Subscribe",
        "workspace_id": ws_id
    }).to_string()).await;

    // Give server time to process subscription
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Create a collection in the workspace (via REST API)
    let create_resp: Value = server.post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Test Collection for WS" }))
        .await.json();

    let col_id = create_resp["data"]["id"].as_str().unwrap();

    // Wait for WebSocket message
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // Check if we received a broadcast event
    if let Some(msg) = ws.receive_text().await {
        let event: Value = serde_json::from_str(&msg)
            .expect("Should be valid JSON");

        assert_eq!(event["type"], "Event");
        assert_eq!(event["workspace_id"], ws_id);

        let payload = &event["event"];
        assert_eq!(payload["type"], "CollectionChanged");
        assert_eq!(payload["payload"]["action"], "created");
        assert_eq!(payload["payload"]["data"]["id"], col_id);
    } else {
        panic!("Should receive WebSocket broadcast event");
    }

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_ping_pong() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;

    let mut ws = server.get_websocket(&format!("/ws?token={}", token))
        .await
        .expect("Should connect");

    // Send ping
    ws.send_text(&json!({ "type": "Ping" }).to_string()).await;

    // Wait for pong
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    if let Some(msg) = ws.receive_text().await {
        let response: Value = serde_json::from_str(&msg)
            .expect("Should be valid JSON");
        assert_eq!(response["type"], "Pong");
    } else {
        panic!("Should receive Pong response");
    }

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_unsubscribe() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let mut ws = server.get_websocket(&format!("/ws?token={}", token))
        .await
        .expect("Should connect");

    // Subscribe
    ws.send_text(&json!({
        "type": "Subscribe",
        "workspace_id": ws_id
    }).to_string()).await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Unsubscribe
    ws.send_text(&json!({
        "type": "Unsubscribe",
        "workspace_id": ws_id
    }).to_string()).await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Create collection (should NOT receive event after unsubscribe)
    server.post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Test" }))
        .await;

    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

    // Should not receive any message
    let msg = ws.receive_text().await;
    assert!(msg.is_none() || !msg.unwrap().contains("CollectionChanged"),
        "Should not receive events after unsubscribe");

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_multiple_clients() {
    let server = create_test_server().await;
    let (token_a, _) = register_and_login(&server).await;
    let (token_b, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token_a, "Shared WS").await;

    // Add user B as member
    let user_b_resp: Value = server.post("/api/auth/register")
        .json(&json!({
            "email": unique_email(),
            "password": "password123",
            "name": "User B"
        }))
        .await.json();
    let user_b_id = user_b_resp["data"]["id"].as_str().unwrap();

    server.post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({
            "user_id": user_b_id,
            "role": "editor"
        }))
        .await;

    // Both users connect
    let mut ws_a = server.get_websocket(&format!("/ws?token={}", token_a))
        .await
        .expect("User A should connect");

    let mut ws_b = server.get_websocket(&format!("/ws?token={}", token_b))
        .await
        .expect("User B should connect");

    // Both subscribe
    ws_a.send_text(&json!({ "type": "Subscribe", "workspace_id": ws_id }).to_string()).await;
    ws_b.send_text(&json!({ "type": "Subscribe", "workspace_id": ws_id }).to_string()).await;

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // User A creates collection
    server.post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token_a)
        .json(&json!({ "name": "Shared Collection" }))
        .await;

    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    // User B should receive event (but not User A, sender is excluded)
    let msg_b = ws_b.receive_text().await;
    assert!(msg_b.is_some(), "User B should receive broadcast");

    let event_b: Value = serde_json::from_str(&msg_b.unwrap()).unwrap();
    assert_eq!(event_b["type"], "Event");

    ws_a.close().await;
    ws_b.close().await;
}
*/
