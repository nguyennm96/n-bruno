pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod serde_helpers;
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
    invite::InviteService,
    item::ItemService,
    mailer::MailerService,
    oauth::OauthService,
    public_docs::PublicDocsService,
    sync::SyncService,
    workspace::WorkspaceService,
    ai::AiService,
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
    let mailer = MailerService::new(&cfg);
    let invite_service = InviteService::new(&db, &cfg, mailer.clone());
    let ws_manager = WsManager::new();
    let oauth_service = OauthService::new(&db, cfg.clone());
    oauth_service.ensure_indexes().await.expect("OAuth index creation failed");
    let state = AppState {
        auth_service: AuthService::new(&db, cfg.clone(), mailer),
        oauth_service,
        collection_service: CollectionService::new(&db, workspace_service.clone(), ws_manager.clone()),
        item_service: ItemService::new(&db, workspace_service.clone(), ws_manager.clone()),
        environment_service: EnvironmentService::new(&db, workspace_service.clone(), ws_manager.clone()),
        example_service: ExampleService::new(&db, workspace_service.clone(), ws_manager.clone()),
        sync_service: SyncService::new(&db, workspace_service.clone()),
        postman_service: PostmanService::new(&db, workspace_service.clone()),
        openapi_service: OpenApiService::new(&db, workspace_service.clone()),
        insomnia_service: InsomniaService::new(&db, workspace_service.clone()),
        public_docs_service: PublicDocsService::new(&db, workspace_service.clone(), cfg.clone()),
        ai_service: AiService::new(&cfg),
        workspace_service,
        invite_service,
        ws_manager,
        db: db.clone(),
        config: cfg,
    };
    router::create_router(state)
}

