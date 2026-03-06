/// Postman Collection v2.1 Import and Export
use bson::{doc, oid::ObjectId};
use futures::StreamExt;
use mongodb::{Collection, Database};

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

        // Parse JSON
        let pm_col: PostmanCollection = serde_json::from_str(postman_json)
            .map_err(|e| AppError::BadRequest(format!("Invalid Postman JSON: {e}")))?;

        // Handle name conflict
        let col_name = pm_col.info.name.clone();
        let existing = self.collections
            .find_one(doc! { "workspaceUid": workspace_id, "name": &col_name })
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
                        self.items.delete_many(doc! { "collectionUid": existing_col.uid.clone() }).await.map_err(AppError::from)?;
                        self.collections.delete_one(doc! { "_id": existing_col.id.unwrap() }).await.map_err(AppError::from)?;
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

        let col = CollectionModel::new(
            final_name,
            pm_col.info.description.clone(),
            workspace_id.to_string(),
        );
        self.collections.insert_one(&col).await.map_err(AppError::from)?;

        // Import items recursively
        let mut stats = ImportStats::default();
        self.import_items(&pm_col.item, col.uid.clone(), None, &mut stats).await?;

        // Import collection-level variables as an environment (optional)
        if let Some(vars) = &pm_col.variable {
            if !vars.is_empty() {
                let env_vars: Vec<EnvVariable> = vars.iter().map(|v| EnvVariable {
                    uid: None,
                    name: v.key.clone(),
                    value: v.value.as_str().unwrap_or_default().to_string(),
                    enabled: !v.disabled.unwrap_or(false),
                    secret: None,
                }).collect();

                let env = Environment::new(
                    format!("{} Variables", pm_col.info.name),
                    workspace_id.to_string(),
                    env_vars,
                );
                self.environments.insert_one(&env).await.map_err(AppError::from)?;
                stats.environments_created += 1;
            }
        }

        Ok(ImportResult {
            collection_uid: col.uid.clone(),
            collection_name: col.name,
            stats,
        })
    }

    async fn import_items(
        &self,
        items: &[PostmanItem],
        col_uid: String,
        parent_uid: Option<String>,
        stats: &mut ImportStats,
    ) -> AppResult<()> {
        for (i, pm_item) in items.iter().enumerate() {
            let seq = i as f64;

            if pm_item.is_folder() {
                // Create folder
                let folder = Item::new_folder(
                    pm_item.name.clone(),
                    col_uid.clone(),
                    parent_uid.clone(),
                    seq,
                );
                self.items.insert_one(&folder).await.map_err(AppError::from)?;
                stats.folders_created += 1;

                // Recurse children
                if let Some(children) = &pm_item.item {
                    Box::pin(self.import_items(children, col_uid.clone(), Some(folder.uid.clone()), stats)).await?;
                }
            } else if let Some(req) = &pm_item.request {
                let url_raw = req.url.as_raw();
                let item = Item::new_request(
                    pm_item.name.clone(),
                    col_uid.clone(),
                    parent_uid.clone(),
                    seq,
                    req.method.clone(),
                    url_raw,
                );

                self.items.insert_one(&item).await.map_err(AppError::from)?;
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
                            item.uid.clone(),
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
        let col = self.collections
            .find_one(doc! { "uid": collection_id })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        // Access check
        self.ws_service.get_with_role(&col.workspace_uid, user_id).await?;

        // Load all items for this collection
        let mut cursor = self.items
            .find(doc! { "collectionUid": collection_id })
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
                postman_id: Some(col.uid.clone()),
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
        parent_uid: Option<String>,
    ) -> Vec<PostmanItem> {
        let mut result = Vec::new();

        let mut children: Vec<&Item> = all_items
            .iter()
            .filter(|i| i.parent_uid == parent_uid)
            .collect();
        children.sort_by(|a, b| a.seq.partial_cmp(&b.seq).unwrap_or(std::cmp::Ordering::Equal));

        for item in children {
            if item.item_type == ItemType::Folder {
                let nested = self.build_pm_items(all_items, all_examples, Some(item.uid.clone()));
                result.push(PostmanItem {
                    name: item.name.clone(),
                    description: None,
                    item: Some(nested),
                    request: None,
                    response: None,
                });
            } else {
                // Request
                let request = item.request.as_ref();

                let headers: Vec<PostmanHeader> = request
                    .map(|r| r.headers.iter().map(|h| PostmanHeader {
                        key: h.name.clone().unwrap_or_default(),
                        value: h.value.clone().unwrap_or_default(),
                        header_type: Some("text".into()),
                        disabled: Some(!h.enabled),
                    }).collect())
                    .unwrap_or_default();

                let pm_body = request.and_then(|r| {
                    let mode = r.body.mode.as_str();
                    if mode == "none" { return None; }
                    let raw = match mode {
                        "json" => r.body.json.clone(),
                        "text" => r.body.text.clone(),
                        _ => None,
                    };
                    Some(PostmanBody {
                        mode: mode.to_string(),
                        raw,
                        options: Some(PostmanBodyOptions {
                            raw: Some(PostmanBodyRawOptions {
                                language: Some(if mode == "json" { "json" } else { "text" }.to_string()),
                            }),
                        }),
                        urlencoded: None,
                        formdata: None,
                    })
                });

                // Map examples
                let responses: Vec<PostmanResponse> = all_examples.iter()
                    .filter(|e| e.request_uid == item.uid)
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
                        method: request.map(|r| r.method.clone()).unwrap_or_else(|| "GET".to_string()),
                        url: PostmanUrl::Raw(request.map(|r| r.url.clone()).unwrap_or_default()),
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

        let mut cursor = self.collections
            .find(doc! { "workspaceUid": workspace_id })
            .await
            .map_err(AppError::from)?;

        let mut result = Vec::new();
        while let Some(Ok(col)) = cursor.next().await {
            result.push(self.export_collection(&col.uid, user_id).await?);
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
    pub collection_uid: String,
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
