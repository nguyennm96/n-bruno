//! Shared test helpers — TestApp, seed functions, token utilities.

use axum_test::TestServer;
use mongodb::Database;
use serde_json::{json, Value};
use testcontainers::{runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::mongo::Mongo;
use uuid::Uuid;

use bruno_server::{build_app, config::Config};

// ── TestApp ───────────────────────────────────────────────────────────────────

/// One running test application backed by a real, ephemeral MongoDB instance.
///
/// Each `TestApp::spawn()` call creates a **unique database** (UUID-named) inside
/// the container so test suites can run fully in parallel without conflicts.
pub struct TestApp {
    pub server: TestServer,
    pub db: Database,
    /// Keep the container alive for the lifetime of this `TestApp`.
    _container: ContainerAsync<Mongo>,
}

impl TestApp {
    pub async fn spawn() -> Self {
        // Start a MongoDB container (requires Docker).
        let container = Mongo::default()
            .start()
            .await
            .expect("Failed to start MongoDB container — is Docker running?");

        let port = container
            .get_host_port_ipv4(27017)
            .await
            .expect("Failed to get MongoDB port");

        let uri = format!("mongodb://127.0.0.1:{}", port);
        // Unique DB name so parallel tests never share state.
        let db_name = format!("bruno_test_{}", Uuid::new_v4().simple());

        let cfg = Config::for_test(uri.clone(), db_name.clone());

        let client = mongodb::Client::with_uri_str(&uri)
            .await
            .expect("MongoDB client");
        let db = client.database(&db_name);

        let app = build_app(cfg, db.clone()).await;
        let server = TestServer::new(app).expect("Failed to create TestServer");

        Self { server, db, _container: container }
    }

    // ── Auth helpers ──────────────────────────────────────────────────────────

    /// Register a new user and return `(access_token, refresh_token)`.
    pub async fn register_and_login(
        &self,
        email: &str,
        password: &str,
        name: &str,
    ) -> (String, String) {
        let resp = self
            .server
            .post("/api/auth/register")
            .json(&json!({ "email": email, "password": password, "name": name }))
            .await;
        assert_eq!(resp.status_code(), 201, "register failed: {}", resp.text());

        let resp = self
            .server
            .post("/api/auth/login")
            .json(&json!({ "email": email, "password": password }))
            .await;
        assert_eq!(resp.status_code(), 200, "login failed: {}", resp.text());

        let body: Value = resp.json();
        let access = body["data"]["access_token"].as_str().unwrap().to_string();
        let refresh = body["data"]["refresh_token"].as_str().unwrap().to_string();
        (access, refresh)
    }

    /// Login an already-registered user. Returns `(access_token, refresh_token)`.
    pub async fn login(&self, email: &str, password: &str) -> (String, String) {
        let resp = self
            .server
            .post("/api/auth/login")
            .json(&json!({ "email": email, "password": password }))
            .await;
        assert_eq!(resp.status_code(), 200, "login failed: {}", resp.text());

        let body: Value = resp.json();
        let access = body["data"]["access_token"].as_str().unwrap().to_string();
        let refresh = body["data"]["refresh_token"].as_str().unwrap().to_string();
        (access, refresh)
    }

    /// Create a workspace and return its `uid`.
    pub async fn create_workspace(&self, token: &str, name: &str) -> String {
        let resp = self
            .server
            .post("/api/workspaces")
            .authorization_bearer(token)
            .json(&json!({ "name": name }))
            .await;
        assert_eq!(resp.status_code(), 201, "create_workspace failed: {}", resp.text());
        resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string()
    }

    /// Create a collection inside a workspace and return its `uid`.
    pub async fn create_collection(
        &self,
        token: &str,
        workspace_uid: &str,
        name: &str,
    ) -> String {
        let resp = self
            .server
            .post(&format!("/api/workspaces/{}/collections", workspace_uid))
            .authorization_bearer(token)
            .json(&json!({ "name": name }))
            .await;
        assert_eq!(resp.status_code(), 201, "create_collection failed: {}", resp.text());
        resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string()
    }

    /// Create a request item inside a collection and return its `uid`.
    pub async fn create_request(
        &self,
        token: &str,
        collection_uid: &str,
        name: &str,
    ) -> String {
        let resp = self
            .server
            .post(&format!("/api/collections/{}/requests", collection_uid))
            .authorization_bearer(token)
            .json(&json!({
                "name": name,
                "request": {
                    "method": "GET",
                    "url": "https://example.com",
                    "headers": [],
                    "params": [],
                    "body": { "mode": "none" }
                }
            }))
            .await;
        assert_eq!(resp.status_code(), 201, "create_request failed: {}", resp.text());
        resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string()
    }

    /// Create a folder inside a collection and return its `uid`.
    pub async fn create_folder(
        &self,
        token: &str,
        collection_uid: &str,
        name: &str,
    ) -> String {
        let resp = self
            .server
            .post(&format!("/api/collections/{}/folders", collection_uid))
            .authorization_bearer(token)
            .json(&json!({ "name": name }))
            .await;
        assert_eq!(resp.status_code(), 201, "create_folder failed: {}", resp.text());
        resp.json::<Value>()["data"]["uid"].as_str().unwrap().to_string()
    }

    /// Register a second user; return their user ObjectId hex string.
    pub async fn register_user(&self, email: &str, password: &str, name: &str) -> String {
        let resp = self
            .server
            .post("/api/auth/register")
            .json(&json!({ "email": email, "password": password, "name": name }))
            .await;
        assert_eq!(resp.status_code(), 201);
        resp.json::<Value>()["data"]["id"].as_str().unwrap().to_string()
    }
}

// ── Convenience ───────────────────────────────────────────────────────────────

/// Build an `Authorization: Bearer <token>` header value.
pub fn bearer(token: &str) -> axum::http::HeaderValue {
    format!("Bearer {}", token)
        .parse::<axum::http::HeaderValue>()
        .unwrap()
}
