use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use bson::{doc, to_bson};
use chrono::Utc;
use mongodb::{Collection, Database};
use rand::Rng;

use crate::{
    config::Config,
    errors::{AppError, AppResult},
    models::{
        collection::Collection as CollectionModel,
        public_docs::{
            DocSettings, DocVisibility, DocsStatusResponse, PublicDocResponse, PublicDocs,
            PublishDocsResponse, UpdateDocsRequest,
        },
    },
    services::workspace::WorkspaceService,
};

#[derive(Clone)]
pub struct PublicDocsService {
    collections: Collection<CollectionModel>,
    workspace_service: WorkspaceService,
    config: Config,
}

impl PublicDocsService {
    pub fn new(db: &Database, workspace_service: WorkspaceService, config: Config) -> Self {
        Self {
            collections: db.collection("collections"),
            workspace_service,
            config,
        }
    }

    // ── Slug Generation ───────────────────────────────────────────────────

    /// Sanitize collection name to create a URL-friendly slug
    fn sanitize_slug(name: &str) -> String {
        name.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
            .collect::<String>()
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }

    /// Generate random suffix for slug collision resolution
    fn generate_random_suffix() -> String {
        let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz0123456789".chars().collect();
        let mut rng = rand::thread_rng();
        (0..6).map(|_| chars[rng.gen_range(0..chars.len())]).collect()
    }

    /// Check if slug already exists
    pub async fn slug_exists(&self, slug: &str) -> AppResult<bool> {
        let count = self
            .collections
            .count_documents(doc! { "public_docs.slug": slug })
            .await
            .map_err(AppError::from)?;
        Ok(count > 0)
    }

    /// Generate unique slug for a collection
    async fn generate_unique_slug(&self, collection_name: &str) -> AppResult<String> {
        let base_slug = Self::sanitize_slug(collection_name);
        let mut slug = base_slug.clone();
        let mut attempt = 0;

        while self.slug_exists(&slug).await? {
            slug = format!("{}-{}", base_slug, Self::generate_random_suffix());
            attempt += 1;
            if attempt > 10 {
                return Err(AppError::Internal("Failed to generate unique slug after 10 attempts".into()));
            }
        }

        Ok(slug)
    }

    // ── Password Hashing ──────────────────────────────────────────────────

