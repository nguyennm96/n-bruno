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

    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    #[serde(default, with = "crate::serde_helpers::flexible_bson_datetime_optional")]
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
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_uid_is_21_chars_alphanumeric() {
        for _ in 0..20 {
            let uid = generate_uid();
            assert_eq!(uid.len(), 21, "uid length should be 21, got: {}", uid);
            assert!(uid.chars().all(|c| c.is_alphanumeric()), "uid should be alphanumeric: {}", uid);
        }
    }

    #[test]
    fn generate_uid_is_unique() {
        let uids: std::collections::HashSet<_> = (0..100).map(|_| generate_uid()).collect();
        assert_eq!(uids.len(), 100, "all 100 UIDs should be unique");
    }

    #[test]
    fn new_folder_has_correct_type_and_no_request() {
        let f = Item::new_folder("Auth".into(), "col_uid".into(), None, 1.0);
        assert_eq!(f.item_type, ItemType::Folder);
        assert_eq!(f.name, "Auth");
        assert_eq!(f.collection_uid, "col_uid");
        assert!(f.parent_uid.is_none());
        assert_eq!(f.seq, 1.0);
        assert!(f.request.is_none());
        assert!(f.settings.is_none());
        assert!(f.deleted_at.is_none());
    }

    #[test]
    fn new_request_has_correct_defaults() {
        let r = Item::new_request("Get Users".into(), "col_uid".into(), None, 2.0, "GET".into(), "https://api.example.com/users".into());
        assert_eq!(r.item_type, ItemType::Request);
        assert_eq!(r.name, "Get Users");
        assert_eq!(r.seq, 2.0);
        assert!(r.request.is_some());
        assert!(r.settings.is_some());
        let req = r.request.unwrap();
        assert_eq!(req.method, "GET");
        assert_eq!(req.url, "https://api.example.com/users");
        assert_eq!(req.auth.unwrap().mode, "inherit");
        assert_eq!(req.body.mode, "none");
    }

    #[test]
    fn new_request_filename_is_slugified() {
        let r = Item::new_request("Get All Users".into(), "c".into(), None, 1.0, "GET".into(), "".into());
        assert_eq!(r.filename, Some("get-all-users.bru".into()));
    }

    #[test]
    fn new_request_filename_strips_special_chars() {
        let r = Item::new_request("Create User (v2)".into(), "c".into(), None, 1.0, "POST".into(), "".into());
        // Parentheses and spaces are stripped; only alphanumeric and hyphens remain
        let filename = r.filename.unwrap();
        assert!(filename.ends_with(".bru"));
        assert!(!filename.contains(' '));
        assert!(!filename.contains('('));
    }

    #[test]
    fn is_request_returns_correct_value() {
        let folder = Item::new_folder("F".into(), "c".into(), None, 1.0);
        let request = Item::new_request("R".into(), "c".into(), None, 1.0, "GET".into(), "".into());
        assert!(!folder.is_request());
        assert!(request.is_request());
    }

    #[test]
    fn item_response_from_item_drops_deleted_at() {
        let mut item = Item::new_request("R".into(), "c".into(), None, 1.0, "GET".into(), "".into());
        item.deleted_at = Some(chrono::Utc::now());
        let resp = ItemResponse::from(item);
        // ItemResponse has no deleted_at field — compilation proves this
        let _ = resp.uid;
    }

    #[test]
    fn settings_defaults() {
        let s = Settings::default();
        assert!(s.encode_url.is_none());
        assert!(s.follow_redirects.is_none());
        assert!(s.max_redirects.is_none());
        assert!(s.timeout.is_none());
    }

    #[test]
    fn request_body_default_mode_is_empty() {
        let b = RequestBody::default();
        assert_eq!(b.mode, "");
    }
}
