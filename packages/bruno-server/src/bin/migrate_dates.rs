use bson::{doc, Document};
use mongodb::{options::ClientOptions, Client};
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mongo_uri = env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let db_name = env::var("DATABASE_NAME")
        .unwrap_or_else(|_| "bruno".to_string());

    println!("=== Bruno DateTime Migration ===");
    println!("URI:      {mongo_uri}");
    println!("Database: {db_name}");
    println!("Started:  {}\n", chrono::Utc::now());

    let opts = ClientOptions::parse(&mongo_uri).await?;
    let client = Client::with_options(opts)?;
    let db = client.database(&db_name);

    // (collection_name, [field_names stored in MongoDB])
    let targets: &[(&str, &[&str])] = &[
        ("collections",       &["created_at", "updated_at", "deletedAt"]),
        ("items",             &["created_at", "updated_at", "deletedAt"]),
        ("environments",      &["created_at", "updated_at", "deletedAt"]),
        ("examples",          &["created_at", "updated_at", "deletedAt"]),
        ("workspaces",        &["created_at", "updated_at"]),
        ("workspace_members", &["created_at"]),
        ("users",             &["created_at"]),
        ("refresh_tokens",    &["expires_at"]),
        ("invites",           &["created_at", "expires_at", "accepted_at"]),
    ];

    let mut grand_total = 0u64;

    for (coll_name, fields) in targets {
        let count = migrate_collection(&db, coll_name, fields).await?;
        grand_total += count;
    }

    println!("\n=== Migration complete ===");
    println!("Total documents updated: {grand_total}");

    Ok(())
}

async fn migrate_collection(
    db: &mongodb::Database,
    coll_name: &str,
    fields: &[&str],
) -> anyhow::Result<u64> {
    let coll: mongodb::Collection<Document> = db.collection(coll_name);

    // Find documents where any date field is stored as a string
    let or_clauses: Vec<Document> = fields
        .iter()
        .map(|f| doc! { *f: { "$type": "string" } })
        .collect();

    let filter = doc! { "$or": or_clauses };
    let total = coll.count_documents(filter.clone()).await?;

    if total == 0 {
        println!("  [{coll_name}] already up-to-date, skipped.");
        return Ok(0);
    }

    println!("  [{coll_name}] migrating {total} document(s)...");

    let mut cursor = coll.find(filter).await?;
    let mut updated = 0u64;
    let mut errors = 0u64;

    use futures::TryStreamExt;
    use mongodb::bson::Bson;

    while let Some(doc) = cursor.try_next().await? {
        let mut set_fields = Document::new();

        for field in fields.iter() {
            if let Some(Bson::String(s)) = doc.get(*field) {
                match chrono::DateTime::parse_from_rfc3339(s) {
                    Ok(dt) => {
                        let bson_dt = bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc));
                        set_fields.insert(*field, bson_dt);
                    }
                    Err(e) => {
                        eprintln!(
                            "    WARN: unparseable date in {coll_name} _id={:?} field={field}: \"{s}\" ({e})",
                            doc.get("_id")
                        );
                        errors += 1;
                    }
                }
            }
        }

        if !set_fields.is_empty() {
            let id = doc.get("_id").unwrap();
            coll.update_one(
                doc! { "_id": id },
                doc! { "$set": set_fields },
            )
            .await?;
            updated += 1;
        }
    }

    println!("  [{coll_name}] done — {updated} updated, {errors} error(s).");
    Ok(updated)
}