    pub fn hash_password(&self, password: &str) -> AppResult<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|e| AppError::Internal(format!("Password hashing failed: {e}")))
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> AppResult<bool> {
        let parsed = PasswordHash::new(hash)
            .map_err(|e| AppError::Internal(format!("Invalid password hash: {e}")))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok())
    }

    // ── Public Documentation Methods ──────────────────────────────────────

    /// Publish collection documentation
    pub async fn publish(
        &self,
        collection_uid: &str,
        visibility: DocVisibility,
        settings: DocSettings,
        custom_slug: Option<String>,
    ) -> AppResult<PublishDocsResponse> {
        // Get the collection
        let collection = self
            .collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        // Generate unique slug (use custom slug if provided and available)
        let slug = if let Some(custom) = custom_slug {
            // Validate custom slug
            let sanitized = Self::sanitize_slug(&custom);
            if self.slug_exists(&sanitized).await? {
                return Err(AppError::BadRequest(format!("Slug '{}' is already taken", sanitized)));
            }
            sanitized
        } else {
            self.generate_unique_slug(&collection.name).await?
        };

        // Create public docs
        let public_docs = PublicDocs::new(slug.clone(), visibility, settings);

        // Update collection with public_docs
        let public_docs_bson = to_bson(&public_docs).map_err(|e| AppError::Internal(format!("Failed to serialize public_docs: {e}")))?;

        self.collections
            .update_one(
                doc! { "uid": collection_uid },
                doc! { "$set": { "public_docs": public_docs_bson } },
            )
            .await
            .map_err(AppError::from)?;

        // Generate public URL
        let public_url = format!("{}/p/{}", self.config.public_docs_base_url, slug);

        Ok(PublishDocsResponse {
            slug,
            public_url,
            published_at: public_docs.published_at,
        })
    }

    /// Update documentation settings
    pub async fn update(
        &self,
        collection_uid: &str,
        update_req: UpdateDocsRequest,
    ) -> AppResult<()> {
        // Get the collection
        let collection = self
            .collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        // Check if public docs is enabled
        let mut public_docs = collection
            .public_docs
            .ok_or_else(|| AppError::BadRequest("Public documentation is not enabled for this collection".into()))?;

        // Update fields if provided
        if let Some(visibility) = update_req.visibility {
            public_docs.visibility = visibility;
        }
        if let Some(settings) = update_req.settings {
            public_docs.settings = settings;
        }

        // Save updated public_docs
        let public_docs_bson = to_bson(&public_docs).map_err(|e| AppError::Internal(format!("Failed to serialize public_docs: {e}")))?;

        self.collections
            .update_one(
                doc! { "uid": collection_uid },
                doc! { "$set": { "public_docs": public_docs_bson } },
            )
            .await
            .map_err(AppError::from)?;

        Ok(())
    }

    /// Unpublish documentation
    pub async fn unpublish(&self, collection_uid: &str) -> AppResult<()> {
        self.collections
            .update_one(
                doc! { "uid": collection_uid },
                doc! { "$unset": { "public_docs": "" } },
            )
            .await
            .map_err(AppError::from)?;

        Ok(())
    }

    /// Get documentation status (for collection owner)
    pub async fn get_status(&self, collection_uid: &str) -> AppResult<DocsStatusResponse> {
        let collection = self
            .collections
            .find_one(doc! { "uid": collection_uid, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Collection not found".into()))?;

        if let Some(public_docs) = collection.public_docs {
            let public_url = format!("{}/p/{}", self.config.public_docs_base_url, public_docs.slug);
            Ok(DocsStatusResponse {
                enabled: public_docs.enabled,
                slug: Some(public_docs.slug),
                public_url: Some(public_url),
                analytics: public_docs.analytics,
            })
        } else {
            Ok(DocsStatusResponse {
                enabled: false,
                slug: None,
                public_url: None,
                analytics: None,
            })
        }
    }

    /// Get public documentation by slug (for public access)
    pub async fn get_by_slug(&self, slug: &str) -> AppResult<PublicDocResponse> {
        let collection = self
            .collections
            .find_one(doc! { "public_docs.slug": slug, "public_docs.enabled": true, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Documentation not found".into()))?;

        // Convert collection to JSON for response first (before moving public_docs)
        let collection_json = serde_json::to_value(&collection)
            .map_err(|e| AppError::Internal(format!("Failed to serialize collection: {e}")))?;

        let public_docs = collection
            .public_docs
            .ok_or_else(|| AppError::NotFound("Documentation not found".into()))?;

        Ok(PublicDocResponse {
            collection: collection_json,
            settings: public_docs.settings,
            published_at: public_docs.published_at,
        })
    }

    /// Get collection by slug (internal helper)
    pub async fn get_collection_by_slug(&self, slug: &str) -> AppResult<CollectionModel> {
        self.collections
            .find_one(doc! { "public_docs.slug": slug, "public_docs.enabled": true, "deletedAt": { "$exists": false } })
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Documentation not found".into()))
    }

    /// Increment view count (for analytics)
    pub async fn increment_views(&self, slug: &str) -> AppResult<()> {
        self.collections
            .update_one(
                doc! { "public_docs.slug": slug },
                doc! {
                    "$inc": { "public_docs.analytics.views": 1 },
                    "$set": { "public_docs.analytics.last_viewed": Utc::now().to_rfc3339() }
                },
            )
            .await
            .map_err(AppError::from)?;

        Ok(())
    }

    /// Update custom CSS
    pub async fn update_custom_css(&self, collection_uid: &str, css: String) -> AppResult<()> {
        let css_value = if css.is_empty() {
            bson::Bson::Null
        } else {
            bson::Bson::String(css)
        };

        self.collections
            .update_one(
                doc! { "uid": collection_uid },
                doc! { "$set": { "public_docs.settings.custom_css": css_value } },
            )
            .await
            .map_err(AppError::from)?;

        Ok(())
    }

    /// Update custom logo URL
    pub async fn update_custom_logo(&self, collection_uid: &str, logo_url: String) -> AppResult<()> {
        let logo_value = if logo_url.is_empty() {
            bson::Bson::Null
        } else {
            bson::Bson::String(logo_url)
        };

        self.collections
            .update_one(
                doc! { "uid": collection_uid },
                doc! { "$set": { "public_docs.settings.custom_logo_url": logo_value } },
            )
            .await
            .map_err(AppError::from)?;

        Ok(())
    }
}
