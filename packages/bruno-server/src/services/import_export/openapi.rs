/// OpenAPI 3.0 + Swagger 2.0 export
use bson::{doc, oid::ObjectId};
use futures::StreamExt;
use mongodb::{Collection, Database};
use std::collections::HashMap;
use url::Url;

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        example::Example,
        formats::openapi::*,
        item::{Item, ItemType},
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct OpenApiService {
    collections: Collection<CollectionModel>,
    items: Collection<Item>,
    examples: Collection<Example>,
    ws_service: WorkspaceService,
}

impl OpenApiService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            collections: db.collection("collections"),
            items: db.collection("items"),
            examples: db.collection("examples"),
            ws_service,
        }
    }

    // ── OpenAPI 3.0 ───────────────────────────────────────────────────────────

    pub async fn export_openapi3(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        server_url: Option<String>,
    ) -> AppResult<OpenApi3> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;

        let col = self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        // Load items and examples
        let all_items = self.load_items(col_oid).await?;
        let all_examples = self.load_examples().await?;

        let mut paths: HashMap<String, OpenApiPathItem> = HashMap::new();
        let mut tags: Vec<OpenApiTag> = Vec::new();

        // Walk folders as tags, requests as paths
        self.collect_paths_openapi3(
            &all_items,
            &all_examples,
            None,
            None,
            &mut paths,
            &mut tags,
        );

        let servers = server_url.map(|url| vec![OpenApiServer {
            url,
            description: Some("API Server".into()),
        }]);

        Ok(OpenApi3 {
            openapi: "3.0.0".to_string(),
            info: OpenApiInfo {
                title: col.name.clone(),
                version: "1.0.0".to_string(),
                description: col.description,
            },
            servers,
            paths,
            components: Some(OpenApiComponents {
                security_schemes: Some({
                    let mut m = HashMap::new();
                    m.insert("bearerAuth".to_string(), serde_json::json!({
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT"
                    }));
                    m
                }),
            }),
            tags: if tags.is_empty() { None } else { Some(tags) },
        })
    }

    fn collect_paths_openapi3(
        &self,
        all_items: &[Item],
        all_examples: &[Example],
        parent_id: Option<ObjectId>,
        current_tag: Option<String>,
        paths: &mut HashMap<String, OpenApiPathItem>,
        tags: &mut Vec<OpenApiTag>,
    ) {
        let mut children: Vec<&Item> = all_items
            .iter()
            .filter(|i| i.parent_item_id == parent_id)
            .collect();
        children.sort_by(|a, b| a.sort_order.partial_cmp(&b.sort_order).unwrap_or(std::cmp::Ordering::Equal));

        for item in children {
            let item_id = item.id.unwrap();
            match item.item_type {
                ItemType::Folder => {
                    tags.push(OpenApiTag {
                        name: item.name.clone(),
                        description: None,
                    });
                    self.collect_paths_openapi3(
                        all_items,
                        all_examples,
                        Some(item_id),
                        Some(item.name.clone()),
                        paths,
                        tags,
                    );
                }
                ItemType::Request => {
                    let url_str = item.url.as_deref().unwrap_or("/");
                    let path = extract_path(url_str);
                    let method = item.method.as_deref().unwrap_or("GET");

                    // Build responses from examples
                    let mut responses: HashMap<String, OpenApiResponse> = HashMap::new();
                    for ex in all_examples.iter().filter(|e| e.item_id == item_id) {
                        let content_type = ex.headers.get("Content-Type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("application/json")
                            .to_string();

                        let body_example = ex.body.as_deref()
                            .and_then(|b| serde_json::from_str::<serde_json::Value>(b).ok());

                        let mut media_content: HashMap<String, OpenApiMediaType> = HashMap::new();
                        media_content.insert(content_type.clone(), OpenApiMediaType {
                            schema: Some(OpenApiSchema {
                                schema_type: Some("object".into()),
                                format: None,
                                example: body_example.clone(),
                                extra: Default::default(),
                            }),
                            example: body_example,
                        });

                        responses.insert(ex.status_code.to_string(), OpenApiResponse {
                            description: ex.name.clone(),
                            content: Some(media_content),
                        });
                    }

                    if responses.is_empty() {
                        responses.insert("200".to_string(), OpenApiResponse {
                            description: "Successful response".to_string(),
                            content: None,
                        });
                    }

                    // Build request body for methods that have body
                    let request_body = if matches!(method, "POST" | "PUT" | "PATCH") {
                        item.body.as_ref().map(|b| {
                            let mode = b.get("mode")
                                .and_then(|v| v.as_str())
                                .unwrap_or("text");
                            let ct = if mode == "json" {
                                "application/json"
                            } else {
                                "text/plain"
                            };
                            let content_text = b.get("raw")
                                .or_else(|| b.get("text"))
                                .and_then(|v| v.as_str());
                            let example = content_text
                                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
                            let mut content: HashMap<String, OpenApiMediaType> = HashMap::new();
                            content.insert(ct.to_string(), OpenApiMediaType {
                                schema: Some(OpenApiSchema {
                                    schema_type: Some("object".into()),
                                    format: None,
                                    example: example.clone(),
                                    extra: Default::default(),
                                }),
                                example,
                            });
                            OpenApiRequestBody {
                                description: None,
                                required: true,
                                content,
                            }
                        })
                    } else {
                        None
                    };

                    let op = OpenApiOperation {
                        operation_id: Some(slugify(&format!("{} {}", method, item.name))),
                        summary: item.name.clone(),
                        description: None,
                        tags: current_tag.as_ref().map(|t| vec![t.clone()]),
                        parameters: build_query_params_openapi3(url_str),
                        request_body,
                        responses,
                        security: None,
                    };

                    let path_item = paths.entry(path).or_default();
                    path_item.set_operation(method, op);
                }
            }
        }
    }

    // ── Swagger 2.0 ───────────────────────────────────────────────────────────

    pub async fn export_swagger2(
        &self,
        collection_id: &str,
        user_id: ObjectId,
        host: Option<String>,
        base_path: Option<String>,
    ) -> AppResult<Swagger2> {
        let col_oid = ObjectId::parse_str(collection_id)
            .map_err(|_| AppError::BadRequest("Invalid collection ID".into()))?;

        let col = self.collections
            .find_one(doc! { "_id": col_oid })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        self.ws_service.get_with_role(&col.workspace_id.to_hex(), user_id).await?;

        let all_items = self.load_items(col_oid).await?;
        let all_examples = self.load_examples().await?;

        let mut paths: HashMap<String, Swagger2PathItem> = HashMap::new();
        let mut tags: Vec<OpenApiTag> = Vec::new();

        self.collect_paths_swagger2(&all_items, &all_examples, None, None, &mut paths, &mut tags);

        Ok(Swagger2 {
            swagger: "2.0".to_string(),
            info: OpenApiInfo {
                title: col.name,
                version: "1.0.0".to_string(),
                description: col.description,
            },
            host,
            base_path,
            paths,
            tags: if tags.is_empty() { None } else { Some(tags) },
            consumes: Some(vec!["application/json".into()]),
            produces: Some(vec!["application/json".into()]),
        })
    }

    fn collect_paths_swagger2(
        &self,
        all_items: &[Item],
        all_examples: &[Example],
        parent_id: Option<ObjectId>,
        current_tag: Option<String>,
        paths: &mut HashMap<String, Swagger2PathItem>,
        tags: &mut Vec<OpenApiTag>,
    ) {
        let mut children: Vec<&Item> = all_items
            .iter()
            .filter(|i| i.parent_item_id == parent_id)
            .collect();
        children.sort_by(|a, b| a.sort_order.partial_cmp(&b.sort_order).unwrap_or(std::cmp::Ordering::Equal));

        for item in children {
            let item_id = item.id.unwrap();
            match item.item_type {
                ItemType::Folder => {
                    tags.push(OpenApiTag { name: item.name.clone(), description: None });
                    self.collect_paths_swagger2(all_items, all_examples, Some(item_id), Some(item.name.clone()), paths, tags);
                }
                ItemType::Request => {
                    let url_str = item.url.as_deref().unwrap_or("/");
                    let path = extract_path(url_str);
                    let method = item.method.as_deref().unwrap_or("GET");

                    let mut responses: HashMap<String, OpenApiResponse> = HashMap::new();
                    for ex in all_examples.iter().filter(|e| e.item_id == item_id) {
                        responses.insert(ex.status_code.to_string(), OpenApiResponse {
                            description: ex.name.clone(),
                            content: None,
                        });
                    }
                    if responses.is_empty() {
                        responses.insert("200".to_string(), OpenApiResponse {
                            description: "OK".into(),
                            content: None,
                        });
                    }

                    let mut parameters = build_query_params_swagger2(url_str);
                    if matches!(method, "POST" | "PUT" | "PATCH") {
                        parameters.push(Swagger2Parameter {
                            name: "body".into(),
                            location: "body".into(),
                            description: None,
                            required: true,
                            param_type: None,
                            schema: Some(OpenApiSchema {
                                schema_type: Some("object".into()),
                                format: None,
                                example: None,
                                extra: Default::default(),
                            }),
                        });
                    }

                    let op = Swagger2Operation {
                        operation_id: Some(slugify(&format!("{} {}", method, item.name))),
                        summary: item.name.clone(),
                        description: None,
                        tags: current_tag.as_ref().map(|t| vec![t.clone()]),
                        parameters: if parameters.is_empty() { None } else { Some(parameters) },
                        responses,
                        consumes: Some(vec!["application/json".into()]),
                        produces: Some(vec!["application/json".into()]),
                    };

                    paths.entry(path).or_default().set_operation(method, op);
                }
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    async fn load_items(&self, col_oid: ObjectId) -> AppResult<Vec<Item>> {
        let mut cursor = self.items
            .find(doc! { "collection_id": col_oid })
            .await
            .map_err(AppError::from)?;
        let mut items = Vec::new();
        while let Some(Ok(i)) = cursor.next().await { items.push(i); }
        Ok(items)
    }

    async fn load_examples(&self) -> AppResult<Vec<Example>> {
        let mut cursor = self.examples.find(doc! {}).await.map_err(AppError::from)?;
        let mut examples = Vec::new();
        while let Some(Ok(e)) = cursor.next().await { examples.push(e); }
        Ok(examples)
    }
}

// ── URL utilities ─────────────────────────────────────────────────────────────

fn extract_path(url_str: &str) -> String {
    // Try to parse as full URL
    if let Ok(u) = Url::parse(url_str) {
        let path = u.path().to_string();
        // Replace {var} Postman style (already OpenAPI compatible)
        return if path.is_empty() { "/".to_string() } else { path };
    }
    // Might be just a path like /api/users or contain variables
    let path = url_str.split('?').next().unwrap_or(url_str);
    // Remove protocol-like prefix if any
    let path = if let Some(idx) = path.find("//") {
        let after_host = &path[idx + 2..];
        after_host.find('/').map(|i| &after_host[i..]).unwrap_or("/")
    } else {
        path
    };
    if path.is_empty() { "/".to_string() } else { path.to_string() }
}

fn build_query_params_openapi3(url_str: &str) -> Option<Vec<OpenApiParameter>> {
    let params: Vec<OpenApiParameter> = extract_query_params(url_str)
        .into_iter()
        .map(|key| OpenApiParameter {
            name: key,
            location: "query".into(),
            description: None,
            required: false,
            schema: OpenApiSchema {
                schema_type: Some("string".into()),
                format: None,
                example: None,
                extra: Default::default(),
            },
        })
        .collect();
    if params.is_empty() { None } else { Some(params) }
}

fn build_query_params_swagger2(url_str: &str) -> Vec<Swagger2Parameter> {
    extract_query_params(url_str)
        .into_iter()
        .map(|key| Swagger2Parameter {
            name: key,
            location: "query".into(),
            description: None,
            required: false,
            param_type: Some("string".into()),
            schema: None,
        })
        .collect()
}

fn extract_query_params(url_str: &str) -> Vec<String> {
    if let Ok(u) = Url::parse(url_str) {
        return u.query_pairs().map(|(k, _)| k.to_string()).collect();
    }
    if let Some(qs) = url_str.split('?').nth(1) {
        return qs.split('&')
            .filter_map(|p| p.split('=').next().map(|k| k.trim_start_matches(':').to_string()))
            .filter(|k| !k.is_empty())
            .collect();
    }
    Vec::new()
}

fn slugify(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '_' })
        .collect::<String>()
        .split('_')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("_")
}
