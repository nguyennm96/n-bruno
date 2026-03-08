mod helpers;
use helpers::{bearer, TestApp};

use axum::http::StatusCode;
use serde_json::{json, Value};

// ── Register ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn register_success_returns_201_with_user() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/register")
        .json(&json!({ "email": "alice@test.com", "password": "password123", "name": "Alice" }))
        .await;
    resp.assert_status(StatusCode::CREATED);
    let body: Value = resp.json();
    assert!(body["data"]["id"].is_string());
    assert_eq!(body["data"]["email"], "alice@test.com");
    assert_eq!(body["data"]["name"], "Alice");
    // Password hash must NOT be in the response
    assert!(body["data"]["password_hash"].is_null());
}

#[tokio::test]
async fn register_duplicate_email_returns_409() {
    let app = TestApp::spawn().await;
    let payload = json!({ "email": "dup@test.com", "password": "password123", "name": "Dup" });
    app.server.post("/api/auth/register").json(&payload).await;
    let resp = app.server.post("/api/auth/register").json(&payload).await;
    resp.assert_status(StatusCode::CONFLICT);
    let body: Value = resp.json();
    assert_eq!(body["error"]["code"], "CONFLICT");
}

#[tokio::test]
async fn register_invalid_email_returns_422() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/register")
        .json(&json!({ "email": "not-an-email", "password": "password123", "name": "X" }))
        .await;
    resp.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn register_short_password_returns_422() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/register")
        .json(&json!({ "email": "short@test.com", "password": "1234567", "name": "Short" }))
        .await;
    resp.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn register_empty_name_returns_422() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/register")
        .json(&json!({ "email": "noname@test.com", "password": "password123", "name": "" }))
        .await;
    resp.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

// ── Login ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn login_success_returns_tokens() {
    let app = TestApp::spawn().await;
    app.server
        .post("/api/auth/register")
        .json(&json!({ "email": "bob@test.com", "password": "password123", "name": "Bob" }))
        .await;

    let resp = app
        .server
        .post("/api/auth/login")
        .json(&json!({ "email": "bob@test.com", "password": "password123" }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["data"]["access_token"].is_string());
    assert!(body["data"]["refresh_token"].is_string());
    assert_eq!(body["data"]["token_type"], "Bearer");
}

#[tokio::test]
async fn login_wrong_password_returns_401() {
    let app = TestApp::spawn().await;
    app.server
        .post("/api/auth/register")
        .json(&json!({ "email": "carol@test.com", "password": "correct-password", "name": "Carol" }))
        .await;

    let resp = app
        .server
        .post("/api/auth/login")
        .json(&json!({ "email": "carol@test.com", "password": "wrong-password" }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn login_unknown_email_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/login")
        .json(&json!({ "email": "nobody@test.com", "password": "password123" }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

// ── Refresh ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn refresh_rotates_token() {
    let app = TestApp::spawn().await;
    let (_, refresh) = app.register_and_login("dave@test.com", "password123", "Dave").await;

    let resp = app
        .server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": refresh }))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    let new_access = body["data"]["access_token"].as_str().unwrap();
    let new_refresh = body["data"]["refresh_token"].as_str().unwrap();
    assert!(!new_access.is_empty());
    // New refresh token should differ from the old one (rotation)
    assert_ne!(new_refresh, refresh);
}

#[tokio::test]
async fn refresh_invalid_token_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": "completely-invalid-token-value" }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn refresh_reused_token_returns_401() {
    let app = TestApp::spawn().await;
    let (_, refresh) = app.register_and_login("eve@test.com", "password123", "Eve").await;

    // Use the refresh token once.
    app.server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": refresh }))
        .await;

    // Using it a second time must fail (rotation = one-time use).
    let resp = app
        .server
        .post("/api/auth/refresh")
        .json(&json!({ "refresh_token": refresh }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

// ── Logout ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn logout_success_returns_204() {
    let app = TestApp::spawn().await;
    let (access, refresh) = app.register_and_login("frank@test.com", "password123", "Frank").await;

    let resp = app
        .server
        .post("/api/auth/logout")
        .add_header("Authorization", bearer(&access))
        .json(&json!({ "refresh_token": refresh }))
        .await;
    resp.assert_status(StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn logout_no_auth_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .post("/api/auth/logout")
        .json(&json!({ "refresh_token": "any" }))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

// ── Me ────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn me_returns_current_user() {
    let app = TestApp::spawn().await;
    let (access, _) = app.register_and_login("grace@test.com", "password123", "Grace").await;

    let resp = app
        .server
        .get("/api/auth/me")
        .add_header("Authorization", bearer(&access))
        .await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["data"]["email"], "grace@test.com");
    assert_eq!(body["data"]["name"], "Grace");
    assert!(body["data"]["id"].is_string());
    // created_at must be present, password_hash must not
    assert!(body["data"]["created_at"].is_string());
    assert!(body["data"]["password_hash"].is_null());
}

#[tokio::test]
async fn me_no_auth_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app.server.get("/api/auth/me").await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_invalid_token_returns_401() {
    let app = TestApp::spawn().await;
    let resp = app
        .server
        .get("/api/auth/me")
        .add_header("Authorization", bearer("invalid.jwt.token"))
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}

// ── Auth middleware edge cases ────────────────────────────────────────────────

#[tokio::test]
async fn protected_route_with_malformed_header_returns_401() {
    let app = TestApp::spawn().await;
    // "Token" prefix instead of "Bearer"
    let resp = app
        .server
        .get("/api/auth/me")
        .add_header("Authorization", "Token some-token".parse::<axum::http::HeaderValue>().unwrap())
        .await;
    resp.assert_status(StatusCode::UNAUTHORIZED);
}
