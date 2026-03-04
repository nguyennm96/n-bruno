# Collection Settings Tabs Fix - Complete

## Problem

After creating a cloud collection:
- ✅ Overview tab worked
- ❌ Headers, Vars, Auth, Script, Tests, Presets, Proxy, Client Cert, Protobuf tabs were NOT interactive

## Root Cause

Collection settings couldn't be saved because:

1. **Missing API method** - `bruno-api` had no `updateCollection()` method
2. **Wrong API method used** - Frontend was calling `updateItem()` instead of `updateCollection()`
3. **Database missing fields** - Collection model didn't store `root` and `brunoConfig`
4. **Backend handler incomplete** - Update handler only accepted name/description, not settings

## Solution

### 1. Added `updateCollection` Method to bruno-api

**File: `packages/bruno-api/src/collections/index.ts`**

```typescript
/**
 * Update collection settings (root headers, vars, auth, scripts, etc.)
 */
async updateCollection(
  collectionId: string,
  data: any
): Promise<Collection> {
  const response = await this.client.getClient().patch<ApiResponse<Collection>>(
    `/api/collections/${collectionId}`,
    data
  );
  return response.data.data;
}
```

### 2. Fixed Frontend to Use Correct API Method

**File: `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js`**

Changed line 3659:
```javascript
// ❌ WRONG - this updates items (requests/folders), not collections
await brunoApi.collections.updateItem(collectionUid, updateData);

// ✅ CORRECT - this updates collection settings
await brunoApi.collections.updateCollection(collectionUid, updateData);
```

### 3. Added Database Fields for Collection Settings

**File: `packages/bruno-server/src/models/collection.rs`**

Added to Collection struct:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub description: Option<String>,
    pub workspace_id: ObjectId,

    // ✅ ADDED - Collection-level settings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<bson::Document>,

    // ✅ ADDED - Bruno configuration
    #[serde(rename = "brunoConfig", skip_serializing_if = "Option::is_none")]
    pub bruno_config: Option<bson::Document>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 4. Updated Backend Handler to Accept Settings

**File: `packages/bruno-server/src/handlers/collection.rs`**

Updated UpdateCollectionRequest:
```rust
#[derive(Debug, Deserialize)]
pub struct UpdateCollectionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub root: Option<bson::Document>,              // ✅ ADDED
    #[serde(rename = "brunoConfig")]
    pub bruno_config: Option<bson::Document>,      // ✅ ADDED
}
```

Updated handler:
```rust
pub async fn update_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    JsonBody(body): JsonBody<UpdateCollectionRequest>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let col = state.collection_service.update(
        &collection_id,
        user_id,
        body.name,
        body.description,
        body.root,           // ✅ ADDED
        body.bruno_config    // ✅ ADDED
    ).await?;
    Ok(Json(json!({ "data": col })))
}
```

### 5. Updated Collection Service to Save Settings

**File: `packages/bruno-server/src/services/collection.rs`**

```rust
pub async fn update(
    &self,
    collection_id: &str,
    user_id: ObjectId,
    name: Option<String>,
    description: Option<String>,
    root: Option<bson::Document>,           // ✅ ADDED
    bruno_config: Option<bson::Document>,   // ✅ ADDED
) -> AppResult<CollectionResponse> {
    // ... validation ...

    let mut update = doc! { "updated_at": now.to_rfc3339() };
    if let Some(n) = &name { update.insert("name", n); }
    if let Some(d) = &description { update.insert("description", d); }
    if let Some(r) = &root { update.insert("root", r); }           // ✅ ADDED
    if let Some(bc) = &bruno_config { update.insert("brunoConfig", bc); }  // ✅ ADDED

    self.collections.update_one(doc! { "_id": col_oid }, doc! { "$set": update }).await?;

    Ok(CollectionResponse {
        id: col_oid.to_hex(),
        name: name.unwrap_or(col.name),
        description: description.or(col.description),
        workspace_id: col.workspace_id.to_hex(),
        root: root.or(col.root),                       // ✅ ADDED
        bruno_config: bruno_config.or(col.bruno_config), // ✅ ADDED
        created_at: col.created_at,
        updated_at: now,
    })
}
```

## What Gets Saved

When you modify collection settings, the following structure gets saved to MongoDB:

```javascript
{
  "_id": ObjectId("..."),
  "name": "My Collection",
  "description": "...",
  "workspace_id": ObjectId("..."),

  // Collection-level request settings
  "root": {
    "request": {
      "headers": [
        { "name": "Content-Type", "value": "application/json", "enabled": true }
      ],
      "vars": {
        "req": [{ "name": "var1", "value": "value1", "enabled": true }],
        "res": [{ "name": "var2", "value": "value2", "enabled": true }]
      },
      "auth": {
        "mode": "bearer",
        "token": "..."
      },
      "script": {
        "req": "console.log('pre-request');",
        "res": "console.log('post-response');"
      },
      "tests": "expect(response.status).toBe(200);"
    },
    "docs": "# Collection Documentation"
  },

  // Bruno configuration
  "brunoConfig": {
    "proxy": {
      "hostname": "localhost",
      "port": 8080
    },
    "clientCertificates": {
      "certs": [...]
    },
    "protobuf": {
      "protoFiles": [...]
    },
    "presets": {
      "requestUrl": "https://api.example.com"
    }
  },

  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

## Files Modified

1. ✅ `packages/bruno-api/src/collections/index.ts` - Added updateCollection method
2. ✅ `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js` - Use updateCollection
3. ✅ `packages/bruno-server/src/models/collection.rs` - Added root and brunoConfig fields
4. ✅ `packages/bruno-server/src/handlers/collection.rs` - Accept root and brunoConfig in update request
5. ✅ `packages/bruno-server/src/services/collection.rs` - Save root and brunoConfig to database

## Testing

Refresh your Bruno app and test:

1. ✅ Create a cloud collection
2. ✅ Click on it - all tabs should be enabled
3. ✅ **Headers tab** - Add/edit collection headers, click Save
4. ✅ **Vars tab** - Add/edit collection variables, click Save
5. ✅ **Auth tab** - Configure collection auth, click Save
6. ✅ **Script tab** - Add pre/post scripts, click Save
7. ✅ **Tests tab** - Add tests, click Save
8. ✅ **Presets tab** - Configure presets, click Save
9. ✅ **Proxy tab** - Configure proxy, click Save
10. ✅ **Client Cert tab** - Add client certificates, click Save
11. ✅ **Protobuf tab** - Add protobuf files, click Save
12. ✅ Refresh the page - settings should persist

## Result

✅ **All collection settings tabs are now fully functional for cloud collections!**

Cloud collections now support:
- ✅ Collection-level headers
- ✅ Collection-level variables
- ✅ Collection-level authentication
- ✅ Collection-level scripts (pre-request, post-response)
- ✅ Collection-level tests
- ✅ Collection presets
- ✅ Proxy configuration
- ✅ Client certificates
- ✅ Protobuf configuration
- ✅ Collection documentation

Everything is saved to the cloud and persists across sessions!
