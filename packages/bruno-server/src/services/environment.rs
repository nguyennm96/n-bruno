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
    ws_manager: crate::ws::WsManager,
}

impl EnvironmentService {
    pub fn new(db: &Database, ws_service: WorkspaceService, ws_manager: crate::ws::WsManager) -> Self {
        Self {
            environments: db.collection("environments"),
            collections: db.collection("collections"),
            ws_service,
            ws_manager,
        }
    }

    // ── Workspace-level environments ─────────────────────────────────────────

    pub async fn create(&self, workspace_uid: &str, user_id: ObjectId, name: String, variables: Vec<EnvVariable>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let (_, role) = self.ws_service.get_with_role(workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        if self.environments.find_one(doc! { "workspaceUid": workspace_uid, "name": &name }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict(format!("Environment '{}' already exists in this workspace", name)));
        }

        let mut env = Environment::new_workspace(name, workspace_uid.to_string(), variables);
        env.color = color;
        let res = self.environments.insert_one(&env).await.map_err(AppError::from)?;
        env.id = res.inserted_id.as_object_id();
        let resp = EnvironmentResponse::from(env);
        self.ws_manager.broadcast(
            workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::EnvironmentChanged {
                action: "created".into(),
                environment_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn list(&self, workspace_uid: &str, user_id: ObjectId) -> AppResult<Vec<EnvironmentResponse>> {
        self.ws_service.get_with_role(workspace_uid, user_id).await?;
        let mut cursor = self.environments.find(doc! { "workspaceUid": workspace_uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(EnvironmentResponse::from(e)); }
        Ok(result)
    }

    pub async fn update(&self, env_uid: &str, user_id: ObjectId, name: Option<String>, variables: Option<Vec<EnvVariable>>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let env = self.get_raw(env_uid).await?;

        if let Some(ws_uid) = &env.workspace_uid {
            let (_, role) = self.ws_service.get_with_role(ws_uid, user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
        } else if let Some(col_uid) = &env.collection_uid {
            let col = self.get_collection(col_uid).await?;
            let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
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
        let updated = self.get_raw(env_uid).await?;
        let resp = EnvironmentResponse::from(updated);
        // Broadcast to the relevant workspace
        let ws_uid_for_broadcast = if let Some(ws) = &resp.workspace_uid {
            Some(ws.clone())
        } else if let Some(col_uid) = &env.collection_uid {
            self.get_collection(col_uid).await.ok().map(|c| c.workspace_uid)
        } else {
            None
        };
        if let Some(ws_uid) = ws_uid_for_broadcast {
            self.ws_manager.broadcast(
                &ws_uid,
                &user_id.to_hex(),
                crate::ws::WsEvent::EnvironmentChanged {
                    action: "updated".into(),
                    environment_uid: resp.uid.clone(),
                    data: serde_json::to_value(&resp).unwrap_or_default(),
                },
            );
        }
        Ok(resp)
    }

    pub async fn delete(&self, env_uid: &str, user_id: ObjectId) -> AppResult<()> {
        let env = self.get_raw(env_uid).await?;

        let workspace_uid = if let Some(ws_uid) = &env.workspace_uid {
            let (_, role) = self.ws_service.get_with_role(ws_uid, user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
            ws_uid.clone()
        } else if let Some(col_uid) = &env.collection_uid {
            let col = self.get_collection(col_uid).await?;
            let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
            if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }
            col.workspace_uid.clone()
        } else {
            return Err(AppError::Internal("Environment has no scope".into()));
        };

        let deleted_uid = env.uid.clone();
        self.environments.update_one(
            doc! { "_id": env.id.unwrap() },
            doc! { "$set": { "deletedAt": chrono::Utc::now().to_rfc3339() } },
        ).await.map_err(AppError::from)?;
        self.ws_manager.broadcast(
            &workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::EnvironmentChanged {
                action: "deleted".into(),
                environment_uid: deleted_uid.clone(),
                data: serde_json::json!({ "uid": deleted_uid }),
            },
        );
        Ok(())
    }

    // ── Collection-level environments ────────────────────────────────────────

    pub async fn create_for_collection(&self, collection_uid: &str, user_id: ObjectId, name: String, variables: Vec<EnvVariable>, color: Option<String>) -> AppResult<EnvironmentResponse> {
        let col = self.get_collection(collection_uid).await?;
        let (_, role) = self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;
        if !role.can_write() { return Err(AppError::Forbidden("Editor role required".into())); }

        if self.environments.find_one(doc! { "collectionUid": collection_uid, "name": &name }).await.map_err(AppError::from)?.is_some() {
            return Err(AppError::Conflict(format!("Environment '{}' already exists in this collection", name)));
        }

        let mut env = Environment::new_collection(name, collection_uid.to_string(), variables);
        env.color = color;
        let res = self.environments.insert_one(&env).await.map_err(AppError::from)?;
        env.id = res.inserted_id.as_object_id();
        let resp = EnvironmentResponse::from(env);
        self.ws_manager.broadcast(
            &col.workspace_uid,
            &user_id.to_hex(),
            crate::ws::WsEvent::EnvironmentChanged {
                action: "created".into(),
                environment_uid: resp.uid.clone(),
                data: serde_json::to_value(&resp).unwrap_or_default(),
            },
        );
        Ok(resp)
    }

    pub async fn list_for_collection(&self, collection_uid: &str, user_id: ObjectId) -> AppResult<Vec<EnvironmentResponse>> {
        let col = self.get_collection(collection_uid).await?;
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;

        let mut cursor = self.environments.find(doc! { "collectionUid": collection_uid, "deletedAt": { "$exists": false } }).await.map_err(AppError::from)?;
        let mut result = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { result.push(EnvironmentResponse::from(e)); }
        Ok(result)
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    async fn get_collection(&self, collection_uid: &str) -> AppResult<CollectionModel> {
        self.collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))
    }

    async fn get_raw(&self, env_uid: &str) -> AppResult<Environment> {
        self.environments
            .find_one(doc! { "uid": env_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Environment not found".into()))
    }
}
