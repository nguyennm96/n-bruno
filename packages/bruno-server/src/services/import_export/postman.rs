/// Postman Collection v2.1 Import and Export
use bson::{doc, oid::ObjectId};
use futures::StreamExt;
use mongodb::{Collection, Database};
use serde_json::Value;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        environment::{EnvVariable, Environment},
        example::Example,
        formats::postman::*,
        item::{Item, ItemType},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct PostmanService {
    collections: Collection<CollectionModel>,
    items: Collection<Item>,
    environments: Collection<Environment>,
    examples: Collection<Example>,
    ws_service: WorkspaceService,
}

impl PostmanService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            collections: db.collection("collections"),
            items: db.collection("items"),
            environments: db.collection("environments"),
            examples: db.collection("examples"),
            ws_service,
        }
    }

    // ── IMPORT ────────────────────────────────────────────────────────────────

    /// Import a Postman Collection v2.1 JSON into a workspace.
    /// Returns the created collection ID.
    pub async fn import(
        &self,
        workspace_id: &str,
        user_id: ObjectId,
        postman_json: &str,
        conflict: ImportConflict,
    ) -> AppResult<ImportResult> {
        // Validate access
        let (_, role) = self.ws_service.get_with_role(workspace_id, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor role required to import".into()));
        }

        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        // Parse JSON
        let pm_col: PostmanCollection = serde_json::from_str(postman_json)
            .map_err(|e| AppError::BadRequest(format!("Invalid Postman JSON: {e}")))?;

        // Handle name conflict
        let col_name = pm_col.info.name.clone();
        let existing = self.collections
            .find_one(doc! { "workspace_id": ws_oid, "name": &col_name })
            .await
            .map_err(AppError::from)?;

        if existing.is_some() {
            match conflict {
                ImportConflict::Error => {
                    return Err(AppError::Conflict(format!(
                        "Collection '{}' already exists. Use conflict=replace or conflict=rename.",
                        col_name
                    )));
                }
                ImportConflict::Replace => {
                    // Delete the existing collection and its items
                    if let Some(ref existing_col) = existing {
                        let col_oid = existing_col.id.unwrap();
                        self.items.delete_many(doc! { "collection_id": col_oid }).await.map_err(AppError::from)?;
                        self.collections.delete_one(doc! { "_id": col_oid }).await.map_err(AppError::from)?;
                    }
                }
                ImportConflict::Rename => {
                    // Will create as "{name} (imported)"
                }
            }
        }

        // Create collection
        let final_name = if matches!(conflict, ImportConflict::Rename) && existing.is_some() {
            format!("{} (imported)", col_name)
        } else {
            col_name
        };

        let mut col = CollectionModel::new(
            final_name,
            pm_col.info.description.clone(),
            ws_oid,
        );
        let res = self.collections.insert_one(&col).await.map_err(AppError::from)?;
        let col_id = res.inserted_id.as_object_id().unwrap();
        col.id = Some(col_id);

        // Import items recursively
        let mut stats = ImportStats::default();
        self.import_items(&pm_col.item, col_id, None, &mut stats).await?;

        // Import collection-level variables as an environment (optional)
        if let Some(vars) = &pm_col.variable {
            if !vars.is_empty() {
                let env_vars: Vec<EnvVariable> = vars.iter().map(|v| EnvVariable {
                    key: v.key.clone(),
                    value: v.value.as_str().unwrap_or_default().to_string(),
                    enabled: !v.disabled.unwrap_or(false),
                }).collect();

                let mut env = Environment::new(
                    format!("{} Variables", pm_col.info.name),
                    ws_oid,
                    env_vars,
                );
                self.environments.insert_one(&env).await.map_err(AppError::from)?;
                stats.environments_created += 1;
            }
        }

        Ok(ImportResult {
            collection_id: col_id.to_hex(),
            collection_name: col.name,
            stats,
        })
    }

    async fn import_items(
        &self,
        items: &[PostmanItem],
        collection_id: ObjectId,
        parent_id: Option<ObjectId>,
        stats: &mut ImportStats,
    ) -> AppResult<()> {
        for (i, pm_item) in items.iter().enumerate() {
            let sort_order = i as f64;

            if pm_item.is_folder() {
                // Create folder
                let mut folder = Item::new_folder(
                    pm_item.name.clone(),
                    collection_id,
                    parent_id,
                    sort_order,
                );
                let res = self.items.insert_one(&folder).await.map_err(AppError::from)?;
                let folder_id = res.inserted_id.as_object_id().unwrap();
                folder.id = Some(folder_id);
                stats.folders_created += 1;

                // Recurse children
                if let Some(children) = &pm_item.item {
                    Box::pin(self.import_items(children, collection_id, Some(folder_id), stats)).await?;
                }
            } else if let Some(req) = &pm_item.request {
                let url_raw = req.url.as_raw();
                let mut item = Item::new_request(
                    pm_item.name.clone(),
                    collection_id,
                    parent_id,
                    sort_order,
                    req.method.clone(),
                    url_raw,
                );

                // Map headers to BSON document
                if let Some(headers) = &req.header {
                    let mut hdoc = bson::Document::new();
                    for h in headers.iter().filter(|h| !h.disabled.unwrap_or(false)) {
                        hdoc.insert(h.key.clone(), h.value.clone());
                    }
                    if !hdoc.is_empty() {
                        item.headers = Some(hdoc);
                    }
                }

                // Map body
                if let Some(body) = &req.body {
                    item.body = Some(crate::models::item::RequestBody {
                        body_type: Some(body.mode.clone()),
                        content: body.raw.clone(),
                    });
                }

                let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
                let item_id = res.inserted_id.as_object_id().unwrap();
                stats.requests_created += 1;

                // Import response examples
                if let Some(responses) = &pm_item.response {
                    for resp in responses {
                        let mut hdoc = bson::Document::new();
                        if let Some(headers) = &resp.header {
                            for h in headers {
                                hdoc.insert(h.key.clone(), h.value.clone());
                            }
                        }
                        let example = Example::new(
                            resp.name.clone(),
                            item_id,
                            resp.code.unwrap_or(200),
                            hdoc,
                            resp.body.clone(),
                        );
                        self.examples.insert_one(&example).await.map_err(AppError::from)?;
                        stats.examples_created += 1;
                    }
                }
            }
        }
        Ok(())
    }

    // ── EXPORT ────────────────────────────────────────────────────────────────

    /// Export a Bruno collection to Postman Collection v2.1 JSON
    pub async fn export_collection(
        &self,
        collection_id: &str,
        user_id: ObjectId,
    ) -> AppResult<PostmanCollection> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;

        let col = self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        // Access check
        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        // Load all items for this collection
        let mut cursor = self.items
            .find(doc! { "collection_id": col_oid })
            .await
            .map_err(AppError::from)?;
        let mut all_items: Vec<Item> = Vec::new();
        while let Some(Ok(i)) = cursor.next().await { all_items.push(i); }

        // Load all examples
        let mut ex_cursor = self.examples
            .find(doc! {})
            .await
            .map_err(AppError::from)?;
        let mut all_examples: Vec<Example> = Vec::new();
        while let Some(Ok(e)) = ex_cursor.next().await { all_examples.push(e); }

        // Build tree recursively
        let pm_items = self.build_pm_items(&all_items, &all_examples, None);

        Ok(PostmanCollection {
            info: PostmanInfo {
                name: col.name.clone(),
                description: col.description,
                schema: POSTMAN_SCHEMA.to_string(),
                postman_id: Some(col_oid.to_hex()),
            },
            item: pm_items,
            variable: None,
            auth: None,
        })
    }

    fn build_pm_items(
        &self,
        all_items: &[Item],
        all_examples: &[Example],
        parent_id: Option<ObjectId>,
    ) -> Vec<PostmanItem> {
        let mut result = Vec::new();

        let mut children: Vec<&Item> = all_items
            .iter()
            .filter(|i| i.parent_item_id == parent_id)
            .collect();
        children.sort_by(|a, b| a.sort_order.partial_cmp(&b.sort_order).unwrap_or(std::cmp::Ordering::Equal));

        for item in children {
            let item_id = item.id.unwrap();

            if item.item_type == ItemType::Folder {
                let nested = self.build_pm_items(all_items, all_examples, Some(item_id));
                result.push(PostmanItem {
                    name: item.name.clone(),
                    description: None,
                    item: Some(nested),
                    request: None,
                    response: None,
                });
            } else {
                // Request
                let headers: Vec<PostmanHeader> = item.headers.as_ref()
                    .map(|doc| doc.iter().map(|(k, v)| PostmanHeader {
                        key: k.clone(),
                        value: v.as_str().unwrap_or_default().to_string(),
                        header_type: Some("text".into()),
                        disabled: None,
                    }).collect())
                    .unwrap_or_default();

                let pm_body = item.body.as_ref().map(|b| PostmanBody {
                    mode: b.body_type.clone().unwrap_or_else(|| "raw".to_string()),
                    raw: b.content.clone(),
                    options: b.body_type.as_deref().map(|t| PostmanBodyOptions {
                        raw: Some(PostmanBodyRawOptions {
                            language: Some(if t == "json" { "json" } else { "text" }.to_string()),
                        }),
                    }),
                    urlencoded: None,
                    formdata: None,
                });

                // Map examples
                let responses: Vec<PostmanResponse> = all_examples.iter()
                    .filter(|e| e.item_id == item_id)
                    .map(|e| {
                        let resp_headers: Vec<PostmanHeader> = e.headers.iter()
                            .map(|(k, v)| PostmanHeader {
                                key: k.clone(),
                                value: v.as_str().unwrap_or_default().to_string(),
                                header_type: None,
                                disabled: None,
                            })
                            .collect();
                        PostmanResponse {
                            name: e.name.clone(),
                            status: Some(status_text(e.status_code)),
                            code: Some(e.status_code),
                            header: Some(resp_headers),
                            body: e.body.clone(),
                            original_request: None,
                        }
                    })
                    .collect();

                result.push(PostmanItem {
                    name: item.name.clone(),
                    description: None,
                    item: None,
                    request: Some(PostmanRequest {
                        method: item.method.clone().unwrap_or_else(|| "GET".to_string()),
                        url: PostmanUrl::Raw(item.url.clone().unwrap_or_default()),
                        header: if headers.is_empty() { None } else { Some(headers) },
                        body: pm_body,
                        auth: None,
                        description: None,
                    }),
                    response: if responses.is_empty() { None } else { Some(responses) },
                });
            }
        }
        result
    }

    /// Export entire workspace to Postman format (all collections)
    pub async fn export_workspace(
        &self,
        workspace_id: &str,
        user_id: ObjectId,
    ) -> AppResult<Vec<PostmanCollection>> {
        self.ws_service.get_with_role(workspace_id, user_id).await?;
        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        let mut cursor = self.collections
            .find(doc! { "workspace_id": ws_oid })
            .await
            .map_err(AppError::from)?;

        let mut result = Vec::new();
        while let Some(Ok(col)) = cursor.next().await {
            let col_id = col.id.unwrap().to_hex();
            result.push(self.export_collection(&col_id, user_id).await?);
        }
        Ok(result)
    }
}

// ── Helper types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct ImportStats {
    pub folders_created: usize,
    pub requests_created: usize,
    pub examples_created: usize,
    pub environments_created: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ImportResult {
    pub collection_id: String,
    pub collection_name: String,
    pub stats: ImportStats,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportConflict {
    Error,
    Replace,
    Rename,
}

fn status_text(code: u16) -> String {
    match code {
        200 => "OK", 201 => "Created", 204 => "No Content",
        400 => "Bad Request", 401 => "Unauthorized", 403 => "Forbidden",
        404 => "Not Found", 409 => "Conflict", 422 => "Unprocessable Entity",
        500 => "Internal Server Error",
        _ => "Unknown",
    }.to_string()
}
