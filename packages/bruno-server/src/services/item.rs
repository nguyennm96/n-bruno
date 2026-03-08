use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};
use std::collections::HashMap;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        item::{generate_uid, Item, ItemResponse, ItemType, Request, Settings},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct ItemService {
    items: Collection<Item>,
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
    ws_manager: crate::ws::WsManager,
}

impl ItemService {
    pub fn new(db: &Database, ws_service: WorkspaceService, ws_manager: crate::ws::WsManager) -> Self {
        Self {
            items: db.collection("items"),
            collections: db.collection("collections"),
            ws_service,
            ws_manager,
        }
    }

    async fn get_collection(&self, collection_uid: &str) -> AppResult<CollectionModel> {
        self.collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    pub async fn create_folder(
        &self,
        collection_uid: &str,
        user_id: ObjectId,
        name: String,
        parent_uid: Option<String>,
        seq: Option<f64>,
    ) -> AppResult<ItemResponse> {
        let col = self.get_collection(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let mut item = Item::new_folder(name, collection_uid.to_string(), parent_uid, seq.unwrap_or(0.0));
        let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
        item.id = res.inserted_id.as_object_id();
        let resp = ItemResponse::from(item);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "created".into(),
                item_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn create_request(
        &self,
        collection_uid: &str,
        user_id: ObjectId,
        name: String,
        parent_uid: Option<String>,
        seq: Option<f64>,
        method: String,
        url: String,
    ) -> AppResult<ItemResponse> {
        let col = self.get_collection(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let mut item = Item::new_request(name, collection_uid.to_string(), parent_uid, seq.unwrap_or(0.0), method, url);
        let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
        item.id = res.inserted_id.as_object_id();
        let resp = ItemResponse::from(item);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "created".into(),
                item_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn list_by_collection(&self, collection_uid: &str, user_id: ObjectId) -> AppResult<Vec<ItemResponse>> {
        let col = self.get_collection(collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;

        let mut cursor = self.items.find(doc! { "collectionUid": collection_uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(i)) = cursor.next().await { result.push(ItemResponse::from(i)); }
        Ok(result)
    }

    pub async fn get(&self, item_uid: &str, user_id: ObjectId) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_uid).await?;
        let col = self.get_collection(&item.collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        Ok(ItemResponse::from(item))
    }

    pub async fn update(
        &self,
        item_uid: &str,
        user_id: ObjectId,
        name: Option<String>,
        request: Option<Request>,
        settings: Option<Settings>,
        docs: Option<String>,
    ) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_uid).await?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let item_oid = item.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_chrono(now) };

        if let Some(n) = &name { update.insert("name", n); }
        if let Some(req) = request {
            let req_bson = bson::to_bson(&req).map_err(|e| AppError::BadRequest(e.to_string()))?;
            update.insert("request", req_bson);
        }
        if let Some(s) = settings {
            let settings_bson = bson::to_bson(&s).map_err(|e| AppError::BadRequest(e.to_string()))?;
            update.insert("settings", settings_bson);
        }
        if let Some(d) = docs {
            update.insert("docs", if d.is_empty() { bson::Bson::Null } else { bson::Bson::String(d) });
        }

        self.items.update_one(doc! { "_id": item_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_raw(item_uid).await?;
        let resp = ItemResponse::from(updated);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "updated".into(),
                item_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn delete(&self, item_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let item = self.get_raw(item_uid).await?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        let workspace_uid = col.workspace_uid.clone();
        let deleted_uid = item.uid.clone();
        self.cascade_delete(&item).await?;
        self.ws_manager.broadcast(
            &workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "deleted".into(),
                item_uid: deleted_uid.clone(),
                data: serde_json::json!({ "uid": deleted_uid }),
            },
        );
        Ok(())
    }

    async fn cascade_delete(&self, item: &Item) -> AppResult<()> {
        let mut cursor = self.items.find(doc! { "parentUid": &item.uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut children = Vec::new();
        while let Some(Ok(child)) = cursor.next().await { children.push(child); }
        for child in children {
            Box::pin(self.cascade_delete(&child)).await?;
        }
        self.items.update_one(
            doc! { "_id": item.id.unwrap() },
            doc! { "$set": { "deletedAt": bson::DateTime::now() } },
        ).await.map_err(AppError::from)?;
        Ok(())
    }

    pub async fn move_item(&self, item_uid: &str, user_id: ObjectId, new_parent_uid: Option<String>, new_seq: Option<f64>) -> AppResult<ItemResponse> {
        let item = self.get_raw(item_uid).await?;
        let col = self.get_collection(&item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let item_oid = item.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_chrono(now) };

        match new_parent_uid {
            Some(uid) if !uid.is_empty() => { update.insert("parentUid", uid); }
            _ => { update.insert("parentUid", bson::Bson::Null); }
        }
        if let Some(seq) = new_seq { update.insert("seq", seq); }

        self.items.update_one(doc! { "_id": item_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_raw(item_uid).await?;
        let resp = ItemResponse::from(updated);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "updated".into(),
                item_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    async fn get_raw(&self, item_uid: &str) -> AppResult<Item> {
        self.items
            .find_one(doc! { "uid": item_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Item not found".into()))
    }

    pub async fn clone_item(
        &self,
        item_uid: &str,
        user_id: ObjectId,
        new_name: String,
        target_parent_uid: Option<String>,
    ) -> AppResult<ItemResponse> {
        let source_item = self.get_raw(item_uid).await?;
        let col = self.get_collection(&source_item.collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let target_parent = target_parent_uid.or(source_item.parent_uid.clone());

        let resp = if source_item.item_type == ItemType::Request {
            self.clone_request(source_item, new_name, target_parent).await?
        } else {
            self.clone_folder_recursive(source_item, new_name, target_parent).await?
        };
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::ItemChanged {
                action: "created".into(),
                item_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    async fn clone_request(&self, source: Item, new_name: String, target_parent_uid: Option<String>) -> AppResult<ItemResponse> {
        let now = Utc::now();
        let new_item = Item {
            id: None,
            uid: generate_uid(),
            item_type: ItemType::Request,
            name: new_name,
            collection_uid: source.collection_uid.clone(),
            parent_uid: target_parent_uid,
            seq: source.seq + 1.0,
            request: source.request.clone(),
            settings: source.settings.clone(),
            filename: source.filename.clone(),
            docs: source.docs.clone(),
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };
        let res = self.items.insert_one(&new_item).await.map_err(AppError::from)?;
        let _new_uid = res.inserted_id.as_object_id().map(|_| new_item.uid.clone()).unwrap_or_default();
        self.get_raw(&new_item.uid).await.map(ItemResponse::from)
    }

    async fn clone_folder_recursive(&self, source: Item, new_name: String, target_parent_uid: Option<String>) -> AppResult<ItemResponse> {
        let now = Utc::now();
        let new_uid = generate_uid();
        let new_folder = Item {
            id: None,
            uid: new_uid.clone(),
            item_type: ItemType::Folder,
            name: new_name,
            collection_uid: source.collection_uid.clone(),
            parent_uid: target_parent_uid,
            seq: source.seq + 1.0,
            request: None,
            settings: None,
            filename: None,
            docs: source.docs.clone(),
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };
        self.items.insert_one(&new_folder).await.map_err(AppError::from)?;
        self.clone_children(&source.uid, &new_uid, &source.collection_uid).await?;
        self.get_raw(&new_uid).await.map(ItemResponse::from)
    }

    async fn clone_children(&self, source_parent_uid: &str, new_parent_uid: &str, collection_uid: &str) -> AppResult<()> {
        let mut cursor = self.items.find(doc! { "parentUid": source_parent_uid, "collectionUid": collection_uid }).await.map_err(AppError::from)?;
        let mut children = Vec::new();
        while let Some(Ok(child)) = cursor.next().await { children.push(child); }
        if children.is_empty() { return Ok(()); }

        let mut uid_map: HashMap<String, String> = HashMap::new();
        for child in &children { uid_map.insert(child.uid.clone(), generate_uid()); }

        let now = Utc::now();
        for child in children {
            let new_uid = uid_map.get(&child.uid).unwrap().clone();
            let new_child = Item {
                id: None,
                uid: new_uid.clone(),
                item_type: child.item_type.clone(),
                name: child.name.clone(),
                collection_uid: collection_uid.to_string(),
                parent_uid: Some(new_parent_uid.to_string()),
                seq: child.seq,
                request: child.request.clone(),
                settings: child.settings.clone(),
                filename: child.filename.clone(),
                docs: child.docs.clone(),
                created_at: now,
                updated_at: now,
                deleted_at: None,
            };
            self.items.insert_one(&new_child).await.map_err(AppError::from)?;
            if child.item_type == ItemType::Folder {
                Box::pin(self.clone_children(&child.uid, &new_uid, collection_uid)).await?;
            }
        }
        Ok(())
    }
}
