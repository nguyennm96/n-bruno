use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use tower_http::{compression::CompressionLayer, cors::CorsLayer};

use crate::{
    handlers::{
        ai, auth, collection, environment, example, health, import_export, invite, item, public_docs,
        sync, users, workspace,
    },
    middleware::{auth_middleware, request_logger},
    state::AppState,
    ws,
};

pub fn create_router(state: AppState) -> Router {
    let public_routes = Router::new()
        .route("/api/health", get(health::health_check))
        // Auth - public
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/refresh", post(auth::refresh))
        // Password reset — public (unauthenticated users)
        .route("/api/auth/forgot-password", post(auth::forgot_password))
        .route("/api/auth/reset-password", post(auth::reset_password))
        // OAuth — public
        .route("/api/auth/oauth/:provider/authorize", get(auth::oauth_authorize))
        .route("/api/auth/oauth/:provider/callback", get(auth::oauth_callback))
        .route("/api/auth/oauth/exchange", post(auth::oauth_exchange))
        // Invite — public (validate before login)
        .route("/api/invites/validate", get(invite::validate_invite))
        // Public Documentation - public access
        .route("/api/public/docs/:slug", get(public_docs::get_public_docs))
        .route(
            "/api/public/docs/:slug/verify-password",
            post(public_docs::verify_password),
        )
        .route(
            "/api/collections/docs/check-slug/:slug",
            get(public_docs::check_slug_availability),
        )
        // WebSocket
        .route("/ws", get(ws::ws_handler));

    let protected_routes = Router::new()
        // Auth - protected
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/me", patch(auth::update_me_handler))
        // Users
        .route("/api/users/search", get(users::search_user))
        // Workspaces
        .route("/api/workspaces", post(workspace::create_workspace))
        .route("/api/workspaces", get(workspace::list_workspaces))
        .route("/api/workspaces/:id", get(workspace::get_workspace))
        .route("/api/workspaces/:id", patch(workspace::update_workspace))
        .route("/api/workspaces/:id", delete(workspace::delete_workspace))
        .route("/api/workspaces/:id/leave", delete(workspace::leave_workspace))
        .route("/api/workspaces/:id/transfer-ownership", patch(workspace::transfer_ownership))
        // Workspace Members
        .route("/api/workspaces/:id/members", get(workspace::list_members))
        .route("/api/workspaces/:id/members", post(workspace::add_member))
        .route("/api/workspaces/:id/members/:user_id", delete(workspace::remove_member))
        .route("/api/workspaces/:id/members/:user_id", patch(workspace::update_member_role))
        // Workspace Invites
        .route("/api/workspaces/:id/invites", post(invite::send_invite))
        .route("/api/workspaces/:id/invites", get(invite::list_invites))
        .route("/api/workspaces/:id/invites/:invite_id", delete(invite::cancel_invite))
        .route("/api/invites/accept", post(invite::accept_invite))
        // Collections
        .route("/api/workspaces/:workspace_id/collections", post(collection::create_collection))
        .route("/api/workspaces/:workspace_id/collections", get(collection::list_collections))
        .route("/api/collections/:id", get(collection::get_collection))
        .route("/api/collections/:id", patch(collection::update_collection))
        .route("/api/collections/:id", delete(collection::delete_collection))
        .route("/api/collections/:id/clone", post(collection::clone_collection))
        .route("/api/collections/:id/resequence", patch(collection::resequence_items))
        // Public Documentation - protected endpoints
        .route(
            "/api/collections/:id/docs/publish",
            post(public_docs::publish_docs),
        )
        .route("/api/collections/:id/docs", patch(public_docs::update_docs))
        .route(
            "/api/collections/:id/docs/unpublish",
            delete(public_docs::unpublish_docs),
        )
        .route(
            "/api/collections/:id/docs/status",
            get(public_docs::get_docs_status),
        )
        .route(
            "/api/collections/:id/docs/upload-css",
            post(public_docs::upload_custom_css),
        )
        .route(
            "/api/collections/:id/docs/upload-logo",
            post(public_docs::upload_custom_logo),
        )
        .route(
            "/api/collections/:id/docs/custom-css",
            delete(public_docs::delete_custom_css),
        )
        .route(
            "/api/collections/:id/docs/custom-logo",
            delete(public_docs::delete_custom_logo),
        )
        // Items (Folders & Requests)
        .route("/api/collections/:id/folders", post(item::create_folder))
        .route("/api/collections/:id/requests", post(item::create_request))
        .route("/api/collections/:id/items", get(item::list_items))
        .route("/api/items/:id", get(item::get_item))
        .route("/api/items/:id", patch(item::update_item))
        .route("/api/items/:id", delete(item::delete_item))
        .route("/api/items/:id/move", patch(item::move_item))
        .route("/api/items/:id/clone", post(item::clone_item))
        // Environments (Workspace-level)
        .route("/api/workspaces/:id/environments", post(environment::create_environment))
        .route("/api/workspaces/:id/environments", get(environment::list_environments))
        .route("/api/environments/:id", patch(environment::update_environment))
        .route("/api/environments/:id", delete(environment::delete_environment))
        // Environments (Collection-level)
        .route("/api/collections/:id/environments", post(environment::create_collection_environment))
        .route("/api/collections/:id/environments", get(environment::list_collection_environments))
        // Examples
        .route("/api/items/:item_id/examples", post(example::create_example))
        .route("/api/items/:item_id/examples", get(example::list_examples))
        .route("/api/collections/:id/examples", get(example::list_collection_examples))
        .route("/api/examples/:id", get(example::get_example))
        .route("/api/examples/:id", patch(example::update_example))
        .route("/api/examples/:id", delete(example::delete_example))
        // Import / Export
        .route("/api/workspaces/:workspace_id/import/postman", post(import_export::import_postman))
        .route("/api/workspaces/:workspace_id/import/insomnia", post(import_export::import_insomnia))
        .route("/api/collections/:id/export", get(import_export::export_collection))
        .route("/api/workspaces/:workspace_id/export", get(import_export::export_workspace))
        // Sync
        .route("/api/workspaces/:id/changes", get(sync::get_workspace_changes))
        // AI
        .route("/api/ai/generate-docs", post(ai::generate_docs_handler))
        // Apply auth middleware to all protected routes
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(CompressionLayer::new())
        .layer(middleware::from_fn(request_logger))
        .layer(CorsLayer::permissive()) // Configure properly in production
        .with_state(state)
}
