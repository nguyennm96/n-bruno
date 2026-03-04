use bson::{oid::ObjectId, Document};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Generate a 21-character alphanumeric client ID compatible with the frontend's
/// nanoid-based `uid` format (satisfies `uidSchema` Yup validation).
pub fn generate_client_id() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..21].to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    Folder,
    Request,
}

// ──────────────────────────────────────────────────────────────────────────────
// Request Schema - Matching Local Structure
// ──────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct KeyValue {
    pub uid: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
    pub description: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestParam {
    pub uid: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub param_type: String, // "query" or "path"
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestBody {
    pub mode: String, // "none", "json", "text", "xml", "formUrlEncoded", "multipartForm", "graphql"
    pub json: Option<String>,
    pub text: Option<String>,
    pub xml: Option<String>,
    pub sparql: Option<String>,
    #[serde(rename = "formUrlEncoded")]
    pub form_url_encoded: Option<Vec<KeyValue>>,
    #[serde(rename = "multipartForm")]
    pub multipart_form: Option<Value>,
    pub graphql: Option<Value>,
    pub file: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Auth {
    pub mode: String, // "inherit", "none", "awsv4", "basic", "bearer", "digest", "oauth2", "wsse", "apikey"
    pub awsv4: Option<Value>,
    pub basic: Option<Value>,
    pub bearer: Option<Value>,
    pub digest: Option<Value>,
    pub oauth2: Option<Value>,
    pub wsse: Option<Value>,
    pub apikey: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Vars {
    pub uid: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
    pub description: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestVars {
    pub req: Option<Vec<Vars>>,
    pub res: Option<Vec<Vars>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Script {
    pub req: Option<String>,
    pub res: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Assertion {
    pub uid: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
    pub description: Option<String>,
    pub enabled: bool,
    pub operator: Option<String>,
}

// Complete request object matching local schema
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Request {
    pub url: String,
    pub method: String,
    pub headers: Vec<KeyValue>,
    pub params: Vec<RequestParam>,
    pub auth: Option<Auth>,
    pub body: RequestBody,
    pub script: Option<Script>,
    pub vars: Option<RequestVars>,
    pub assertions: Option<Vec<Assertion>>,
    pub tests: Option<String>,
    pub docs: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    #[serde(rename = "encodeUrl")]
    pub encode_url: Option<bool>,
    #[serde(rename = "followRedirects")]
    pub follow_redirects: Option<bool>,
    #[serde(rename = "maxRedirects")]
    pub max_redirects: Option<i32>,
    pub timeout: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Client-facing UID (21-char alphanumeric, nanoid-compatible). Used by the
    /// frontend as the item `uid` — avoids any coupling to MongoDB ObjectIDs.
    pub client_id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    pub collection_id: ObjectId,
    pub parent_item_id: Option<ObjectId>,
    pub sort_order: f64,

    // NEW: Request-specific fields - nested structure (preferred)
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,

    // OLD: Kept for backward compatibility during migration
    // These are used by import/export services
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Document>,
    pub query_params: Option<Document>,
    pub body: Option<Value>,
    pub auth: Option<Value>,
    pub pre_request_script: Option<String>,
    pub post_response_script: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Item {
    pub fn new_folder(
        name: String,
        collection_id: ObjectId,
        parent_item_id: Option<ObjectId>,
        sort_order: f64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            client_id: generate_client_id(),
            item_type: ItemType::Folder,
            name,
            collection_id,
            parent_item_id,
            sort_order,
            request: None,
            settings: None,
            filename: None,
            method: None,
            url: None,
            headers: None,
            query_params: None,
            body: None,
            auth: None,
            pre_request_script: None,
            post_response_script: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn new_request(
        name: String,
        collection_id: ObjectId,
        parent_item_id: Option<ObjectId>,
        sort_order: f64,
        method: String,
        url: String,
    ) -> Self {
        let now = Utc::now();
        
        // Create nested request object
        let request = Request {
            method: method.clone(),
            url: url.clone(),
            headers: vec![],
            params: vec![],
            auth: Some(Auth {
                mode: "inherit".to_string(),
                ..Default::default()
            }),
            body: RequestBody {
                mode: "none".to_string(),
                ..Default::default()
            },
            script: Some(Script::default()),
            vars: Some(RequestVars::default()),
            assertions: Some(vec![]),
            tests: None,
            docs: None,
        };

        let settings = Settings {
            encode_url: Some(true),
            follow_redirects: Some(true),
            max_redirects: Some(5),
            timeout: None,
        };

        // Generate filename from name
        let filename = name
            .to_lowercase()
            .replace(" ", "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>();

        Self {
            id: None,
            client_id: generate_client_id(),
            item_type: ItemType::Request,
            name,
            collection_id,
            parent_item_id,
            sort_order,
            request: Some(request),
            settings: Some(settings),
            filename: Some(format!("{}.bru", filename)),
            method: Some(method),
            url: Some(url),
            headers: None,
            query_params: None,
            body: None,
            auth: None,
            pre_request_script: None,
            post_response_script: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn is_request(&self) -> bool {
        self.item_type == ItemType::Request
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemResponse {
    pub id: String,
    /// Client-facing UID (21-char alphanumeric). The frontend uses this as the
    /// item `uid` — it satisfies the Yup `uidSchema` without any special casing.
    pub client_id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    pub collection_id: String,
    pub parent_item_id: Option<String>,
    pub sort_order: f64,
    
    // Nested structure - matching local schema
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Item> for ItemResponse {
    fn from(i: Item) -> Self {
        Self {
            id: i.id.unwrap_or_default().to_hex(),
            client_id: i.client_id,
            item_type: i.item_type,
            name: i.name,
            collection_id: i.collection_id.to_hex(),
            parent_item_id: i.parent_item_id.map(|id| id.to_hex()),
            sort_order: i.sort_order,
            request: i.request,
            settings: i.settings,
            filename: i.filename,
            created_at: i.created_at,
            updated_at: i.updated_at,
        }
    }
}
