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

    // ── workspace_members ──
    create_index(db, "workspace_members", "workspace_id").await?;
    create_index(db, "workspace_members", "user_id").await?;

    // ── collections ──
    create_index(db, "collections", "workspace_id").await?;

    // ── items ──
    create_index(db, "items", "collection_id").await?;
    create_index(db, "items", "parent_item_id").await?;

    // ── environments: unique {workspace_id, name} ──
    let col = db.collection::<Document>("environments");
    let opts = IndexOptions::builder().unique(true).build();
    let idx = IndexModel::builder()
        .keys(doc! { "workspace_id": 1, "name": 1 })
        .options(opts)
        .build();
    col.create_index(idx).await?;

    // ── examples ──
    create_index(db, "examples", "item_id").await?;

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
