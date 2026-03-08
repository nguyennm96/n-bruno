/**
 * migrate_dates.js
 *
 * Converts RFC 3339 string date fields to proper BSON ISODate objects.
 *
 * Run once after deploying the BSON DateTime fix:
 *
 *   mongosh <connection-uri> --file scripts/migrate_dates.js
 *
 * Or against a specific database:
 *
 *   mongosh "mongodb://localhost:27017/bruno" --file scripts/migrate_dates.js
 *
 * Safe to run multiple times — skips documents that already have ISODate values.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const DB_NAME = db.getName(); // uses whichever DB is selected in the connection URI

print(`\n=== Bruno DateTime Migration ===`);
print(`Database: ${DB_NAME}`);
print(`Started:  ${new Date().toISOString()}\n`);

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * For a given collection, find all documents where any of the listed fields
 * is stored as a string, convert each to ISODate, and $set it back.
 *
 * @param {string} collName   - MongoDB collection name
 * @param {string[]} fields   - field names to migrate (as stored in MongoDB)
 */
function migrateCollection(collName, fields) {
  const coll = db.getCollection(collName);

  // Build a filter: any of the fields is currently a string
  const orClauses = fields.map((f) => ({ [f]: { $type: "string" } }));
  const filter = { $or: orClauses };

  const total = coll.countDocuments(filter);
  if (total === 0) {
    print(`  [${collName}] already up-to-date, skipped.`);
    return;
  }

  print(`  [${collName}] migrating ${total} document(s)...`);

  let updated = 0;
  let errors = 0;

  coll.find(filter).forEach((doc) => {
    const setFields = {};

    fields.forEach((field) => {
      const val = doc[field];
      if (typeof val === "string") {
        const parsed = new Date(val);
        if (isNaN(parsed.getTime())) {
          print(`    WARN: unparseable date in ${collName}._id=${doc._id} field=${field}: "${val}"`);
          errors++;
        } else {
          setFields[field] = parsed;
        }
      }
    });

    if (Object.keys(setFields).length > 0) {
      coll.updateOne({ _id: doc._id }, { $set: setFields });
      updated++;
    }
  });

  print(`  [${collName}] done — ${updated} updated, ${errors} errors.\n`);
}

// ── Collections and their date fields ────────────────────────────────────────
//
// Field names match what is actually stored in MongoDB (after serde serialization).
// snake_case fields come from models without rename; camelCase from explicit #[serde(rename)].

migrateCollection("collections",       ["created_at", "updated_at", "deletedAt"]);
migrateCollection("items",             ["created_at", "updated_at", "deletedAt"]);
migrateCollection("environments",      ["created_at", "updated_at", "deletedAt"]);
migrateCollection("examples",          ["created_at", "updated_at", "deletedAt"]);
migrateCollection("workspaces",        ["created_at", "updated_at"]);
migrateCollection("workspace_members", ["created_at"]);
migrateCollection("users",             ["created_at"]);
migrateCollection("refresh_tokens",    ["expires_at"]);
migrateCollection("invites",           ["created_at", "expires_at", "accepted_at"]);

// ── Done ──────────────────────────────────────────────────────────────────────

print(`=== Migration complete: ${new Date().toISOString()} ===\n`);
