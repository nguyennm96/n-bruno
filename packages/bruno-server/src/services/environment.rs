use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::StreamExt;
use mongodb::{Collection, Database};

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        environment::{EnvVariable, Environment, EnvironmentResponse},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct EnvironmentService {
    environments: Collection<Environment>,
    collections: Collection<CollectionModel>,
    ws_service: WorkspaceService,
}

impl EnvironmentService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            environments: db.collection("environments"),
            collections: db.collection("collections"),
            ws_service,
        }
    }

    // ========== WORKSPACE-LEVEL ENVIRONMENTS ==========

    pub async fn create(&self, workspace_id: &str, user_id: ObjectId, name: String, variables: Vec<EnvVariable>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let (_, role) = self.ws_service.get_with_role(workspace_id, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        // Check unique name within workspace
        if self.environments.find_one(doc! { "workspace_id": ws_oid, "name": &name }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict(format!("Environment '{}' already exists in this workspace", name)));
        }

        let mut env = Environment::new_workspace(name, ws_oid, variables);
        env.color = color;
        let res = self.environments.insert_one(&env).await.map_err(AppError::from)?;
        env.id = res.inserted_id.as_object_id();
        Ok(EnvironmentResponse::from(env))
    }

    pub async fn list(&self, workspace_id: &str, user_id: ObjectId) -> AppResult<Vec<EnvironmentResponse>> {
        self.ws_service.get_with_role(workspace_id, user_id).await?;
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        let mut cursor = self.environments.find(doc! { "workspace_id": ws_oid }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(EnvironmentResponse::from(e)); }
        Ok(result)
    }

    pub async fn update(&self, env_id: &str, user_id: ObjectId, name: Option<String>, variables: Option<Vec<EnvVariable>>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let env = self.get_raw(env_id).await?;

        // Check permissions based on scope
        if let Some(ws_id) = env.workspace_id {
            let (_, role) = self.ws_service.get_with_role(&ws_id.to_hex(), user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        } else if let Some(col_id) = env.collection_id {
            // Collection-scoped: check collection permissions
            let col = self.get_collection(&col_id.to_hex()).await?;
            let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        } else {
            return Err(AppError::Internal("Environment has no scope".into()));
        }

        let env_oid = env.id.unwrap();
        let now = Utc::now();
        let mut update = doc! { "updated_at": now.to_rfc3339() };
        if let Some(n) = &name { update.insert("name", n); }
        if let Some(vars) = &variables {
            let bson_vars = bson::to_bson(vars).map_err(|e| AppError::Internal(e.to_string()))?;
            update.insert("variables", bson_vars);
        }
        if let Some(c) = &color { update.insert("color", c); }

        self.environments.update_one(doc! { "_id": env_oid }, doc! { "$set": update }).await.map_err(AppError::from)?;
        let updated = self.get_raw(env_id).await?;
        Ok(EnvironmentResponse::from(updated))
    }

    pub async fn delete(&self, env_id: &str, user_id: ObjectId) -> AppResult<()> {
        let env = self.get_raw(env_id).await?;

        // Check permissions based on scope
        if let Some(ws_id) = env.workspace_id {
            let (_, role) = self.ws_service.get_with_role(&ws_id.to_hex(), user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        } else if let Some(col_id) = env.collection_id {
            let col = self.get_collection(&col_id.to_hex()).await?;
            let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        } else {
            return Err(AppError::Internal("Environment has no scope".into()));
        }

        self.environments.delete_one(doc! { "_id": env.id.unwrap() }).await.map_err(AppError::from)?;
        Ok(())
    }

    // ========== COLLECTION-LEVEL ENVIRONMENTS ==========

    pub async fn create_for_collection(&self, collection_id: &str, user_id: ObjectId, name: String, variables: Vec<EnvVariable>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let col = self.get_collection(collection_id).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        let col_oid = col.id.unwrap();

        // Check unique name within collection
        if self.environments.find_one(doc! { "collection_id": col_oid, "name": &name }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict(format!("Environment '{}' already exists in this collection", name)));
        }

        let mut env = Environment::new_collection(name, col_oid, variables);
        env.color = color;
        let res = self.environments.insert_one(&env).await.map_err(AppError::from)?;
        env.id = res.inserted_id.as_object_id();
        Ok(EnvironmentResponse::from(env))
    }

    pub async fn list_for_collection(&self, collection_id: &str, user_id: ObjectId) -> AppResult<Vec<EnvironmentResponse>> {
        let col = self.get_collection(collection_id).await?;
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        let col_oid = col.id.unwrap();
        let mut cursor = self.environments.find(doc! { "collection_id": col_oid }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(EnvironmentResponse::from(e)); }
        Ok(result)
    }

    // ========== HELPERS ==========

    async fn get_collection(&self, collection_id: &str) -> AppResult<CollectionModel> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;
        self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    async fn get_raw(&self, env_id: &str) -> AppResult<Environment> {
        let oid = ObjectId::parse_str(env_id)
            .map_err(|_| AppError::BadRequest("Invalid environment ID".into()))?;
        self.environments
            .find_one(doc! { "_id": oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Environment not found".into()))
    }
}
