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
        item::{generate_uid, Item},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct CollectionService {
    collections: Collection<CollectionModel>,
    items: Collection<Item>,
    ws_service: WorkspaceService,
    ws_manager: crate::ws::WsManager,
}

impl CollectionService {
    pub fn new(db: &Database, ws_service: WorkspaceService, ws_manager: crate::ws::WsManager) -> Self {
        Self {
            collections: db.collection("collections"),
            items: db.collection("items"),
            ws_service,
            ws_manager,
        }
    }

    pub async fn create(&self, workspace_uid: &str, user_id: ObjectId, name: String, description: Option<String>) -> AppResult<CollectionResponse> {
        let (_, role) = self.ws_service.get_with_role(workspace_uid, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }
        let mut col = CollectionModel::new(name, description, workspace_uid.to_string());
        let res = self.collections.insert_one(&col).await.map_err(AppError::from)?;
        col.id = res.inserted_id.as_object_id();
        let resp = CollectionResponse::from(col);
        self.ws_manager.broadcast(
            workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::CollectionChanged {
                action: "created".into(),
                collection_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn list(&self, workspace_uid: &str, user_id: ObjectId) -> AppResult<Vec<CollectionResponse>> {
        self.ws_service.get_with_role(workspace_uid, user_id).await?;
        let mut cursor = self.collections.find(doc! { "workspaceUid": workspace_uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(c)) = cursor.next().await { result.push(CollectionResponse::from(c)); }
        Ok(result)
    }

    pub async fn get(&self, collection_uid: &str, user_id: ObjectId) -> AppResult<CollectionResponse> {
        let col = self.get_collection_raw(collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        Ok(CollectionResponse::from(col))
    }

    pub async fn update(&self, collection_uid: &str, user_id: ObjectId, name: Option<String>, description: Option<String>, bruno_config: Option<JsonValue>, root: Option<JsonValue>) -> AppResult<CollectionResponse> {
        let col = self.get_collection_raw(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
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

        let resp = CollectionResponse {
            uid: col.uid,
            name: name.unwrap_or(col.name),
            description: description.or(col.description),
            workspace_uid: col.workspace_uid,
            bruno_config: bruno_config.or(col.bruno_config),
            root: root.or(col.root),
            created_at: col.created_at,
            updated_at: now,
        };
        self.ws_manager.broadcast(
            &resp.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::CollectionChanged {
                action: "updated".into(),
                collection_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn delete(&self, collection_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let col = self.get_collection_raw(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }
        let workspace_uid = col.workspace_uid.clone();
        let deleted_uid = col.uid.clone();
        self.collections.update_one(
            doc! { "_id": col.id.unwrap() },
            doc! { "$set": { "deletedAt": chrono::Utc::now().to_rfc3339() } },
        ).await.map_err(AppError::from)?;
        self.ws_manager.broadcast(
            &workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::CollectionChanged {
                action: "deleted".into(),
                collection_uid: deleted_uid.clone(),
                data: serde_json::json!({ "uid": deleted_uid }),
            },
        );
        Ok(())
    }

    async fn get_collection_raw(&self, collection_uid: &str) -> AppResult<CollectionModel> {
        self.collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    pub async fn clone_collection(
        &self,
        collection_uid: &str,
        user_id: ObjectId,
        new_name: String,
        target_workspace_uid: Option<String>,
    ) -> AppResult<CollectionResponse> {
        let source_col = self.get_collection_raw(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&source_col.workspace_uid, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let target_ws_uid = match target_workspace_uid {
            Some(ws_uid) => {
                let (_, target_role) = self.ws_service.get_with_role(&ws_uid, user_id).await?;
                if !target_role.can_write() {
                    return Err(AppError::Forbidden("Editor or Owner role required in target workspace".into()));
                }
                ws_uid
            }
            None => source_col.workspace_uid.clone(),
        };

        let mut new_col = CollectionModel::new(new_name, source_col.description.clone(), target_ws_uid);
        let col_result = self.collections.insert_one(&new_col).await.map_err(AppError::from)?;
        new_col.id = col_result.inserted_id.as_object_id();

        // Clone all items from source collection
        self.clone_items_recursive(&source_col.uid, &new_col.uid).await?;

        let resp = CollectionResponse::from(new_col);
        self.ws_manager.broadcast(
            &resp.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::CollectionChanged {
                action: "created".into(),
                collection_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    async fn clone_items_recursive(&self, source_collection_uid: &str, new_collection_uid: &str) -> AppResult<()> {
        let mut cursor = self.items.find(doc! { "collectionUid": source_collection_uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut source_items = Vec::new();
        while let Some(Ok(item)) = cursor.next().await { source_items.push(item); }
        if source_items.is_empty() { return Ok(()); }

        // Build uid mapping: old_uid -> new_uid
        let mut uid_map: HashMap<String, String> = HashMap::new();
        for item in &source_items {
            uid_map.insert(item.uid.clone(), generate_uid());
        }

        let now = Utc::now();
        for source_item in source_items {
            let new_uid = uid_map.get(&source_item.uid).unwrap().clone();
            let new_parent_uid = source_item.parent_uid.as_ref().and_then(|old| uid_map.get(old).cloned());

            let new_item = Item {
                id: None,
                uid: new_uid,
                item_type: source_item.item_type.clone(),
                name: source_item.name.clone(),
                collection_uid: new_collection_uid.to_string(),
                parent_uid: new_parent_uid,
                seq: source_item.seq,
                request: source_item.request.clone(),
                settings: source_item.settings.clone(),
                filename: source_item.filename.clone(),
                docs: source_item.docs.clone(),
                created_at: now,
                updated_at: now,
                deleted_at: None,
            };
            self.items.insert_one(&new_item).await.map_err(AppError::from)?;
        }
        Ok(())
    }

    pub async fn resequence_items(&self, collection_uid: &str, user_id: ObjectId, updates: Vec<(String, f64)>) -> AppResult<usize> {
        if updates.is_empty() { return Ok(0); }

        let col = self.get_collection_raw(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let now = Utc::now();
        let mut updated_count = 0;
        for (item_uid, new_seq) in &updates {
            // Verify item belongs to this collection
            let item = self.items
                .find_one(doc! { "uid": item_uid, "collectionUid": collection_uid })
                .await
                .map_err(AppError::from)?
                .ok_or_else(|| AppError::NotFound(format!("Item not found: {}", item_uid)))?;

            let result = self.items
                .update_one(
                    doc! { "_id": item.id.unwrap() },
                    doc! { "$set": { "seq": new_seq, "updated_at": now.to_rfc3339() } },
                )
                .await
                .map_err(AppError::from)?;
            updated_count += result.modified_count as usize;
        }
        Ok(updated_count)
    }
}
