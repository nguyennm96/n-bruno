use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};

use crate::{
    errors::{AppError, AppResult},
    models::collection::{Collection as CollectionModel, CollectionResponse},
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct CollectionService {
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
}

impl CollectionService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            collections: db.collection("collections"),
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

    pub async fn update(&self, collection_id: &str, user_id: ObjectId, name: Option<String>, description: Option<String>) -> AppResult<CollectionResponse> {
        let col = self.get_collection_raw(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor or Owner role required".into()));
        }

        let col_oid = col.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": bson::DateTime::from_millis(now.timestamp_millis()) };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(d) = &description { update.insert("description", d); }

        self.collections.update_one(doc! { "_id": col_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;

        Ok(CollectionResponse {
            id: col_oid.to_hex(),
            name: name.unwrap_or(col.name),
            description: description.or(col.description),
            workspace_id: col.workspace_id.to_hex(),
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
}
