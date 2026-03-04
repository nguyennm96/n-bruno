use bson::{doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::{Collection as CollectionModel, CollectionResponse},
        item::{generate_client_id, Item},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct CollectionService {
    collections: Collection<CollectionModel>,
    items: Collection<Item>,
    ws_service: WorkspaceService,
}

impl CollectionService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            collections: db.collection("collections"),
            items: db.collection("items"),
            ws_service,
        }
    }

    pub async fn create(&self, workspace_id: &str, user_id: ObjectId, name: String, description: Option<String>) -> AppResult<CollectionResponse> {
        let (_, role) = self.ws_service.get_with_role(workspace_id, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;
        let mut col = CollectionModel::new(name, description, ws_oid);
        let res = self.collections.insert_one(&col).await.map_err(AppError::from)?;
        col.id = res.inserted_id.as_object_id();
        Ok(CollectionResponse::from(col))
    }

    pub async fn list(&self, workspace_id: &str, user_id: ObjectId) -> AppResult<Vec<CollectionResponse>> {
        self.ws_service.get_with_role(workspace_id, user_id).await?;
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        let mut cursor = self.collections.find(doc! { "workspace_id": ws_oid }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(c)) = cursor.next().await {
            result.push(CollectionResponse::from(c));
        }
        Ok(result)
    }

    pub async fn get(&self, collection_id: &str, user_id: ObjectId) -> AppResult<CollectionResponse> {
        let col = self.get_collection_raw(collection_id).await?;
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        Ok(CollectionResponse::from(col))
    }

    pub async fn update(&self, collection_id: &str, user_id: ObjectId, name: Option<String>, description: Option<String>, bruno_config: Option<JsonValue>, root: Option<JsonValue>) -> AppResult<CollectionResponse> {
        let col = self.get_collection_raw(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let col_oid = col.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(d) = &description { update.insert("description", d); }
        if let Some(bc) = &bruno_config {
            if let Ok(bson_val) = to_bson(bc) { update.insert("bruno_config", bson_val); }
        }
        if let Some(r) = &root {
            if let Ok(bson_val) = to_bson(r) { update.insert("root", bson_val); }
        }

        self.collections.update_one(doc! { "_id": col_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;

        Ok(CollectionResponse {
            id: col_oid.to_hex(),
            name: name.unwrap_or(col.name),
            description: description.or(col.description),
            workspace_id: col.workspace_id.to_hex(),
            bruno_config: bruno_config.or(col.bruno_config),
            root: root.or(col.root),
            created_at: col.created_at,
            updated_at: now,
        })
    }

    pub async fn delete(&self, collection_id: &str, user_id: ObjectId) -> AppResult<()> {
        let col = self.get_collection_raw(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }
        self.collections.delete_one(doc! { "_id": col.id.unwrap() }).await.map_err(AppError::from)?;
        Ok(())
    }

    async fn get_collection_raw(&self, collection_id: &str) -> AppResult<CollectionModel> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;
        self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    /// Clone a collection with all its items (deep clone)
    /// Creates new ObjectIds for collection and all items
    /// Preserves tree structure (parent-child relationships)
    pub async fn clone_collection(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        new_name: String,
        target_workspace_id: Option<String>,
    ) -> AppResult<CollectionResponse> {
        // Get source collection and verify permissions
        let source_col = self.get_collection_raw(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&source_col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        // Determine target workspace (same as source if not specified)
        let target_ws_id = match target_workspace_id {
            Some(ws_id) => {
                let ws_oid = ObjectId::parse_str(&ws_id)
                    .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;
                // Verify user has write access to target workspace
                let (_, target_role) = self.ws_service.get_with_role(&ws_id, user_id).await?;
                if !target_role.can_write() {
                    return Err(AppError::Forbidden("Editor or Owner role required in target workspace".into()));
                }
                ws_oid
            }
            None => source_col.workspace_id,
        };

        // Create new collection
        let mut new_col = CollectionModel::new(new_name, source_col.description.clone(), target_ws_id);
        let col_result = self.collections.insert_one(&new_col).await.map_err(AppError::from)?;
        let new_col_id = col_result.inserted_id.as_object_id().unwrap();
        new_col.id = Some(new_col_id);

        // Clone all items from source collection
        let source_col_id = source_col.id.unwrap();
        self.clone_items_recursive(source_col_id, new_col_id).await?;

        Ok(CollectionResponse::from(new_col))
    }

    /// Recursively clone all items from source collection to new collection
    /// Maintains parent-child relationships with new ObjectIds
    async fn clone_items_recursive(
        &self,
        source_collection_id: ObjectId,
        new_collection_id: ObjectId,
    ) -> AppResult<()> {
        // Fetch all items from source collection
        let mut cursor = self.items
            .find(doc! { "collection_id": source_collection_id })
            .await
            .map_err(AppError::from)?;

        let mut source_items = Vec::new();
        while let Some(Ok(item)) = cursor.next().await {
            source_items.push(item);
        }

        if source_items.is_empty() {
            return Ok(());
        }

        // Build ID mapping: old_id -> new_id
        let mut id_map: HashMap<ObjectId, ObjectId> = HashMap::new();
        for item in &source_items {
            let old_id = item.id.unwrap();
            let new_id = ObjectId::new();
            id_map.insert(old_id, new_id);
        }

        // Clone each item with mapped parent_item_id
        let now = Utc::now();
        for source_item in source_items {
            let old_id = source_item.id.unwrap();
            let new_id = *id_map.get(&old_id).unwrap();

            // Map parent_item_id to new ID (or None if root item)
            let new_parent_id = source_item.parent_item_id.and_then(|old_parent_id| {
                id_map.get(&old_parent_id).copied()
            });

            let new_item = Item {
                id: Some(new_id),
                client_id: generate_client_id(),
                item_type: source_item.item_type.clone(),
                name: source_item.name.clone(),
                collection_id: new_collection_id,
                parent_item_id: new_parent_id,
                sort_order: source_item.sort_order,
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

            self.items.insert_one(&new_item).await.map_err(AppError::from)?;
        }

        Ok(())
    }

    /// Resequence items (bulk update sort_order)
    /// All items must belong to same parent (atomic operation)
    pub async fn resequence_items(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        updates: Vec<(String, f64)>, // Vec of (item_id, new_sort_order)
    ) -> AppResult<usize> {
        if updates.is_empty() {
            return Ok(0);
        }

        // Verify permissions
        let col = self.get_collection_raw(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let col_oid = col.id.unwrap();
        let now = Utc::now();

        // Validate all items exist and belong to collection, resolve client_id -> ObjectId
        let mut resolved_updates: Vec<(ObjectId, f64)> = Vec::new();
        for (item_id, sort_order) in &updates {
            // Try ObjectId first, then fall back to client_id lookup
            let item = if let Ok(item_oid) = ObjectId::parse_str(item_id) {
                self.items
                    .find_one(doc! { "_id": item_oid })
                    .await
                    .map_err(AppError::from)?
                    .ok_or_else(|| AppError::NotFound(format!("Item not found: {}", item_id)))?
            } else {
                // client_id lookup (21-char nanoid)
                self.items
                    .find_one(doc! { "client_id": item_id })
                    .await
                    .map_err(AppError::from)?
                    .ok_or_else(|| AppError::NotFound(format!("Item not found: {}", item_id)))?
            };

            if item.collection_id != col_oid {
                return Err(AppError::BadRequest(format!(
                    "Item {} does not belong to collection {}",
                    item_id, collection_id
                )));
            }

            resolved_updates.push((item.id.unwrap(), *sort_order));
        }

        // Update each item's sort_order
        let mut updated_count = 0;
        for (item_oid, new_sort_order) in resolved_updates {
            let result = self.items
                .update_one(
                    doc! { "_id": item_oid },
                    doc! { "$set": { "sort_order": new_sort_order, "updated_at": now.to_rfc3339() } },
                )
                .await
                .map_err(AppError::from)?;

            updated_count += result.modified_count as usize;
        }

        Ok(updated_count)
    }
}
