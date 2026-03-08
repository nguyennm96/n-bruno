use mongodb::Database;

use crate::{
    config::Config,
    services::{
        auth::AuthService,
        ai::AiService,
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
        oauth::OauthService,
        public_docs::PublicDocsService,
        sync::SyncService,
        workspace::WorkspaceService,
    },
    ws::WsManager,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: Database,
    pub auth_service: AuthService,
    pub oauth_service: OauthService,
    pub workspace_service: WorkspaceService,
    pub invite_service: InviteService,
    pub collection_service: CollectionService,
    pub item_service: ItemService,
    pub environment_service: EnvironmentService,
    pub example_service: ExampleService,
    pub sync_service: SyncService,
    pub ws_manager: WsManager,
    // Phase 10: Import/Export
    pub postman_service: PostmanService,
    pub openapi_service: OpenApiService,
    pub insomnia_service: InsomniaService,
    // Public Documentation
    pub public_docs_service: PublicDocsService,
    // AI
    pub ai_service: AiService,
}
