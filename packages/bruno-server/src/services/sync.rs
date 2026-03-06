use bson::doc;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use mongodb::Database;
use serde::Serialize;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        collection::CollectionResponse,
        environment::Environment,
        environment::EnvironmentResponse,
        example::Example,
        example::ExampleResponse,
        item::Item,
        item::ItemResponse,
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct SyncService {
    db: Database,
    ws_service: WorkspaceService,
}

#[derive(Serialize)]
pub struct WorkspaceChanges {
    pub server_time: DateTime<Utc>,
    pub collections: Vec<CollectionResponse>,
    pub items: Vec<ItemResponse>,
    pub environments: Vec<EnvironmentResponse>,
    pub examples: Vec<ExampleResponse>,
    pub deletions: Vec<DeletionRecord>,
}

#[derive(Serialize)]
pub struct DeletionRecord {
    pub resource_type: String,
    pub uid: String,
    pub deleted_at: DateTime<Utc>,
}

impl SyncService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self { db: db.clone(), ws_service }
    }

    pub async fn get_changes(
        &self,
        workspace_uid: &str,
        user_id: bson::oid::ObjectId,
        since: Option<DateTime<Utc>>,
    ) -> AppResult<WorkspaceChanges> {
        self.ws_service.get_with_role(workspace_uid, user_id).await?;

        let server_time = Utc::now();
        let since_str = since.map(|t| t.to_rfc3339());

        // ── Collections ────────────────────────────────────────────────────
        let cols_coll: mongodb::Collection<CollectionModel> = self.db.collection("collections");
        let col_filter = if let Some(ts) = &since_str {
            doc! { "workspaceUid": workspace_uid, "updated_at": { "$gt": ts }, "deletedAt": { "$exists": false } }
        } else {
            doc! { "workspaceUid": workspace_uid, "deletedAt": { "$exists": false } }
        };
        let mut col_cursor = cols_coll.find(col_filter).await.map_err(AppError::from)?;
        let mut collections = Vec::new();
        let mut col_uids = Vec::new();
        while let Some(Ok(c)) = col_cursor.next().await {
            col_uids.push(c.uid.clone());
            collections.push(CollectionResponse::from(c));
        }

        // For items/environments we need all collection UIDs in this workspace (not just changed ones)
        let all_col_filter = doc! { "workspaceUid": workspace_uid, "deletedAt": { "$exists": false } };
        let mut all_col_cursor = cols_coll.find(all_col_filter).await.map_err(AppError::from)?;
        let mut all_col_uids = Vec::new();
        while let Some(Ok(c)) = all_col_cursor.next().await {
            all_col_uids.push(c.uid);
        }

        // ── Items ─────────────────────────────────────────────────────────
        let items_coll: mongodb::Collection<Item> = self.db.collection("items");
        let item_filter = if let Some(ts) = &since_str {
            doc! { "collectionUid": { "$in": &all_col_uids }, "updated_at": { "$gt": ts }, "deletedAt": { "$exists": false } }
        } else {
            doc! { "collectionUid": { "$in": &all_col_uids }, "deletedAt": { "$exists": false } }
        };
        let mut item_cursor = items_coll.find(item_filter).await.map_err(AppError::from)?;
        let mut items = Vec::new();
        let mut item_uids = Vec::new();
        while let Some(Ok(i)) = item_cursor.next().await {
            item_uids.push(i.uid.clone());
            items.push(ItemResponse::from(i));
        }

        // ── Environments ──────────────────────────────────────────────────
        let envs_coll: mongodb::Collection<Environment> = self.db.collection("environments");
        let env_filter = if let Some(ts) = &since_str {
            doc! {
                "$or": [
                    { "workspaceUid": workspace_uid },
                    { "collectionUid": { "$in": &all_col_uids } }
                ],
                "updated_at": { "$gt": ts },
                "deletedAt": { "$exists": false }
            }
        } else {
            doc! {
                "$or": [
                    { "workspaceUid": workspace_uid },
                    { "collectionUid": { "$in": &all_col_uids } }
                ],
                "deletedAt": { "$exists": false }
            }
        };
        let mut env_cursor = envs_coll.find(env_filter).await.map_err(AppError::from)?;
        let mut environments = Vec::new();
        while let Some(Ok(e)) = env_cursor.next().await { environments.push(EnvironmentResponse::from(e)); }

        // ── Examples ──────────────────────────────────────────────────────
        let examples_coll: mongodb::Collection<Example> = self.db.collection("examples");
        // Get all item UIDs for the workspace for example lookup
        let mut all_item_cursor = items_coll
            .find(doc! { "collectionUid": { "$in": &all_col_uids }, "deletedAt": { "$exists": false } })
            .await.map_err(AppError::from)?;
        let mut all_item_uids: Vec<String> = Vec::new();
        while let Some(Ok(i)) = all_item_cursor.next().await { all_item_uids.push(i.uid); }

        let example_filter = if let Some(ts) = &since_str {
            doc! { "requestUid": { "$in": &all_item_uids }, "updated_at": { "$gt": ts }, "deletedAt": { "$exists": false } }
        } else {
            doc! { "requestUid": { "$in": &all_item_uids }, "deletedAt": { "$exists": false } }
        };
        let mut ex_cursor = examples_coll.find(example_filter).await.map_err(AppError::from)?;
        let mut examples = Vec::new();
        while let Some(Ok(e)) = ex_cursor.next().await { examples.push(ExampleResponse::from(e)); }

        // ── Deletions ─────────────────────────────────────────────────────
        let mut deletions: Vec<DeletionRecord> = Vec::new();

        let del_filter = |extra: bson::Document| -> bson::Document {
            if let Some(ts) = &since_str {
                let mut f = extra.clone();
                f.insert("deletedAt", doc! { "$exists": true, "$gt": ts });
                f
            } else {
                let mut f = extra.clone();
                f.insert("deletedAt", doc! { "$exists": true });
                f
            }
        };

        // Deleted collections
        let mut del_col_cursor = cols_coll
            .find(del_filter(doc! { "workspaceUid": workspace_uid }))
            .await.map_err(AppError::from)?;
        while let Some(Ok(c)) = del_col_cursor.next().await {
            if let Some(deleted_at) = c.deleted_at {
                deletions.push(DeletionRecord {
                    resource_type: "collection".into(),
                    uid: c.uid,
                    deleted_at,
                });
            }
        }

        // Deleted items
        let mut del_item_cursor = items_coll
            .find(del_filter(doc! { "collectionUid": { "$in": &all_col_uids } }))
            .await.map_err(AppError::from)?;
        while let Some(Ok(i)) = del_item_cursor.next().await {
            if let Some(deleted_at) = i.deleted_at {
                deletions.push(DeletionRecord {
                    resource_type: "item".into(),
                    uid: i.uid,
                    deleted_at,
                });
            }
        }

        // Deleted environments
        let env_scope = doc! {
            "$or": [
                { "workspaceUid": workspace_uid },
                { "collectionUid": { "$in": &all_col_uids } }
            ]
        };
        let mut del_env_cursor = envs_coll
            .find(del_filter(env_scope))
            .await.map_err(AppError::from)?;
        while let Some(Ok(e)) = del_env_cursor.next().await {
            if let Some(deleted_at) = e.deleted_at {
                deletions.push(DeletionRecord {
                    resource_type: "environment".into(),
                    uid: e.uid,
                    deleted_at,
                });
            }
        }

        // Deleted examples
        let mut del_ex_cursor = examples_coll
            .find(del_filter(doc! { "requestUid": { "$in": &all_item_uids } }))
            .await.map_err(AppError::from)?;
        while let Some(Ok(e)) = del_ex_cursor.next().await {
            if let Some(deleted_at) = e.deleted_at {
                deletions.push(DeletionRecord {
                    resource_type: "example".into(),
                    uid: e.uid,
                    deleted_at,
                });
            }
        }

        Ok(WorkspaceChanges {
            server_time,
            collections,
            items,
            environments,
            examples,
            deletions,
        })
    }
}
