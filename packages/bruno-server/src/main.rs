mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod router;
mod serde_helpers;
mod services;
mod state;
mod ws;

use std::net::SocketAddr;

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ── Logging ───────────────────────────────────────────────────────────────
    //
    // LOG_FORMAT=text → human-readable text with timestamps
    // LOG_FORMAT=<any other value or unset> → newline-delimited JSON (default)
    //
    // Log level is controlled by RUST_LOG; defaults to info for the server
    // and warn for all other crates to keep the output focused.
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "bruno_server=info,warn".into());

    let use_json = std::env::var("LOG_FORMAT")
        .map(|v| !v.eq_ignore_ascii_case("text"))
        .unwrap_or(true);

    if use_json {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .json()
                    .with_current_span(true)
                    .with_span_list(false)
                    .with_target(true),
            )
            .init();
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                tracing_subscriber::fmt::layer()
                    .with_target(true)
                    .with_thread_ids(false)
                    .with_level(true),
            )
            .init();
    }

    tracing::info!("🚀 Starting Bruno Cloud Server...");

    // ── Config ────────────────────────────────────────────────────────────────
    let config = Config::from_env()?;
    tracing::info!(env = %config.app_env, "Config loaded");

    // ── Database ──────────────────────────────────────────────────────────────
    let db = db::connect(&config).await?;
    db::create_indexes(&db).await?;

    // ── Services ──────────────────────────────────────────────────────────────
    let mailer_service = MailerService::new(&config);
    if !mailer_service.is_configured() {
        tracing::warn!(
            "⚠️  SENDGRID_API_KEY is not set — email sending is disabled. \
             Workspace invites and password reset emails will fail until this is configured."
        );
    }
    let auth_service = AuthService::new(&db, config.clone(), mailer_service.clone());
    let oauth_service = OauthService::new(&db, config.clone());
    oauth_service.ensure_indexes().await?;
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

    // AI documentation generation service
    let ai_service = AiService::new(&config);

    let invite_service = InviteService::new(&db, &config, mailer_service);

    let state = AppState {
        config: config.clone(),
        db: db.clone(),
        auth_service,
        oauth_service,
        workspace_service,
        invite_service,
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
        ai_service,
    };

    // ── Router ────────────────────────────────────────────────────────────────
    let app = router::create_router(state);

    // ── Server ────────────────────────────────────────────────────────────────
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!(addr = %addr, "✅ Server listening");
    tracing::info!(url = %format!("http://{}/api/docs", addr), "API Docs");
    tracing::info!(url = %format!("ws://{}/ws?token=<jwt>", addr), "WebSocket");

    // into_make_service_with_connect_info gives request_logger access to the
    // client's TCP address for IP logging.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

