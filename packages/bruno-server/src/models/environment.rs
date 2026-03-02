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
    pub workspace_id: ObjectId,
    pub variables: Vec<EnvVariable>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Environment {
    pub fn new(name: String, workspace_id: ObjectId, variables: Vec<EnvVariable>) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            name,
            workspace_id,
            variables,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentResponse {
    pub id: String,
    pub name: String,
    pub workspace_id: String,
    pub variables: Vec<EnvVariable>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Environment> for EnvironmentResponse {
    fn from(e: Environment) -> Self {
        Self {
            id: e.id.unwrap_or_default().to_hex(),
            name: e.name,
            workspace_id: e.workspace_id.to_hex(),
            variables: e.variables,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}
