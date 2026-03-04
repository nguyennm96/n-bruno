use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use std::collections::HashMap;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        item::{generate_client_id, Item, ItemResponse, ItemType, Request, Settings},
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
        request: Option<Request>,
        settings: Option<Settings>,
    ) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_id).await?;
        let col = self.get_collection(&item.collection_id.to_hex()).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let item_oid = item.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };

        if let Some(n) = &name { update.insert("name", n); }

        if let Some(req) = request {
            let req_bson = bson::to_bson(&req).map_err(|e| AppError::BadRequest(e.to_string()))?;
            update.insert("request", req_bson);
            // Keep top-level method/url in sync for filtering/display
            update.insert("method", &req.method);
            update.insert("url", &req.url);
        }

        if let Some(s) = settings {
            let settings_bson = bson::to_bson(&s).map_err(|e| AppError::BadRequest(e.to_string()))?;
            update.insert("settings", settings_bson);
        }

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
        // Try client_id first (new format), fall back to ObjectId _id (legacy)
        if let Ok(oid) = ObjectId::parse_str(item_id) {
            self.items
                .find_one(doc! { "_id": oid })
                .await
                .map_err(AppError::from)?
                .ok_or_else(|| AppError::NotFound("Item not found".into()))
        } else {
            self.items
                .find_one(doc! { "client_id": item_id })
                .await
                .map_err(AppError::from)?
                .ok_or_else(|| AppError::NotFound("Item not found".into()))
        }
    }

    /// Clone an item (shallow for requests, deep for folders)
    /// Creates new ObjectIds for item and all children (if folder)
    pub async fn clone_item(
        &self,
        item_id: &str,
        user_id: ObjectId,
        new_name: String,
        target_parent_id: Option<String>,
    ) -> AppResult<ItemResponse> {
        // Get source item and verify permissions
        let source_item = self.get_raw(item_id).await?;
        let col = self.get_collection(&source_item.collection_id.to_hex()).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        // Determine target parent (use provided or same as source)
        let target_parent_oid = match target_parent_id {
            Some(ref id) => parse_optional_oid(Some(id.clone()))?,
            None => source_item.parent_item_id,
        };

        // If it's a request, do shallow clone
        if source_item.item_type == ItemType::Request {
            return self.clone_request(source_item, new_name, target_parent_oid).await;
        }

        // If it's a folder, do deep clone
        self.clone_folder_recursive(source_item, new_name, target_parent_oid).await
    }

    /// Shallow clone a request (copy all fields with new ObjectId)
    async fn clone_request(
        &self,
        source_item: Item,
        new_name: String,
        target_parent_id: Option<ObjectId>,
    ) -> AppResult<ItemResponse> {
        let now = Utc::now();
        let new_item = Item {
            id: None,
            client_id: generate_client_id(),
            item_type: ItemType::Request,
            name: new_name,
            collection_id: source_item.collection_id,
            parent_item_id: target_parent_id,
            sort_order: source_item.sort_order + 1.0, // Place after source
            request: source_item.request.clone(),
            settings: source_item.settings.clone(),
            filename: source_item.filename.clone(),
            method: source_item.method.clone(),
            url: source_item.url.clone(),
            headers: source_item.headers.clone(),
            query_params: source_item.query_params.clone(),
            body: source_item.body.clone(),
            auth: source_item.auth.clone(),
            pre_request_script: source_item.pre_request_script.clone(),
            post_response_script: source_item.post_response_script.clone(),
            created_at: now,
            updated_at: now,
        };

        let result = self.items.insert_one(&new_item).await.map_err(AppError::from)?;
        let cloned_id = result.inserted_id.as_object_id().unwrap().to_hex();
        self.get(&cloned_id, ObjectId::new()).await // Return cloned item
    }

    /// Deep clone a folder with all children recursively
    async fn clone_folder_recursive(
        &self,
        source_folder: Item,
        new_name: String,
        target_parent_id: Option<ObjectId>,
    ) -> AppResult<ItemResponse> {
        // Create new folder
        let now = Utc::now();
        let new_folder_id = ObjectId::new();
        let new_folder = Item {
            id: Some(new_folder_id),
            client_id: generate_client_id(),
            item_type: ItemType::Folder,
            name: new_name,
            collection_id: source_folder.collection_id,
            parent_item_id: target_parent_id,
            sort_order: source_folder.sort_order + 1.0,
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
        };

        self.items.insert_one(&new_folder).await.map_err(AppError::from)?;

        // Clone all children
        let source_folder_id = source_folder.id.unwrap();
        self.clone_children(source_folder.collection_id, source_folder_id, new_folder_id).await?;

        Ok(ItemResponse::from(new_folder))
    }

    /// Clone all children of a folder
    async fn clone_children(
        &self,
        collection_id: ObjectId,
        source_parent_id: ObjectId,
        new_parent_id: ObjectId,
    ) -> AppResult<()> {
        // Find all children of source folder
        let mut cursor = self.items
            .find(doc! {
                "collection_id": collection_id,
                "parent_item_id": source_parent_id
            })
            .await
            .map_err(AppError::from)?;

        let mut children = Vec::new();
        while let Some(Ok(child)) = cursor.next().await {
            children.push(child);
        }

        if children.is_empty() {
            return Ok(());
        }

        // Build ID mapping for children
        let mut id_map: HashMap<ObjectId, ObjectId> = HashMap::new();
        for child in &children {
            let old_id = child.id.unwrap();
            let new_id = ObjectId::new();
            id_map.insert(old_id, new_id);
        }

        let now = Utc::now();
        for child in children {
            let old_id = child.id.unwrap();
            let new_id = *id_map.get(&old_id).unwrap();

            let new_child = Item {
                id: Some(new_id),
                client_id: generate_client_id(),
                item_type: child.item_type.clone(),
                name: child.name.clone(),
                collection_id,
                parent_item_id: Some(new_parent_id),
                sort_order: child.sort_order,
                request: child.request.clone(),
                settings: child.settings.clone(),
                filename: child.filename.clone(),
                method: child.method.clone(),
                url: child.url.clone(),
                headers: child.headers.clone(),
                query_params: child.query_params.clone(),
                body: child.body.clone(),
                auth: child.auth.clone(),
                pre_request_script: child.pre_request_script.clone(),
                post_response_script: child.post_response_script.clone(),
                created_at: now,
                updated_at: now,
            };

            self.items.insert_one(&new_child).await.map_err(AppError::from)?;

            // If child is a folder, recursively clone its children
            if child.item_type == ItemType::Folder {
                Box::pin(self.clone_children(collection_id, old_id, new_id)).await?;
            }
        }

        Ok(())
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
