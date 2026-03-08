use mongodb::{Client, Database, IndexModel};
use mongodb::bson::doc;
use mongodb::options::{ClientOptions, IndexOptions};
use std::time::Duration;
use bson::Document;
use crate::config::Config;

pub async fn connect(config: &Config) -> anyhow::Result<Database> {
    tracing::info!("Connecting to MongoDB at {}", config.mongodb_uri);

    let mut client_options = ClientOptions::parse(&config.mongodb_uri).await?;
    client_options.connect_timeout = Some(Duration::from_secs(10));
    client_options.server_selection_timeout = Some(Duration::from_secs(10));
    client_options.app_name = Some("bruno-server".to_string());

    let client = Client::with_options(client_options)?;
    let db = client.database(&config.mongodb_database);

    // Ping to verify connection
    db.run_command(doc! { "ping": 1 }).await?;
    tracing::info!("✅ MongoDB connected to database: {}", config.mongodb_database);

    Ok(db)
}

pub async fn create_indexes(db: &Database) -> anyhow::Result<()> {
    tracing::info!("Creating database indexes...");

    // ── users: unique email ──
    create_unique_index(db, "users", "email").await?;

    // ── refresh_tokens: TTL on expires_at + index on token_hash ──
    let col = db.collection::<Document>("refresh_tokens");
    let ttl_opts = IndexOptions::builder()
        .expire_after(Some(Duration::from_secs(0))) // TTL controlled by expires_at field
        .build();
    let ttl_index = IndexModel::builder()
        .keys(doc! { "expires_at": 1 })
        .options(ttl_opts)
        .build();
    col.create_index(ttl_index).await?;
    create_index(db, "refresh_tokens", "token_hash").await?;
    create_index(db, "refresh_tokens", "user_id").await?;

    // ── password_reset_tokens: TTL on expires_at, index on user_id ──
    {
        let col = db.collection::<Document>("password_reset_tokens");
        let ttl_opts = IndexOptions::builder()
            .expire_after(Some(Duration::from_secs(0)))
            .build();
        let ttl_index = IndexModel::builder()
            .keys(doc! { "expires_at": 1 })
            .options(ttl_opts)
            .build();
        col.create_index(ttl_index).await?;
    }
    create_index(db, "password_reset_tokens", "user_id").await?;

    // ── workspaces: unique uid ──
    create_unique_index(db, "workspaces", "uid").await?;

    // ── workspace_members ──
    create_index(db, "workspace_members", "workspace_id").await?;
    create_index(db, "workspace_members", "user_id").await?;

    // ── workspace_invites: TTL on expires_at, index on workspace_id+email, unique token_hash ──
    {
        let col = db.collection::<Document>("workspace_invites");
        let ttl_opts = IndexOptions::builder()
            .expire_after(Some(Duration::from_secs(0)))
            .build();
        let ttl_index = IndexModel::builder()
            .keys(doc! { "expires_at": 1 })
            .options(ttl_opts)
            .build();
        col.create_index(ttl_index).await?;
    }
    create_index(db, "workspace_invites", "workspace_id").await?;
    create_index(db, "workspace_invites", "email").await?;
    create_unique_index(db, "workspace_invites", "token_hash").await?;

    // ── collections: unique uid, index on workspaceUid ──
    create_unique_index(db, "collections", "uid").await?;
    create_index(db, "collections", "workspaceUid").await?;

    // ── items: unique uid, indexes on collectionUid + parentUid ──
    create_unique_index(db, "items", "uid").await?;
    create_index(db, "items", "collectionUid").await?;
    create_index(db, "items", "parentUid").await?;

    // ── environments: unique uid, indexes on workspaceUid / collectionUid ──
    create_unique_index(db, "environments", "uid").await?;
    create_index(db, "environments", "workspaceUid").await?;
    create_index(db, "environments", "collectionUid").await?;

    // ── examples: unique uid, index on requestUid ──
    create_unique_index(db, "examples", "uid").await?;
    create_index(db, "examples", "requestUid").await?;

    // ── soft-delete indexes ──
    create_index(db, "collections", "deletedAt").await?;
    create_index(db, "items", "deletedAt").await?;
    create_index(db, "environments", "deletedAt").await?;
    create_index(db, "examples", "deletedAt").await?;

    tracing::info!("✅ All indexes created");
    Ok(())
}

async fn create_unique_index(db: &Database, collection: &str, field: &str) -> anyhow::Result<()> {
    let col = db.collection::<Document>(collection);
    let opts = IndexOptions::builder().unique(true).build();
    let idx = IndexModel::builder()
        .keys(doc! { field: 1 })
        .options(opts)
        .build();
    col.create_index(idx).await?;
    Ok(())
}

async fn create_index(db: &Database, collection: &str, field: &str) -> anyhow::Result<()> {
    let col = db.collection::<Document>(collection);
    let idx = IndexModel::builder()
        .keys(doc! { field: 1 })
        .build();
    col.create_index(idx).await?;
    Ok(())
}
