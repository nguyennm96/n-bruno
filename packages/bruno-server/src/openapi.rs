use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::models::{
    collection::{Collection, CollectionResponse},
    environment::{Environment, EnvironmentResponse, EnvVariable},
    example::Example,
    item::{Item, ItemResponse, RequestBody},
    workspace::{Workspace, WorkspaceResponse, WorkspaceRole},
    token::TokenResponse,
};

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::auth::health_check,
        crate::handlers::auth::register,
        crate::handlers::auth::login,
        crate::handlers::auth::get_me,
    ),
    components(
        schemas(
            Collection, CollectionResponse,
            Environment, EnvironmentResponse, EnvVariable,
            Example,
            Item, ItemResponse, RequestBody,
            Workspace, WorkspaceResponse,
            TokenResponse,
            crate::handlers::auth::RegisterRequest,
            crate::handlers::auth::LoginRequest,
            crate::handlers::auth::AuthResponse,
        )
    ),
    info(
        title = "Bruno Server API",
        version = "1.0.0",
        description = "API documentation for Bruno Server"
    )
)]
pub struct ApiDoc;

pub fn swagger_ui() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi())
}
