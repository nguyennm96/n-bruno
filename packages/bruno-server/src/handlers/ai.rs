use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::errors::AppResult;
use crate::services::ai::{
    DocBody, DocExample, DocGenerationContext, DocKeyValue,
};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct GenerateDocsRequest {
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Option<Vec<DocKeyValue>>,
    pub params: Option<Vec<DocKeyValue>>,
    pub body: Option<DocBody>,
    pub auth_type: Option<String>,
    pub examples: Option<Vec<DocExample>>,
}

#[derive(Debug, Serialize)]
pub struct GenerateDocsResponse {
    pub docs: String,
}

pub async fn generate_docs_handler(
    State(state): State<AppState>,
    Json(req): Json<GenerateDocsRequest>,
) -> AppResult<Json<GenerateDocsResponse>> {
    let context = DocGenerationContext {
        name: req.name,
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        body: req.body,
        auth_type: req.auth_type,
        examples: req.examples,
    };

    let docs = state.ai_service.generate_docs(context).await?;

    Ok(Json(GenerateDocsResponse { docs }))
}
