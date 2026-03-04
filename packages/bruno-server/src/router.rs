use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    handlers::{
        auth, collection, environment, example, health, import_export, item, workspace,
    },
    middleware::auth_middleware,
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
        // WebSocket
        .route("/ws", get(ws::ws_handler));

    let protected_routes = Router::new()
        // Auth - protected
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        // Workspaces
        .route("/api/workspaces", post(workspace::create_workspace))
        .route("/api/workspaces", get(workspace::list_workspaces))
        .route("/api/workspaces/:id", get(workspace::get_workspace))
        .route("/api/workspaces/:id", patch(workspace::update_workspace))
        .route("/api/workspaces/:id", delete(workspace::delete_workspace))
        .route("/api/workspaces/:id/members", get(workspace::list_members))
        .route("/api/workspaces/:id/members", post(workspace::add_member))
        .route("/api/workspaces/:id/members/:user_id", delete(workspace::remove_member))
        // Collections
        .route("/api/workspaces/:workspace_id/collections", post(collection::create_collection))
        .route("/api/workspaces/:workspace_id/collections", get(collection::list_collections))
        .route("/api/collections/:id", get(collection::get_collection))
        .route("/api/collections/:id", patch(collection::update_collection))
        .route("/api/collections/:id", delete(collection::delete_collection))
        .route("/api/collections/:id/clone", post(collection::clone_collection))
        .route("/api/collections/:id/resequence", patch(collection::resequence_items))
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
        .route("/api/examples/:id", patch(example::update_example))
        .route("/api/examples/:id", delete(example::delete_example))
        // ── Phase 10: Import / Export ──────────────────────────────────────
        // Import
        .route("/api/workspaces/:workspace_id/import/postman", post(import_export::import_postman))
        .route("/api/workspaces/:workspace_id/import/insomnia", post(import_export::import_insomnia))
        // Export collection (format=postman|openapi|swagger via query param)
        .route("/api/collections/:id/export", get(import_export::export_collection))
        // Export entire workspace (all collections as Postman)
        .route("/api/workspaces/:workspace_id/export", get(import_export::export_workspace))
        // Apply auth middleware to all protected routes
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        // TODO: Re-enable after fixing OpenAPI schema definitions
        // .merge(crate::openapi::swagger_ui())
        .merge(public_routes)
        .merge(protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive()) // Configure properly in production
        .with_state(state)
}
