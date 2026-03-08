/// Test helpers shared across integration test files.
/// Uses the `bruno_server` library crate.
use axum_test::{TestServer, TestServerConfig, Transport};
use serde_json::{json, Value};

/// Creates a TestServer with an isolated test MongoDB database.
/// Each call creates a fresh database with a unique UUID name.
pub async fn create_test_server() -> TestServer {
    create_test_server_internal(false).await
}

/// Creates a TestServer bound to a real TCP port (required for WebSocket tests).
pub async fn create_ws_test_server() -> TestServer {
    create_test_server_internal(true).await
}

async fn create_test_server_internal(use_http_transport: bool) -> TestServer {
    let db_name = format!("bruno_test_{}", uuid::Uuid::new_v4().simple());
    let uri = std::env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

    let config = bruno_server::config::Config::for_test(uri.clone(), db_name.clone());

    let client = mongodb::Client::with_uri_str(&uri)
        .await
        .expect("MongoDB connect failed");
    let db = client.database(&db_name);

    let app = bruno_server::build_app(config, db).await;

    if use_http_transport {
        TestServer::new_with_config(
            app,
            TestServerConfig {
                transport: Some(Transport::HttpRandomPort),
                ..TestServerConfig::default()
            },
        )
        .unwrap()
    } else {
        TestServer::new(app).unwrap()
    }
}

pub fn unique_email() -> String {
    format!("user_{}@test.example.com", uuid::Uuid::new_v4().simple())
}

/// Registers and logs in a user. Returns (access_token, email).
pub async fn register_and_login(server: &TestServer) -> (String, String) {
    let email = unique_email();

    server
        .post("/api/auth/register")
        .json(&json!({ "email": email, "password": "password123", "name": "Test User" }))
        .await;

    let resp: Value = server
        .post("/api/auth/login")
        .json(&json!({ "email": email, "password": "password123" }))
        .await
        .json();

    let token = resp["data"]["access_token"]
        .as_str()
        .expect("access_token missing in login response")
        .to_string();
    (token, email)
}

/// Registers and logs in a user. Returns (access_token, refresh_token, email, user_id_hex).
pub async fn register_user_full(server: &TestServer) -> (String, String, String, String) {
    let email = unique_email();
    let name = "Test User";

    let reg: Value = server
        .post("/api/auth/register")
        .json(&json!({ "email": email, "password": "password123", "name": name }))
        .await
        .json();

    let user_id = reg["data"]["id"].as_str().unwrap_or_default().to_string();

    let resp: Value = server
        .post("/api/auth/login")
        .json(&json!({ "email": email, "password": "password123" }))
        .await
        .json();

    let access_token = resp["data"]["access_token"].as_str().unwrap().to_string();
    let refresh_token = resp["data"]["refresh_token"].as_str().unwrap().to_string();
    (access_token, refresh_token, email, user_id)
}

pub async fn create_workspace(server: &TestServer, token: &str, name: &str) -> String {
    let resp: Value = server
        .post("/api/workspaces")
        .authorization_bearer(token)
        .json(&json!({ "name": name }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

pub async fn create_collection(server: &TestServer, token: &str, ws_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/workspaces/{ws_id}/collections"))
        .authorization_bearer(token)
        .json(&json!({ "name": name }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

/// Creates a request item (not inside any folder). Returns item uid.
pub async fn create_request_item(server: &TestServer, token: &str, col_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/collections/{col_id}/requests"))
        .authorization_bearer(token)
        .json(&json!({
            "name": name,
            "seq": 1.0,
            "request": {
                "method": "GET",
                "url": "https://example.com",
                "headers": [],
                "params": [],
                "body": { "mode": "none" }
            }
        }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

/// Creates a folder item. Returns folder uid.
pub async fn create_folder_item(server: &TestServer, token: &str, col_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/collections/{col_id}/folders"))
        .authorization_bearer(token)
        .json(&json!({ "name": name, "seq": 1.0 }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

/// Creates a workspace-level environment. Returns env uid.
pub async fn create_workspace_environment(server: &TestServer, token: &str, ws_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/workspaces/{ws_id}/environments"))
        .authorization_bearer(token)
        .json(&json!({ "name": name, "variables": [] }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

/// Creates a collection-level environment. Returns env uid.
pub async fn create_collection_environment(server: &TestServer, token: &str, col_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/collections/{col_id}/environments"))
        .authorization_bearer(token)
        .json(&json!({ "name": name, "variables": [] }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}

/// Creates an example for a request item. Returns example uid.
pub async fn create_example(server: &TestServer, token: &str, item_id: &str, name: &str) -> String {
    let resp: Value = server
        .post(&format!("/api/items/{item_id}/examples"))
        .authorization_bearer(token)
        .json(&json!({
            "name": name,
            "status_code": 200,
            "headers": { "Content-Type": "application/json" },
            "body": "{\"ok\": true}",
        }))
        .await
        .json();
    resp["data"]["uid"].as_str().unwrap().to_string()
}
