use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariable {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,

    // Scope: Either workspace-level or collection-level (not both)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_id: Option<ObjectId>,

    pub variables: Vec<EnvVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Environment {
    /// Create workspace-level environment
    pub fn new_workspace(name: String, workspace_id: ObjectId, variables: Vec<EnvVariable>) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            name,
            workspace_id: Some(workspace_id),
            collection_id: None,
            variables,
            color: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Create collection-level environment
    pub fn new_collection(name: String, collection_id: ObjectId, variables: Vec<EnvVariable>) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            name,
            workspace_id: None,
            collection_id: Some(collection_id),
            variables,
            color: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Legacy constructor for backward compatibility (workspace-scoped)
    pub fn new(name: String, workspace_id: ObjectId, variables: Vec<EnvVariable>) -> Self {
        Self::new_workspace(name, workspace_id, variables)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collection_id: Option<String>,
    pub variables: Vec<EnvVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Environment> for EnvironmentResponse {
    fn from(e: Environment) -> Self {
        Self {
            id: e.id.unwrap_or_default().to_hex(),
            name: e.name,
            workspace_id: e.workspace_id.map(|id| id.to_hex()),
            collection_id: e.collection_id.map(|id| id.to_hex()),
            variables: e.variables,
            color: e.color,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}
