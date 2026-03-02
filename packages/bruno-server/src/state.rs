use crate::{
    config::Config,
    services::{
        auth::AuthService,
        collection::CollectionService,
        environment::EnvironmentService,
        example::ExampleService,
        item::ItemService,
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
    pub ws_manager: WsManager,
}
