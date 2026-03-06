/// Test helpers shared across integration test files.
/// Uses the `bruno_server` library crate.
use axum_test::TestServer;
use serde_json::{json, Value};

/// Creates a TestServer with an isolated test MongoDB database.
/// Each call creates a fresh database with a unique UUID name.
pub async fn create_test_server() -> TestServer {
    let db_name = format!("bruno_test_{}", uuid::Uuid::new_v4().simple());
    let uri = std::env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());

    let config = bruno_server::config::Config::for_test(uri.clone(), db_name.clone());

    let client = mongodb::Client::with_uri_str(&uri)
        .await
        .expect("MongoDB connect failed");
    let db = client.database(&db_name);

    let app = bruno_server::build_app(config, db).await;
    TestServer::new(app).unwrap()
}

pub fn unique_email() -> String {
    format!("user_{}@test.example.com", uuid::Uuid::new_v4().simple())
}

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
