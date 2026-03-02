use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        item::{Item, ItemResponse, ItemType, RequestBody},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct ItemService {
    items: Collection<Item>,
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
}

impl ItemService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            items: db.collection("items"),
            collections: db.collection("collections"),
            ws_service,
        }
    }

    async fn get_collection(&self, collection_id: &str) -> AppResult<CollectionModel> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;
        self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    pub async fn create_folder(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        name: String,
        parent_item_id: Option<String>,
        sort_order: Option<f64>,
    ) -> AppResult<ItemResponse> {
        let col = self.get_collection(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let parent_oid = parse_optional_oid(parent_item_id)?;
        let so = sort_order.unwrap_or(0.0);
        let mut item = Item::new_folder(name, col.id.unwrap(), parent_oid, so);
        let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
        item.id = res.inserted_id.as_object_id();
        Ok(ItemResponse::from(item))
    }

    pub async fn create_request(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        name: String,
        parent_item_id: Option<String>,
        sort_order: Option<f64>,
        method: String,
        url: String,
    ) -> AppResult<ItemResponse> {
        let col = self.get_collection(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let parent_oid = parse_optional_oid(parent_item_id)?;
        let so = sort_order.unwrap_or(0.0);
        let mut item = Item::new_request(name, col.id.unwrap(), parent_oid, so, method, url);
        let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
        item.id = res.inserted_id.as_object_id();
        Ok(ItemResponse::from(item))
    }

    pub async fn list_by_collection(&self, collection_id: &str, user_id: ObjectId) -> AppResult<Vec<ItemResponse>> {
        let col = self.get_collection(collection_id).await?;
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        let col_oid = col.id.unwrap();
        let mut cursor = self.items
            .find(doc! { "collection_id": col_oid })
            .await
            .map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(i)) = cursor.next().await { result.push(ItemResponse::from(i)); }
        Ok(result)
    }

    pub async fn get(&self, item_id: &str, user_id: ObjectId) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_id).await?;
        let col = self.get_collection(&item.collection_id.to_hex()).await?;
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        Ok(ItemResponse::from(item))
    }

    pub async fn update(
        &self,
        item_id: &str,
        user_id: ObjectId,
        name: Option<String>,
        method: Option<String>,
        url: Option<String>,
        body: Option<RequestBody>,
    ) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_id).await?;
        let col = self.get_collection(&item.collection_id.to_hex()).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let item_oid = item.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(m) = &method { update.insert("method", m); }
        if let Some(u) = &url { update.insert("url", u); }

        self.items.update_one(doc! { "_id": item_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;

        let updated = self.get_raw(item_id).await?;
        Ok(ItemResponse::from(updated))
    }

    pub async fn delete(&self, item_id: &str, user_id: ObjectId) -> AppResult<()> {
        let item = self.get_raw(item_id).await?;
        let col = self.get_collection(&item.collection_id.to_hex()).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        // Cascade delete children
        self.cascade_delete(item.id.unwrap()).await?;
        Ok(())
    }

    async fn cascade_delete(&self, item_id: ObjectId) -> AppResult<()> {
        let mut cursor = self.items
            .find(doc! { "parent_item_id": item_id })
            .await
            .map_err(AppError::from)?;
        let mut child_ids = Vec::new();
        while let Some(Ok(child)) = cursor.next().await {
            child_ids.push(child.id.unwrap());
        }
        for child_id in child_ids {
            Box::pin(self.cascade_delete(child_id)).await?;
        }
        self.items.delete_one(doc! { "_id": item_id }).await.map_err(AppError::from)?;
        Ok(())
    }

    pub async fn move_item(&self, item_id: &str, user_id: ObjectId, new_parent_id: Option<String>, new_sort_order: Option<f64>) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_id).await?;
        let col = self.get_collection(&item.collection_id.to_hex()).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let item_oid = item.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };

        match parse_optional_oid(new_parent_id)? {
            Some(oid) => { update.insert("parent_item_id", oid); }
            None => { update.insert("parent_item_id", bson::Bson::Null); }
        }
        if let Some(so) = new_sort_order { update.insert("sort_order", so); }

        self.items.update_one(doc! { "_id": item_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_raw(item_id).await?;
        Ok(ItemResponse::from(updated))
    }

    async fn get_raw(&self, item_id: &str) -> AppResult<Item> {
        let oid = ObjectId::parse_str(item_id)
            .map_err(|_| AppError::BadRequest("Invalid item ID".into()))?;
        self.items
            .find_one(doc! { "_id": oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))
    }
}

fn parse_optional_oid(id: Option<String>) -> AppResult<Option<ObjectId>> {
    match id {
        None => Ok(None),
        Some(s) if s.is_empty() => Ok(None),
        Some(s) => ObjectId::parse_str(&s)
            .map(Some)
            .map_err(|_| AppError::BadRequest("Invalid parent item ID".into())),
    }
}
