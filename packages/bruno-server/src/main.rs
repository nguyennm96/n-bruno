mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod router;
mod services;
mod state;
mod ws;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use config::Config;
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
    public_docs::PublicDocsService,
    sync::SyncService,
    workspace::WorkspaceService,
};
use state::AppState;
use ws::WsManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── Logging ───────────────────────────────────────────────────────────────
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "bruno_server=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("🚀 Starting Bruno Cloud Server...");

    // ── Config ────────────────────────────────────────────────────────────────
    let config = Config::from_env()?;
    tracing::info!("Environment: {}", config.app_env);

    // ── Database ──────────────────────────────────────────────────────────────
    let db = db::connect(&config).await?;
    db::create_indexes(&db).await?;

    // ── Services ──────────────────────────────────────────────────────────────
    let auth_service = AuthService::new(&db, config.clone());
    let workspace_service = WorkspaceService::new(&db);
    let ws_manager = WsManager::new();
    let collection_service = CollectionService::new(&db, workspace_service.clone(), ws_manager.clone());
    let item_service = ItemService::new(&db, workspace_service.clone(), ws_manager.clone());
    let environment_service = EnvironmentService::new(&db, workspace_service.clone(), ws_manager.clone());
    let example_service = ExampleService::new(&db, workspace_service.clone(), ws_manager.clone());

    // Phase 10: Import/Export services
    let postman_service = PostmanService::new(&db, workspace_service.clone());
    let openapi_service = OpenApiService::new(&db, workspace_service.clone());
    let insomnia_service = InsomniaService::new(&db, workspace_service.clone());
    let sync_service = SyncService::new(&db, workspace_service.clone());

    // Public Documentation service
    let public_docs_service = PublicDocsService::new(&db, workspace_service.clone(), config.clone());

    let state = AppState {
        config: config.clone(),
        auth_service,
        workspace_service,
        collection_service,
        item_service,
        environment_service,
        example_service,
        ws_manager,
        postman_service,
        openapi_service,
        insomnia_service,
        sync_service,
        public_docs_service,
    };

    // ── Router ────────────────────────────────────────────────────────────────
    let app = router::create_router(state);

    // ── Server ────────────────────────────────────────────────────────────────
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("✅ Server listening on http://{}", addr);
    tracing::info!("   API Docs: http://{}/api/docs", addr);
    tracing::info!("   WebSocket: ws://{}/ws?token=<jwt>", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
