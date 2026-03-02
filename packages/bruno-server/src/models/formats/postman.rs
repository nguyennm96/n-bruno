/// Postman Collection v2.1 format structs
/// Spec: https://schema.getpostman.com/json/collection/v2.1.0/
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const POSTMAN_SCHEMA: &str =
    "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

// ── Top-level Collection ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanCollection {
    pub info: PostmanInfo,
    pub item: Vec<PostmanItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable: Option<Vec<PostmanVariable>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<PostmanAuth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub schema: String,
    #[serde(rename = "_postman_id", skip_serializing_if = "Option::is_none")]
    pub postman_id: Option<String>,
}

// ── Items (Folders & Requests) ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanItem {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    // Folder fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item: Option<Vec<PostmanItem>>,

    // Request fields (present when it's a request, not a folder)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request: Option<PostmanRequest>,

    // Response examples
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<Vec<PostmanResponse>>,
}

impl PostmanItem {
    pub fn is_folder(&self) -> bool {
        self.item.is_some()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanRequest {
    pub method: String,
    pub url: PostmanUrl,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header: Option<Vec<PostmanHeader>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<PostmanBody>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<PostmanAuth>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PostmanUrl {
    Raw(String),
    Object(PostmanUrlObject),
}

impl PostmanUrl {
    pub fn as_raw(&self) -> String {
        match self {
            PostmanUrl::Raw(s) => s.clone(),
            PostmanUrl::Object(o) => o.raw.clone().unwrap_or_default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanUrlObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<Vec<PostmanQueryParam>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable: Option<Vec<PostmanVariable>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanQueryParam {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanHeader {
    pub key: String,
    pub value: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub header_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanBody {
    pub mode: String, // raw, urlencoded, formdata, file, graphql
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<PostmanBodyOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub urlencoded: Option<Vec<PostmanKV>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formdata: Option<Vec<PostmanKV>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanBodyOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<PostmanBodyRawOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanBodyRawOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>, // json, text, javascript, html, xml
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanKV {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanAuth {
    #[serde(rename = "type")]
    pub auth_type: String, // basic, bearer, oauth1, oauth2, apikey, noauth
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bearer: Option<Vec<PostmanKV>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basic: Option<Vec<PostmanKV>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apikey: Option<Vec<PostmanKV>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanVariable {
    pub key: String,
    pub value: Value,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub var_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

// ── Response Examples ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanResponse {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header: Option<Vec<PostmanHeader>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(rename = "originalRequest", skip_serializing_if = "Option::is_none")]
    pub original_request: Option<PostmanRequest>,
}

// ── Environment ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanEnvironment {
    pub id: String,
    pub name: String,
    pub values: Vec<PostmanEnvValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostmanEnvValue {
    pub key: String,
    pub value: String,
    pub enabled: bool,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub value_type: Option<String>, // default, secret
}
