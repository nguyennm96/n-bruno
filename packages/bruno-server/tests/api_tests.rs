/// Integration tests for Bruno Server API
/// Uses axum-test to spin up a real app instance against a test MongoDB.
///
/// Run with: cargo test
/// Run with output: cargo test -- --nocapture
use axum_test::TestServer;
use serde_json::{json, Value};

mod common;
#[allow(unused_imports)]
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

// ── Auth Edge Cases ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_logout_revokes_refresh_token() {
    let server = create_test_server().await;
    let (access_token, refresh_token, _, _) = register_user_full(&server).await;

    // Logout with the refresh token
    let resp = server
        .post("/api/auth/logout")
        .authorization_bearer(&access_token)
        .json(&json!({ "refresh_token": refresh_token }))
        .await;
    resp.assert_status(axum::http::StatusCode::NO_CONTENT);

    // Attempt to use the revoked refresh token → should fail
    let resp2 = server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": refresh_token }))
        .await;
    resp2.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_malformed_bearer_token_returns_401() {
    let server = create_test_server().await;
    let resp = server
        .get("/api/auth/me")
        .authorization_bearer("this.is.not.a.valid.jwt")
        .await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_register_short_password_returns_422() {
    let server = create_test_server().await;
    let resp = server
        .post("/api/auth/register")
        .json(&json!({ "email": unique_email(), "password": "short", "name": "User" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn test_login_nonexistent_user_returns_401() {
    let server = create_test_server().await;
    let resp = server
        .post("/api/auth/login")
        .json(&json!({ "email": "nobody@example.com", "password": "password123" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_refresh_with_invalid_token_returns_401() {
    let server = create_test_server().await;
    let resp = server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": "notavalidtoken" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_register_invalid_email_returns_422() {
    let server = create_test_server().await;
    let resp = server
        .post("/api/auth/register")
        .json(&json!({ "email": "not-an-email", "password": "password123", "name": "User" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
}

// ── Workspace Edge Cases ──────────────────────────────────────────────────────

#[tokio::test]
async fn test_delete_workspace() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "To Delete").await;

    // Delete
    server
        .delete(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);

    // Get should now return 404
    server
        .get(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_list_workspace_members() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let resp: Value = server
        .get(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token)
        .await
        .json();

    // Creator is auto-added as owner
    let members = resp["data"].as_array().unwrap();
    assert_eq!(members.len(), 1);
    assert_eq!(members[0]["role"], "owner");
}

#[tokio::test]
async fn test_add_and_remove_member() {
    let server = create_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (_, _, email_b, user_b_id) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "Shared WS").await;

    // Add user B as editor
    server
        .post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({ "email": email_b, "role": "editor" }))
        .await
        .assert_status(axum::http::StatusCode::OK);

    // Verify membership
    let members: Value = server
        .get(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .await
        .json();
    assert_eq!(members["data"].as_array().unwrap().len(), 2);

    // Remove user B
    server
        .delete(&format!("/api/workspaces/{ws_id}/members/{user_b_id}"))
        .authorization_bearer(&token_a)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);

    // Verify removed
    let members_after: Value = server
        .get(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .await
        .json();
    assert_eq!(members_after["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_editor_cannot_delete_workspace() {
    let server = create_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (token_b, _, email_b, _) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "WS").await;

    // Add user B as editor
    server
        .post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({ "email": email_b, "role": "editor" }))
        .await;

    // Editor tries to delete workspace → should be forbidden
    server
        .delete(&format!("/api/workspaces/{ws_id}"))
        .authorization_bearer(&token_b)
        .await
        .assert_status(axum::http::StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_workspace_name_empty_returns_422() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .post("/api/workspaces")
        .authorization_bearer(&token)
        .json(&json!({ "name": "" }))
        .await;
    resp.assert_status(axum::http::StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn test_get_workspace_not_found() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .get("/api/workspaces/nonexistent-uid-12345")
        .authorization_bearer(&token)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// ── Collection Edge Cases ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_collection() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "My API").await;

    let resp: Value = server
        .get(&format!("/api/collections/{col_id}"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(resp["data"]["name"], "My API");
    assert_eq!(resp["data"]["uid"], col_id);
}

#[tokio::test]
async fn test_clone_collection() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Original").await;

    // Add an item to original
    create_request_item(&server, &token, &col_id, "GET users").await;

    // Clone
    let resp = server
        .post(&format!("/api/collections/{col_id}/clone"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Original (Copy)" }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);

    let body: Value = resp.json();
    let clone_id = body["data"]["uid"].as_str().unwrap();
    assert_ne!(clone_id, col_id);
    assert_eq!(body["data"]["name"], "Original (Copy)");

    // Cloned collection should have the same items
    let items: Value = server
        .get(&format!("/api/collections/{clone_id}/items"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(items["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_resequence_items() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;

    let item1 = create_request_item(&server, &token, &col_id, "Item A").await;
    let item2 = create_request_item(&server, &token, &col_id, "Item B").await;

    // Resequence: swap order
    let resp = server
        .patch(&format!("/api/collections/{col_id}/resequence"))
        .authorization_bearer(&token)
        .json(&json!({
            "items": [
                { "uid": item1, "seq": 2.0 },
                { "uid": item2, "seq": 1.0 },
            ]
        }))
        .await;
    resp.assert_status_ok();
}

#[tokio::test]
async fn test_collection_not_found() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .get("/api/collections/nonexistent-col-uid")
        .authorization_bearer(&token)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_viewer_cannot_create_collection() {
    let server = create_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (token_b, _, email_b, _) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "WS").await;

    // Add user B as viewer
    server
        .post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({ "email": email_b, "role": "viewer" }))
        .await;
    let resp = server
        .post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token_b)
        .json(&json!({ "name": "Forbidden Col" }))
        .await;
    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

// ── Item Edge Cases ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_item() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "My Request").await;

    let resp: Value = server
        .get(&format!("/api/items/{item_id}"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(resp["data"]["name"], "My Request");
    assert_eq!(resp["data"]["type"], "request");
}

#[tokio::test]
async fn test_update_item() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Old Name").await;

    let resp: Value = server
        .patch(&format!("/api/items/{item_id}"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "New Name" }))
        .await
        .json();
    assert_eq!(resp["data"]["name"], "New Name");
}

#[tokio::test]
async fn test_move_item_into_folder() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let folder_id = create_folder_item(&server, &token, &col_id, "Folder A").await;
    let item_id = create_request_item(&server, &token, &col_id, "Request").await;

    // Move item into folder
    let resp = server
        .patch(&format!("/api/items/{item_id}/move"))
        .authorization_bearer(&token)
        .json(&json!({ "parentUid": folder_id, "seq": 1.0 }))
        .await;
    resp.assert_status_ok();

    // Verify
    let item: Value = server
        .get(&format!("/api/items/{item_id}"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(item["data"]["parentUid"], folder_id);
}

#[tokio::test]
async fn test_clone_item() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Original Request").await;

    let resp = server
        .post(&format!("/api/items/{item_id}/clone"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Cloned Request" }))
        .await;
    resp.assert_status(axum::http::StatusCode::CREATED);

    let body: Value = resp.json();
    let clone_id = body["data"]["uid"].as_str().unwrap();
    assert_ne!(clone_id, item_id.as_str());
    assert_eq!(body["data"]["name"], "Cloned Request");

    // Both items should exist
    let items: Value = server
        .get(&format!("/api/collections/{col_id}/items"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(items["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_item_not_found() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .get("/api/items/nonexistent-item-uid")
        .authorization_bearer(&token)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// ── Environment Edge Cases ────────────────────────────────────────────────────

#[tokio::test]
async fn test_delete_environment() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let env_id = create_workspace_environment(&server, &token, &ws_id, "Dev").await;

    server
        .delete(&format!("/api/environments/{env_id}"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);

    // Should be gone from list
    let envs: Value = server
        .get(&format!("/api/workspaces/{ws_id}/environments"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(envs["data"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_list_environments() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    create_workspace_environment(&server, &token, &ws_id, "Dev").await;
    create_workspace_environment(&server, &token, &ws_id, "Prod").await;

    let envs: Value = server
        .get(&format!("/api/workspaces/{ws_id}/environments"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(envs["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_collection_environment_crud() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;

    // Create collection-level env
    let env_id = create_collection_environment(&server, &token, &col_id, "Col Env").await;
    assert!(!env_id.is_empty());

    // List
    let envs: Value = server
        .get(&format!("/api/collections/{col_id}/environments"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(envs["data"].as_array().unwrap().len(), 1);

    // Update
    let updated: Value = server
        .patch(&format!("/api/environments/{env_id}"))
        .authorization_bearer(&token)
        .json(&json!({
            "variables": [{ "name": "API_KEY", "value": "abc123", "enabled": true }]
        }))
        .await
        .json();
    assert_eq!(updated["data"]["variables"].as_array().unwrap().len(), 1);

    // Delete
    server
        .delete(&format!("/api/environments/{env_id}"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_environment_not_found() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .delete("/api/environments/nonexistent-env-uid")
        .authorization_bearer(&token)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// ── Example Edge Cases ────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_example() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Req").await;
    let ex_id = create_example(&server, &token, &item_id, "200 OK").await;

    let resp: Value = server
        .get(&format!("/api/examples/{ex_id}"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(resp["data"]["name"], "200 OK");
    assert_eq!(resp["data"]["status_code"], 200);
    // Full get should include body
    assert!(resp["data"]["body"].is_string());
}

#[tokio::test]
async fn test_update_example() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Req").await;
    let ex_id = create_example(&server, &token, &item_id, "Original").await;

    let resp: Value = server
        .patch(&format!("/api/examples/{ex_id}"))
        .authorization_bearer(&token)
        .json(&json!({ "name": "Updated", "status_code": 201 }))
        .await
        .json();
    assert_eq!(resp["data"]["name"], "Updated");
    assert_eq!(resp["data"]["status_code"], 201);
}

#[tokio::test]
async fn test_delete_example() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Req").await;
    let ex_id = create_example(&server, &token, &item_id, "To Delete").await;

    server
        .delete(&format!("/api/examples/{ex_id}"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);

    // List should be empty
    let examples: Value = server
        .get(&format!("/api/items/{item_id}/examples"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(examples["data"].as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_list_examples_for_item() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Req").await;
    create_example(&server, &token, &item_id, "200 OK").await;
    create_example(&server, &token, &item_id, "404 Not Found").await;

    let examples: Value = server
        .get(&format!("/api/items/{item_id}/examples"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(examples["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_list_collection_examples() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item1 = create_request_item(&server, &token, &col_id, "Req1").await;
    let item2 = create_request_item(&server, &token, &col_id, "Req2").await;
    create_example(&server, &token, &item1, "Ex1").await;
    create_example(&server, &token, &item2, "Ex2").await;

    let examples: Value = server
        .get(&format!("/api/collections/{col_id}/examples"))
        .authorization_bearer(&token)
        .await
        .json();
    // Both examples belong to this collection
    assert_eq!(examples["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_example_list_excludes_body_field() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let item_id = create_request_item(&server, &token, &col_id, "Req").await;
    create_example(&server, &token, &item_id, "200 OK").await;

    // List endpoint returns ExampleSummary which should NOT include body/request_snapshot
    let examples: Value = server
        .get(&format!("/api/items/{item_id}/examples"))
        .authorization_bearer(&token)
        .await
        .json();
    let ex = &examples["data"][0];
    assert!(ex["body"].is_null(), "list endpoint should not expose body field");
    assert!(ex["request_snapshot"].is_null(), "list endpoint should not expose request_snapshot field");
}

#[tokio::test]
async fn test_example_not_found() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let resp = server
        .get("/api/examples/nonexistent-ex-uid")
        .authorization_bearer(&token)
        .await;
    resp.assert_status(axum::http::StatusCode::NOT_FOUND);
}

// ── Sync Flow ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_sync_changes_empty() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let resp: Value = server
        .get(&format!("/api/workspaces/{ws_id}/changes"))
        .authorization_bearer(&token)
        .await
        .json();
    assert!(resp["data"].is_object() || resp["data"].is_array());
}

#[tokio::test]
async fn test_sync_changes_with_since_param() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    create_collection(&server, &token, &ws_id, "Col").await;

    // Since a past timestamp
    let resp = server
        .get(&format!("/api/workspaces/{ws_id}/changes?since=2020-01-01T00:00:00Z"))
        .authorization_bearer(&token)
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["data"].is_object() || body["data"].is_array());
}

#[tokio::test]
async fn test_sync_changes_non_member_returns_403() {
    let server = create_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (token_b, _, _, _) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "WS").await;

    // User B is not a member
    let resp = server
        .get(&format!("/api/workspaces/{ws_id}/changes"))
        .authorization_bearer(&token_b)
        .await;
    // Should return 404 (not a member, can't see workspace exists) or 403
    let status = resp.status_code().as_u16();
    assert!(status == 404 || status == 403, "Expected 403 or 404 for non-member, got {status}");
}

// ── Insomnia Import ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_import_insomnia_collection() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    // Minimal valid Insomnia export v4
    let insomnia_json = json!({
        "_type": "export",
        "__export_format": 4,
        "__export_date": "2024-01-01T00:00:00.000Z",
        "__export_source": "insomnia.desktop.app:v2023.5.8",
        "resources": [
            {
                "_id": "wrk_001",
                "_type": "workspace",
                "name": "My Insomnia Collection",
                "description": "",
                "scope": "collection"
            },
            {
                "_id": "req_001",
                "_type": "request",
                "parentId": "wrk_001",
                "name": "Get Users",
                "method": "GET",
                "url": "https://api.example.com/users",
                "headers": [],
                "body": {}
            }
        ]
    });

    let resp = server
        .post(&format!("/api/workspaces/{ws_id}/import/insomnia"))
        .authorization_bearer(&token)
        .json(&json!({ "json": insomnia_json.to_string() }))
        .await;

    resp.assert_status(axum::http::StatusCode::CREATED);
    let body: Value = resp.json();
    assert_eq!(body["data"]["collection_name"], "My Insomnia Collection");
    assert!(body["data"]["collectionUid"].is_string());
    assert_eq!(body["data"]["imported"]["requests"], 1);
}

// ── Public Docs Flow ──────────────────────────────────────────────────────────

#[tokio::test]
async fn test_publish_and_unpublish_docs() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "My API").await;

    // Publish with a custom slug (visibility is camelCase: "public" not "Public")
    let slug = format!("test-slug-{}", uuid::Uuid::new_v4().simple());
    let pub_resp = server
        .post(&format!("/api/collections/{col_id}/docs/publish"))
        .authorization_bearer(&token)
        .json(&json!({
            "visibility": { "type": "public" },
            "custom_slug": slug
        }))
        .await;
    pub_resp.assert_status(axum::http::StatusCode::CREATED);
    let pub_body: Value = pub_resp.json();
    assert_eq!(pub_body["data"]["slug"], slug);

    // Get docs status — field is "enabled" not "published"
    let status: Value = server
        .get(&format!("/api/collections/{col_id}/docs/status"))
        .authorization_bearer(&token)
        .await
        .json();
    assert_eq!(status["data"]["enabled"], true);

    // Public access without auth
    let public_resp = server
        .get(&format!("/api/public/docs/{slug}"))
        .await;
    public_resp.assert_status_ok();

    // Unpublish
    server
        .delete(&format!("/api/collections/{col_id}/docs/unpublish"))
        .authorization_bearer(&token)
        .await
        .assert_status(axum::http::StatusCode::NO_CONTENT);

    // After unpublish, public access should fail
    let after: axum_test::TestResponse = server
        .get(&format!("/api/public/docs/{slug}"))
        .await;
    after.assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_check_slug_availability() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let slug = format!("unique-slug-{}", uuid::Uuid::new_v4().simple());

    // Slug should be available before publishing (response is NOT wrapped in "data")
    let avail: Value = server
        .get(&format!("/api/collections/docs/check-slug/{slug}"))
        .await
        .json();
    assert_eq!(avail["available"], true);

    // Publish with that slug
    server
        .post(&format!("/api/collections/{col_id}/docs/publish"))
        .authorization_bearer(&token)
        .json(&json!({
            "visibility": { "type": "public" },
            "custom_slug": slug
        }))
        .await;

    // Now slug should be unavailable
    let unavail: Value = server
        .get(&format!("/api/collections/docs/check-slug/{slug}"))
        .await
        .json();
    assert_eq!(unavail["available"], false);
}

#[tokio::test]
async fn test_viewer_cannot_publish_docs() {
    let server = create_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (token_b, _, email_b, _) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "WS").await;
    let col_id = create_collection(&server, &token_a, &ws_id, "Col").await;

    // Add user B as viewer
    server
        .post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({ "email": email_b, "role": "viewer" }))
        .await;

    // Viewer tries to publish → forbidden
    let resp = server
        .post(&format!("/api/collections/{col_id}/docs/publish"))
        .authorization_bearer(&token_b)
        .json(&json!({
            "visibility": { "type": "public" }
        }))
        .await;
    resp.assert_status(axum::http::StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_update_docs() {
    let server = create_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;
    let col_id = create_collection(&server, &token, &ws_id, "Col").await;
    let slug = format!("test-update-{}", uuid::Uuid::new_v4().simple());

    // Publish first
    server
        .post(&format!("/api/collections/{col_id}/docs/publish"))
        .authorization_bearer(&token)
        .json(&json!({
            "visibility": { "type": "public" },
            "custom_slug": slug
        }))
        .await;

    // Update settings
    let resp = server
        .patch(&format!("/api/collections/{col_id}/docs"))
        .authorization_bearer(&token)
        .json(&json!({
            "settings": { "showTryItOut": false }
        }))
        .await;
    resp.assert_status_ok();
}

// ── WebSocket Flow ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_websocket_ping_pong() {
    let server = create_ws_test_server().await;
    let (token, _) = register_and_login(&server).await;

    let mut ws = server
        .get_websocket(&format!("/ws?token={token}"))
        .await
        .into_websocket()
        .await;

    ws.send_text(json!({ "type": "Ping" }).to_string()).await;
    let response: Value = ws.receive_json().await;
    assert_eq!(response["type"], "Pong");

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_invalid_token_gets_error() {
    let server = create_ws_test_server().await;

    // Connect with invalid token — the WS connection upgrades but server sends back an error message
    let mut ws = server
        .get_websocket("/ws?token=invalid.jwt.token")
        .await
        .into_websocket()
        .await;

    let response: Value = ws.receive_json().await;
    assert_eq!(response["type"], "Error");

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_subscribe_and_unsubscribe() {
    let server = create_ws_test_server().await;
    let (token, _) = register_and_login(&server).await;
    let ws_id = create_workspace(&server, &token, "WS").await;

    let mut ws = server
        .get_websocket(&format!("/ws?token={token}"))
        .await
        .into_websocket()
        .await;

    // Subscribe
    ws.send_text(json!({ "type": "Subscribe", "workspace_id": ws_id }).to_string()).await;

    // Unsubscribe
    ws.send_text(json!({ "type": "Unsubscribe", "workspace_id": ws_id }).to_string()).await;

    // Ping to verify connection is still alive
    ws.send_text(json!({ "type": "Ping" }).to_string()).await;
    let response: Value = ws.receive_json().await;
    assert_eq!(response["type"], "Pong");

    ws.close().await;
}

#[tokio::test]
async fn test_websocket_subscribe_broadcasts_collection_change() {
    let server = create_ws_test_server().await;
    let (token_a, _, _, _) = register_user_full(&server).await;
    let (token_b, _, email_b, _) = register_user_full(&server).await;
    let ws_id = create_workspace(&server, &token_a, "Shared WS").await;

    // Add user B as editor
    server
        .post(&format!("/api/workspaces/{ws_id}/members"))
        .authorization_bearer(&token_a)
        .json(&json!({ "email": email_b, "role": "editor" }))
        .await;

    // User B subscribes
    let mut ws_b = server
        .get_websocket(&format!("/ws?token={token_b}"))
        .await
        .into_websocket()
        .await;
    ws_b.send_text(json!({ "type": "Subscribe", "workspace_id": ws_id }).to_string()).await;

    // Give server time to process subscription
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // User A creates a collection (triggers broadcast)
    server
        .post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(&token_a)
        .json(&json!({ "name": "Broadcast Test" }))
        .await;

    // User B should receive the event
    let event: Value = ws_b.receive_json().await;
    assert_eq!(event["type"], "Event");
    assert_eq!(event["workspace_id"], ws_id);

    ws_b.close().await;
}
