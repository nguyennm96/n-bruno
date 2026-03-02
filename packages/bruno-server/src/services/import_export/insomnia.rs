/// Insomnia export format importer (simplified)
use bson::{doc, oid::ObjectId};
use mongodb::{Collection, Database};
use serde::{Deserialize, Serialize};

use crate::{
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        item::Item,
    },
    services::{
        import_export::postman::{ImportResult, ImportStats},
        workspace::WorkspaceService,
    },
};

#[derive(Debug, Deserialize)]
pub struct InsomniaExport {
    #[serde(rename = "__export_format")]
    pub export_format: Option<u32>,
    pub resources: Vec<InsomniaResource>,
}

#[derive(Debug, Deserialize)]
pub struct InsomniaResource {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "_type")]
    pub resource_type: String, // request_group, request, workspace, environment
    pub name: String,
    #[serde(rename = "parentId", default)]
    pub parent_id: Option<String>,
    // Request fields
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<InsomniaHeader>>,
    pub body: Option<InsomniaBody>,
}

#[derive(Debug, Deserialize)]
pub struct InsomniaHeader {
    pub name: String,
    pub value: String,
    pub disabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct InsomniaBody {
    pub mimeType: Option<String>,
    pub text: Option<String>,
}

#[derive(Clone)]
pub struct InsomniaService {
    collections: Collection<CollectionModel>,
    items: Collection<Item>,
    ws_service: WorkspaceService,
}

impl InsomniaService {
    pub fn new(db: &Database, ws_service: WorkspaceService) -> Self {
        Self {
            collections: db.collection("collections"),
            items: db.collection("items"),
            ws_service,
        }
    }

    pub async fn import(
        &self,
        workspace_id: &str,
        user_id: ObjectId,
        insomnia_json: &str,
    ) -> AppResult<ImportResult> {
        let (_, role) = self.ws_service.get_with_role(workspace_id, user_id).await?;
        if !role.can_write() {
            return Err(AppError::Forbidden("Editor role required".into()));
        }

        let ws_oid = ObjectId::parse_str(workspace_id)
            .map_err(|_| AppError::BadRequest("Invalid workspace ID".into()))?;

        let export: InsomniaExport = serde_json::from_str(insomnia_json)
            .map_err(|e| AppError::BadRequest(format!("Invalid Insomnia JSON: {e}")))?;

        // Find top-level workspace resource for name
        let workspace_name = export.resources.iter()
            .find(|r| r.resource_type == "workspace")
            .map(|r| r.name.clone())
            .unwrap_or_else(|| "Imported from Insomnia".to_string());

        let mut col = CollectionModel::new(workspace_name.clone(), None, ws_oid);
        let res = self.collections.insert_one(&col).await.map_err(AppError::from)?;
        let col_id = res.inserted_id.as_object_id().unwrap();
        col.id = Some(col_id);

        let mut stats = ImportStats::default();

        // Build id -> ObjectId map for parent references
        let mut id_map: std::collections::HashMap<String, ObjectId> = std::collections::HashMap::new();
        id_map.insert(
            export.resources.iter()
                .find(|r| r.resource_type == "workspace")
                .map(|r| r.id.clone())
                .unwrap_or_default(),
            col_id,
        );

        // Process folders first (request_group), then requests
        let folders: Vec<&InsomniaResource> = export.resources.iter()
            .filter(|r| r.resource_type == "request_group")
            .collect();

        for folder in &folders {
            let parent_bruno_id = folder.parent_id.as_deref()
                .and_then(|pid| id_map.get(pid)).copied();

            let mut item = Item::new_folder(
                folder.name.clone(),
                col_id,
                parent_bruno_id,
                stats.folders_created as f64,
            );
            let res = self.items.insert_one(&item).await.map_err(AppError::from)?;
            let item_id = res.inserted_id.as_object_id().unwrap();
            id_map.insert(folder.id.clone(), item_id);
            stats.folders_created += 1;
        }

        // Process requests
        let requests: Vec<&InsomniaResource> = export.resources.iter()
            .filter(|r| r.resource_type == "request")
            .collect();

        for request in &requests {
            let parent_bruno_id = request.parent_id.as_deref()
                .and_then(|pid| id_map.get(pid)).copied();

            let method = request.method.clone().unwrap_or_else(|| "GET".to_string());
            let url = request.url.clone().unwrap_or_default();

            let mut item = Item::new_request(
                request.name.clone(),
                col_id,
                parent_bruno_id,
                stats.requests_created as f64,
                method,
                url,
            );

            // Map headers
            if let Some(headers) = &request.headers {
                let mut hdoc = bson::Document::new();
                for h in headers.iter().filter(|h| !h.disabled.unwrap_or(false)) {
                    hdoc.insert(h.name.clone(), h.value.clone());
                }
                if !hdoc.is_empty() { item.headers = Some(hdoc); }
            }

            // Map body
            if let Some(body) = &request.body {
                if body.text.is_some() || body.mimeType.is_some() {
                    let body_type = body.mimeType.as_deref()
                        .map(|m| if m.contains("json") { "json" } else { "text" })
                        .unwrap_or("text")
                        .to_string();
                    item.body = Some(crate::models::item::RequestBody {
                        body_type: Some(body_type),
                        content: body.text.clone(),
                    });
                }
            }

            self.items.insert_one(&item).await.map_err(AppError::from)?;
            stats.requests_created += 1;
        }

        Ok(ImportResult {
            collection_id: col_id.to_hex(),
            collection_name: workspace_name,
            stats,
        })
    }
}
