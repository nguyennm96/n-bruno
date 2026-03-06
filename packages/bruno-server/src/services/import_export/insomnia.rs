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

        let export: InsomniaExport = serde_json::from_str(insomnia_json)
            .map_err(|e| AppError::BadRequest(format!("Invalid Insomnia JSON: {e}")))?;

        // Find top-level workspace resource for name
        let workspace_name = export.resources.iter()
            .find(|r| r.resource_type == "workspace")
            .map(|r| r.name.clone())
            .unwrap_or_else(|| "Imported from Insomnia".to_string());

        let col = CollectionModel::new(workspace_name.clone(), None, workspace_id.to_string());
        self.collections.insert_one(&col).await.map_err(AppError::from)?;

        let mut stats = ImportStats::default();

        // Build id -> uid map for parent references
        let mut id_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        id_map.insert(
            export.resources.iter()
                .find(|r| r.resource_type == "workspace")
                .map(|r| r.id.clone())
                .unwrap_or_default(),
            col.uid.clone(),
        );

        // Process folders first (request_group), then requests
        let folders: Vec<&InsomniaResource> = export.resources.iter()
            .filter(|r| r.resource_type == "request_group")
            .collect();

        for folder in &folders {
            let parent_bruno_id = folder.parent_id.as_deref()
                .and_then(|pid| id_map.get(pid)).cloned();

            let item = Item::new_folder(
                folder.name.clone(),
                col.uid.clone(),
                parent_bruno_id,
                stats.folders_created as f64,
            );
            self.items.insert_one(&item).await.map_err(AppError::from)?;
            id_map.insert(folder.id.clone(), item.uid.clone());
            stats.folders_created += 1;
        }

        // Process requests
        let requests: Vec<&InsomniaResource> = export.resources.iter()
            .filter(|r| r.resource_type == "request")
            .collect();

        for request in &requests {
            let parent_bruno_id = request.parent_id.as_deref()
                .and_then(|pid| id_map.get(pid)).cloned();

            let method = request.method.clone().unwrap_or_else(|| "GET".to_string());
            let url = request.url.clone().unwrap_or_default();

            let item = Item::new_request(
                request.name.clone(),
                col.uid.clone(),
                parent_bruno_id,
                stats.requests_created as f64,
                method,
                url,
            );

            self.items.insert_one(&item).await.map_err(AppError::from)?;
            stats.requests_created += 1;
        }

        Ok(ImportResult {
            collection_uid: col.uid.clone(),
            collection_name: workspace_name,
            stats,
        })
    }
}
