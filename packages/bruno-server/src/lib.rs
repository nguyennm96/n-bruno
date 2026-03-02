pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod models;
// TODO: Fix OpenAPI schema definitions
// pub mod openapi;
pub mod router;
pub mod services;
pub mod state;
pub mod ws;

use axum::Router;
use services::{
    auth::AuthService,
    collection::CollectionService,
    environment::EnvironmentService,
    example::ExampleService,
    import_export::{
        insomnia::InsomniaService,
        openapi::OpenApiService,
        postman::PostmanService,
    },
    item::ItemService,
    workspace::WorkspaceService,
};
use state::AppState;
use ws::WsManager;

/// Build the full application router.
/// Used both by `main.rs` and by integration tests.
pub async fn build_app(
    cfg: config::Config,
    db: mongodb::Database,
) -> Router {
    db::create_indexes(&db).await.expect("Index creation failed");

    let workspace_service = WorkspaceService::new(&db);
    let state = AppState {
        auth_service: AuthService::new(&db, cfg.clone()),
        collection_service: CollectionService::new(&db, workspace_service.clone()),
        item_service: ItemService::new(&db, workspace_service.clone()),
        environment_service: EnvironmentService::new(&db, workspace_service.clone()),
        example_service: ExampleService::new(&db, workspace_service.clone()),
        postman_service: PostmanService::new(&db, workspace_service.clone()),
        openapi_service: OpenApiService::new(&db, workspace_service.clone()),
        insomnia_service: InsomniaService::new(&db, workspace_service.clone()),
        workspace_service,
        ws_manager: WsManager::new(),
        config: cfg,
    };
    router::create_router(state)
}
