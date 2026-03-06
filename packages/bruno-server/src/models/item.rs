use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Generate a 21-character alphanumeric UID compatible with nanoid.
pub fn generate_uid() -> String {
    uuid::Uuid::new_v4().simple().to_string()[..21].to_string()
}

/// Backward-compatible alias.
pub fn generate_client_id() -> String {
    generate_uid()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    Folder,
    Request,
}

// ── Request sub-structures ──────────────────────────────────────────────────

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
    pub param_type: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestBody {
    pub mode: String,
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
    pub mode: String,
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

// ── Item (Folder or Request) ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID — used by the frontend as `item.uid`.
    pub uid: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    #[serde(rename = "collectionUid")]
    pub collection_uid: String,
    #[serde(rename = "parentUid", skip_serializing_if = "Option::is_none")]
    pub parent_uid: Option<String>,
    /// Ordering within the parent (fractional for easy reordering).
    pub seq: f64,

    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,
    /// Markdown documentation for folders (request-level docs lives in request.docs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docs: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Item {
    pub fn new_folder(
        name: String,
        collection_uid: String,
        parent_uid: Option<String>,
        seq: f64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            item_type: ItemType::Folder,
            name,
            collection_uid,
            parent_uid,
            seq,
            request: None,
            settings: None,
            filename: None,
            docs: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    pub fn new_request(
        name: String,
        collection_uid: String,
        parent_uid: Option<String>,
        seq: f64,
        method: String,
        url: String,
    ) -> Self {
        let now = Utc::now();

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

        let filename = name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>();

        Self {
            id: None,
            uid: generate_uid(),
            item_type: ItemType::Request,
            name,
            collection_uid,
            parent_uid,
            seq,
            request: Some(request),
            settings: Some(settings),
            filename: Some(format!("{}.bru", filename)),
            docs: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    pub fn is_request(&self) -> bool {
        self.item_type == ItemType::Request
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemResponse {
    pub uid: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    #[serde(rename = "collectionUid")]
    pub collection_uid: String,
    #[serde(rename = "parentUid", skip_serializing_if = "Option::is_none")]
    pub parent_uid: Option<String>,
    pub seq: f64,
    pub request: Option<Request>,
    pub settings: Option<Settings>,
    pub filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docs: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Item> for ItemResponse {
    fn from(i: Item) -> Self {
        Self {
            uid: i.uid,
            item_type: i.item_type,
            name: i.name,
            collection_uid: i.collection_uid,
            parent_uid: i.parent_uid,
            seq: i.seq,
            request: i.request,
            settings: i.settings,
            filename: i.filename,
            docs: i.docs,
            created_at: i.created_at,
            updated_at: i.updated_at,
        }
    }
}
