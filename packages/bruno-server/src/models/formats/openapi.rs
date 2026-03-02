/// OpenAPI 3.0 / Swagger 2.0 format structs
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

// ────────────────────────────────────────────────────────────────────────────
// OpenAPI 3.0
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApi3 {
    pub openapi: String, // "3.0.0"
    pub info: OpenApiInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub servers: Option<Vec<OpenApiServer>>,
    pub paths: HashMap<String, OpenApiPathItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<OpenApiComponents>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<OpenApiTag>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiInfo {
    pub title: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiServer {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiTag {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenApiPathItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub get: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub put: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head: Option<OpenApiOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<OpenApiOperation>,
}

pub trait HasOperation {
    fn set_operation(&mut self, method: &str, op: OpenApiOperation);
}

impl HasOperation for OpenApiPathItem {
    fn set_operation(&mut self, method: &str, op: OpenApiOperation) {
        match method.to_uppercase().as_str() {
            "GET" => self.get = Some(op),
            "POST" => self.post = Some(op),
            "PUT" => self.put = Some(op),
            "PATCH" => self.patch = Some(op),
            "DELETE" => self.delete = Some(op),
            "HEAD" => self.head = Some(op),
            "OPTIONS" => self.options = Some(op),
            _ => {}
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiOperation {
    #[serde(rename = "operationId", skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<OpenApiParameter>>,
    #[serde(rename = "requestBody", skip_serializing_if = "Option::is_none")]
    pub request_body: Option<OpenApiRequestBody>,
    pub responses: HashMap<String, OpenApiResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub security: Option<Vec<HashMap<String, Vec<String>>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiParameter {
    pub name: String,
    #[serde(rename = "in")]
    pub location: String, // query, header, path, cookie
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub required: bool,
    pub schema: OpenApiSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiRequestBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub required: bool,
    pub content: HashMap<String, OpenApiMediaType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiMediaType {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<OpenApiSchema>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiResponse {
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<HashMap<String, OpenApiMediaType>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiSchema {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub schema_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<Value>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiComponents {
    #[serde(rename = "securitySchemes", skip_serializing_if = "Option::is_none")]
    pub security_schemes: Option<HashMap<String, Value>>,
}

// ────────────────────────────────────────────────────────────────────────────
// Swagger 2.0 (OpenAPI 2)
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Swagger2 {
    pub swagger: String, // "2.0"
    pub info: OpenApiInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(rename = "basePath", skip_serializing_if = "Option::is_none")]
    pub base_path: Option<String>,
    pub paths: HashMap<String, Swagger2PathItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<OpenApiTag>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consumes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub produces: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Swagger2PathItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub get: Option<Swagger2Operation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post: Option<Swagger2Operation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub put: Option<Swagger2Operation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch: Option<Swagger2Operation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete: Option<Swagger2Operation>,
}

impl Swagger2PathItem {
    pub fn set_operation(&mut self, method: &str, op: Swagger2Operation) {
        match method.to_uppercase().as_str() {
            "GET" => self.get = Some(op),
            "POST" => self.post = Some(op),
            "PUT" => self.put = Some(op),
            "PATCH" => self.patch = Some(op),
            "DELETE" => self.delete = Some(op),
            _ => {}
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Swagger2Operation {
    #[serde(rename = "operationId", skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<Swagger2Parameter>>,
    pub responses: HashMap<String, OpenApiResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consumes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub produces: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Swagger2Parameter {
    pub name: String,
    #[serde(rename = "in")]
    pub location: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub required: bool,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub param_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<OpenApiSchema>,
}
