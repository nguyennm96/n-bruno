use bson::{doc, oid::ObjectId, Document};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};

use crate::{
    errors::{AppError, AppResult},
    models::{
        example::{Example, ExampleResponse},
        item::{Item, ItemType},
        collection::Collection as CollectionModel,
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct ExampleService {
    examples: Collection<Example>,
    items: Collection<Item>,
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
}

impl ExampleService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            examples: db.collection("examples"),
            items: db.collection("items"),
            collections: db.collection("collections"),
            ws_service,
        }
    }

    async fn get_item_and_check_access(&self, item_id: &str, user_id: ObjectId) -> AppResult<Item> {
        let item_oid = ObjectId::parse_str(item_id)
            .map_err(|_| AppError::BadRequest("Invalid item ID".into()))?;
        let item = self.items
            .find_one(doc! { "_id": item_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))?;

        // Ensure item is a request (not folder)
        if item.item_type != ItemType::Request {
            return Err(AppError::BadRequest("Examples can only be attached to requests, not folders".into()));
        }

        let col = self.collections
            .find_one(doc! { "_id": item.collection_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        Ok(item)
    }

    pub async fn create(&self, item_id: &str, user_id: ObjectId, name: String, status_code: u16, headers: Document, body: Option<String>) -> AppResult<ExampleResponse> {
        let item = self.get_item_and_check_access(item_id, user_id).await?;

        // Check write access
        let col = self.collections.find_one(doc! { "_id": item.collection_id }).await.map_err(AppError::from)?.unwrap();
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let mut example = Example::new(name, item.id.unwrap(), status_code, headers, body);
        let res = self.examples.insert_one(&example).await.map_err(AppError::from)?;
        example.id = res.inserted_id.as_object_id();
        Ok(ExampleResponse::from(example))
    }

    pub async fn list(&self, item_id: &str, user_id: ObjectId) -> AppResult<Vec<ExampleResponse>> {
        let item = self.get_item_and_check_access(item_id, user_id).await?;
        let mut cursor = self.examples.find(doc! { "item_id": item.id.unwrap() }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(ExampleResponse::from(e)); }
        Ok(result)
    }

    pub async fn update(&self, example_id: &str, user_id: ObjectId, name: Option<String>, status_code: Option<u16>, body: Option<String>) -> AppResult<ExampleResponse> {
        let example = self.get_example_raw(example_id).await?;
        let item = self.items.find_one(doc! { "_id": example.item_id }).await.map_err(AppError::from)?.unwrap();
        let col = self.collections.find_one(doc! { "_id": item.collection_id }).await.map_err(AppError::from)?.unwrap();
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let ex_oid = example.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(sc) = status_code { update.insert("status_code", sc as i32); }
        if let Some(b) = &body { update.insert("body", b); }

        self.examples.update_one(doc! { "_id": ex_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_example_raw(example_id).await?;
        Ok(ExampleResponse::from(updated))
    }

    pub async fn delete(&self, example_id: &str, user_id: ObjectId) -> AppResult<()> {
        let example = self.get_example_raw(example_id).await?;
        let item = self.items.find_one(doc! { "_id": example.item_id }).await.map_err(AppError::from)?.unwrap();
        let col = self.collections.find_one(doc! { "_id": item.collection_id }).await.map_err(AppError::from)?.unwrap();
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        self.examples.delete_one(doc! { "_id": example.id.unwrap() }).await.map_err(AppError::from)?;
        Ok(())
    }

    async fn get_example_raw(&self, example_id: &str) -> AppResult<Example> {
        let oid = ObjectId::parse_str(example_id)
            .map_err(|_| AppError::BadRequest("Invalid example ID".into()))?;
        self.examples
            .find_one(doc! { "_id": oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Example not found".into()))
    }
}
