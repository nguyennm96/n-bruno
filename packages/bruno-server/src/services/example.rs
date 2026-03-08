use bson::{doc, oid::ObjectId, Document};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use serde_json::Value;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        example::{Example, ExampleResponse, ExampleSummary},
        item::{Item, ItemType},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct ExampleService {
    examples: Collection<Example>,
    items: Collection<Item>,
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
    ws_manager: crate::ws::WsManager,
}

impl ExampleService {
    pub fn new(db: &Database, ws_service: WorkspaceService, ws_manager: crate::ws::WsManager) -> Self {
        Self {
            examples: db.collection("examples"),
            items: db.collection("items"),
            collections: db.collection("collections"),
            ws_service,
            ws_manager,
        }
    }

    async fn get_item_and_check_access(&self, item_uid: &str, user_id: ObjectId) -> AppResult<Item> {
        let item = self.items
            .find_one(doc! { "uid": item_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))?;

        if item.item_type != ItemType::Request {
            return Err(AppError::BadRequest("Examples can only be attached to requests, not folders".into()));
        }

        let col = self.get_collection(&item.collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        Ok(item)
    }

    async fn get_collection(&self, collection_uid: &str) -> AppResult<CollectionModel> {
        self.collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create(
        &self,
        item_uid: &str,
        user_id: ObjectId,
        uid: Option<String>,
        name: String,
        description: Option<String>,
        status_code: u16,
        status_text: Option<String>,
        headers: Document,
        body: Option<String>,
        request_snapshot: Option<Value>,
        response_time: Option<i64>,
        response_size: Option<i64>,
    ) -> AppResult<ExampleResponse> {
        let item = self.get_item_and_check_access(item_uid, user_id).await?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let mut example = Example::new(uid, name, description, item.uid.clone(), status_code, status_text, headers, body, request_snapshot, response_time, response_size);
        let res = self.examples.insert_one(&example).await.map_err(AppError::from)?;
        example.id = res.inserted_id.as_object_id();
        let resp = ExampleResponse::from(example);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ExampleChanged {
                action: "created".into(),
                example_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn list(&self, item_uid: &str, user_id: ObjectId) -> AppResult<Vec<ExampleSummary>> {
        let item = self.get_item_and_check_access(item_uid, user_id).await?;
        let mut cursor = self.examples
            .find(doc! { "requestUid": &item.uid, "deletedAt": { "$exists": false } })
            .projection(doc! { "body": 0, "requestSnapshot": 0 })
            .await
            .map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(ExampleSummary::from(e)); }
        Ok(result)
    }

    /// Get a single example with full body and requestSnapshot (for lazy loading).
    pub async fn get_by_uid(&self, example_uid: &str, user_id: ObjectId) -> AppResult<ExampleResponse> {
        let example = self.get_example_raw(example_uid).await?;
        let item = self.items.find_one(doc! { "uid": &example.request_uid }).await.map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))?;
        let col = self.get_collection(&item.collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        Ok(ExampleResponse::from(example))
    }

    /// Load all examples for every request in a collection (bulk load) — returns
    /// lightweight summaries without body/requestSnapshot to keep the payload small.
    pub async fn list_for_collection(&self, collection_uid: &str, user_id: ObjectId) -> AppResult<Vec<ExampleSummary>> {
        let col = self.get_collection(collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;

        // Collect all request UIDs belonging to this collection
        let mut item_cursor = self.items
            .find(doc! { "collectionUid": collection_uid, "deletedAt": { "$exists": false }, "type": "request" })
            .await
            .map_err(AppError::from)?;
        let mut request_uids: Vec<String> = Vec::new();
        while let Some(Ok(item)) = item_cursor.next().await {
            request_uids.push(item.uid);
        }

        if request_uids.is_empty() {
            return Ok(vec![]);
        }

        let mut cursor = self.examples
            .find(doc! { "requestUid": { "$in": &request_uids }, "deletedAt": { "$exists": false } })
            .projection(doc! { "body": 0, "requestSnapshot": 0 })
            .await
            .map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(ExampleSummary::from(e)); }
        Ok(result)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update(
        &self,
        example_uid: &str,
        user_id: ObjectId,
        name: Option<String>,
        description: Option<String>,
        status_code: Option<u16>,
        status_text: Option<String>,
        headers: Option<Document>,
        body: Option<String>,
        request_snapshot: Option<Value>,
        response_time: Option<i64>,
        response_size: Option<i64>,
    ) -> AppResult<ExampleResponse> {
        let example = self.get_example_raw(example_uid).await?;
        let item = self.items.find_one(doc! { "uid": &example.request_uid }).await.map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let ex_oid = example.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_chrono(now) };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(d) = &description { update.insert("description", d); }
        if let Some(sc) = status_code { update.insert("status_code", sc as i32); }
        if let Some(st) = &status_text { update.insert("status_text", st); }
        if let Some(h) = headers { update.insert("headers", h); }
        if let Some(b) = &body { update.insert("body", b); }
        if let Some(rs) = request_snapshot {
            if let Ok(bson_val) = bson::to_bson(&rs) {
                update.insert("requestSnapshot", bson_val);
            }
        }
        if let Some(rt) = response_time { update.insert("responseTime", rt); }
        if let Some(rs) = response_size { update.insert("responseSize", rs); }

        self.examples.update_one(doc! { "_id": ex_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_example_raw(example_uid).await?;
        let resp = ExampleResponse::from(updated);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ExampleChanged {
                action: "updated".into(),
                example_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn delete(&self, example_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let example = self.get_example_raw(example_uid).await?;
        let item = self.items.find_one(doc! { "uid": &example.request_uid }).await.map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let workspace_uid = col.workspace_uid.clone();
        let deleted_uid = example.uid.clone();
        self.examples.update_one(
            doc! { "_id": example.id.unwrap() },
            doc! { "$set": { "deletedAt": bson::DateTime::now() } },
        ).await.map_err(AppError::from)?;
        self.ws_manager.broadcast(
            &workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ExampleChanged {
                action: "deleted".into(),
                example_uid: deleted_uid.clone(),
                data: serde_json::json!({ "uid": deleted_uid }),
            },
        );
        Ok(())
    }

    async fn get_example_raw(&self, example_uid: &str) -> AppResult<Example> {
        self.examples
            .find_one(doc! { "uid": example_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Example not found".into()))
    }
}
