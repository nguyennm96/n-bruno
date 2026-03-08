use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::item::generate_uid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVariable {
    pub uid: Option<String>,
    /// Variable name (was `key` in previous schema).
    pub name: String,
    pub value: String,
    pub enabled: bool,
    pub secret: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// External nanoid UID.
    pub uid: String,
    pub name: String,

    /// Workspace-level environments set this field.
    #[serde(rename = "workspaceUid", skip_serializing_if = "Option::is_none")]
    pub workspace_uid: Option<String>,
    /// Collection-level environments set this field.
    #[serde(rename = "collectionUid", skip_serializing_if = "Option::is_none")]
    pub collection_uid: Option<String>,

    pub variables: Vec<EnvVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    #[serde(default, with = "crate::serde_helpers::flexible_bson_datetime_optional")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Environment {
    pub fn new_workspace(name: String, workspace_uid: String, variables: Vec<EnvVariable>) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            name,
            workspace_uid: Some(workspace_uid),
            collection_uid: None,
            variables,
            color: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    pub fn new_collection(name: String, collection_uid: String, variables: Vec<EnvVariable>) -> Self {
        let now = Utc::now();
        Self {
            id: None,
            uid: generate_uid(),
            name,
            workspace_uid: None,
            collection_uid: Some(collection_uid),
            variables,
            color: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    /// Legacy constructor — workspace-scoped.
    pub fn new(name: String, workspace_uid: String, variables: Vec<EnvVariable>) -> Self {
        Self::new_workspace(name, workspace_uid, variables)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentResponse {
    pub uid: String,
    pub name: String,
    #[serde(rename = "workspaceUid", skip_serializing_if = "Option::is_none")]
    pub workspace_uid: Option<String>,
    #[serde(rename = "collectionUid", skip_serializing_if = "Option::is_none")]
    pub collection_uid: Option<String>,
    pub variables: Vec<EnvVariable>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::serde_helpers::flexible_bson_datetime")]
    pub updated_at: DateTime<Utc>,
}

impl From<Environment> for EnvironmentResponse {
    fn from(e: Environment) -> Self {
        Self {
            uid: e.uid,
            name: e.name,
            workspace_uid: e.workspace_uid,
            collection_uid: e.collection_uid,
            variables: e.variables,
            color: e.color,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_new_workspace_sets_correct_fields() {
        let vars = vec![EnvVariable {
            uid: None,
            name: "BASE_URL".into(),
            value: "https://api.dev".into(),
            enabled: true,
            secret: None,
        }];
        let env = Environment::new_workspace("Dev".into(), "ws-uid".into(), vars);
        assert_eq!(env.name, "Dev");
        assert_eq!(env.workspace_uid, Some("ws-uid".into()));
        assert!(env.collection_uid.is_none());
        assert_eq!(env.variables.len(), 1);
        assert_eq!(env.uid.len(), 21);
        assert!(env.id.is_none());
        assert!(env.deleted_at.is_none());
    }

    #[test]
    fn env_new_collection_sets_correct_fields() {
        let env = Environment::new_collection("Prod".into(), "col-uid".into(), vec![]);
        assert_eq!(env.name, "Prod");
        assert!(env.workspace_uid.is_none());
        assert_eq!(env.collection_uid, Some("col-uid".into()));
    }

    #[test]
    fn env_new_is_alias_for_new_workspace() {
        let env = Environment::new("Legacy".into(), "ws-uid".into(), vec![]);
        assert_eq!(env.workspace_uid, Some("ws-uid".into()));
        assert!(env.collection_uid.is_none());
    }

    #[test]
    fn env_uid_is_unique() {
        let uids: std::collections::HashSet<_> = (0..50)
            .map(|_| Environment::new("E".into(), "ws".into(), vec![]).uid)
            .collect();
        assert_eq!(uids.len(), 50);
    }

    #[test]
    fn env_variable_secret_flag() {
        let v = EnvVariable {
            uid: Some("abc".into()),
            name: "API_KEY".into(),
            value: "secret-value".into(),
            enabled: false,
            secret: Some(true),
        };
        assert_eq!(v.secret, Some(true));
        assert!(!v.enabled);
    }

    #[test]
    fn environment_response_from_excludes_deleted_at() {
        let env = Environment::new("Dev".into(), "ws".into(), vec![]);
        let resp = EnvironmentResponse::from(env.clone());
        assert_eq!(resp.uid, env.uid);
        assert_eq!(resp.name, env.name);
        assert_eq!(resp.workspace_uid, env.workspace_uid);
        assert!(resp.collection_uid.is_none());
    }
}
