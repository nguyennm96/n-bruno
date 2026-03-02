use bson::{oid::ObjectId, Document};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    Folder,
    Request,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestBody {
    #[serde(rename = "type")]
    pub body_type: Option<String>, // json, text, form-data, urlencoded
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    pub collection_id: ObjectId,
    pub parent_item_id: Option<ObjectId>,
    pub sort_order: f64,

    // Request-only fields
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Document>,
    pub query_params: Option<Document>,
    pub body: Option<RequestBody>,
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
            item_type: ItemType::Folder,
            name,
            collection_id,
            parent_item_id,
            sort_order,
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
        Self {
            id: None,
            item_type: ItemType::Request,
            name,
            collection_id,
            parent_item_id,
            sort_order,
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
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub name: String,
    pub collection_id: String,
    pub parent_item_id: Option<String>,
    pub sort_order: f64,
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Document>,
    pub query_params: Option<Document>,
    pub body: Option<RequestBody>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Item> for ItemResponse {
    fn from(i: Item) -> Self {
        Self {
            id: i.id.unwrap_or_default().to_hex(),
            item_type: i.item_type,
            name: i.name,
            collection_id: i.collection_id.to_hex(),
            parent_item_id: i.parent_item_id.map(|id| id.to_hex()),
            sort_order: i.sort_order,
            method: i.method,
            url: i.url,
            headers: i.headers,
            query_params: i.query_params,
            body: i.body,
            created_at: i.created_at,
            updated_at: i.updated_at,
        }
    }
}
