use crate::{
    config::Config,
    services::{
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
    },
    ws::WsManager,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub auth_service: AuthService,
    pub workspace_service: WorkspaceService,
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
}
