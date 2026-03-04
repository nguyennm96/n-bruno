# Bruno Server Implementation Plan - Based on cloud.js Methods

## Analyze Results

### Methods được phân loại theo từ cloud.js:

#### ✅ **ĐANG HỖ TRỢ** (7 endpoints)
```
- GET /api/workspaces/:workspace_id/collections
- POST /api/workspaces/:workspace_id/collections
- PATCH /api/collections/:id
- DELETE /api/collections/:id
- POST /api/collections/:id/folders
- GET /api/collections/:id/items
- PATCH /api/items/:id
- DELETE /api/items/:id
- POST /api/workspaces/:id/environments
- GET /api/workspaces/:id/environments
- PATCH /api/environments/:id
- DELETE /api/environments/:id
```

#### ❌ **CẦN THÊM** (35+ endpoints)

---

## Phase 1: Fix Critical Issues (Critical - 2-3 hours)

### 1.1 Frontend: Fix cloud.js Workspace Reference
**File**: `packages/bruno-app/src/utils/storage/cloud.js`

```javascript
// CHANGE FROM:
const getSelectedWorkspace = (getState) => {
  const state = getState();
  const workspaceId = state.cloudWorkspaces?.selectedWorkspaceId; // ❌ BROKEN
  ...
};

// CHANGE TO:
const getSelectedWorkspace = (getState) => {
  const state = getState();
  const workspaceId = state.auth?.user?.default_workspace_id;
  if (!workspaceId) {
    throw new Error('User workspace not initialized');
  }
  return workspaceId;
};
```

### 1.2 Backend: Add default_workspace_id to User Model
**File**: `packages/bruno-server/src/models/user.rs`

```rust
pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub default_workspace_id: String,  // ← ADD THIS
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### 1.3 Backend: Create Default Workspace on Registration
**File**: `packages/bruno-server/src/handlers/auth.rs`

```rust
pub async fn register(...) -> AppResult<...> {
    // ... existing code ...
    
    // Create default workspace for user
    let workspace = state.workspace_service
        .create(&user.id, "Default Workspace", None)
        .await?;
    
    // Update user's default_workspace_id
    state.user_service
        .update_default_workspace(&user.id, &workspace.id)
        .await?;
    
    // ... rest of code ...
}
```

### 1.4 Frontend: Implement BrunoServerApi Client
**File**: `packages/bruno-app/src/services/brunoApi.js`

```javascript
class BrunoServerApi {
  constructor(baseUrl, getAccessToken) {
    this.baseUrl = baseUrl;
    this.getAccessToken = getAccessToken;
  }

  async request(method, path, body = null) {
    const token = await this.getAccessToken();
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, options);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || `API error: ${res.status}`);
    }
    return res.json();
  }

  // Collections
  collections = {
    getCollectionsTreeByWorkspace: (workspaceId) =>
      this.request('GET', `/api/workspaces/${workspaceId}/collections`),
    createCollection: (workspaceId, data) =>
      this.request('POST', `/api/workspaces/${workspaceId}/collections`, data),
    updateCollection: (collectionId, data) =>
      this.request('PATCH', `/api/collections/${collectionId}`, data),
    deleteCollection: (collectionId) =>
      this.request('DELETE', `/api/collections/${collectionId}`),
    // TODO: Add more methods as implemented
  };
}

export const initializeBrunoCloudApi = (baseUrl, tokens) => {
  window.__BRUNO_API__ = new BrunoServerApi(baseUrl, async () => tokens.access_token);
};
```

---

## Phase 2: Core CRUD Operations (High Priority - 1-2 days)

### 2.1 Item Operations - Missing Endpoints

**Add to `packages/bruno-server/src/handlers/item.rs`**:

```rust
// Create Folder
pub async fn create_folder(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<CreateFolderRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let folder = state.item_service
        .create_folder(&collection_id, user_id, body.name, body.parent_item_id, body.sort_order)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": folder }))))
}

// Clone Item
pub async fn clone_item(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
    Json(body): Json<CloneItemRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let cloned = state.item_service
        .clone_item(&item_id, &body.collection_id, user_id, &body.new_name)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": cloned }))))
}

// Batch Update Items (Resequence)
pub async fn resequence_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<Vec<ResequenceItem>>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    for item in body {
        state.item_service
            .update_sequence(&item.uid, user_id, item.seq)
            .await?;
    }
    Ok(Json(json!({ "success": true })))
}

// Load Item Content
pub async fn get_item_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(item_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let item = state.item_service.get_content(&item_id, user_id).await?;
    Ok(Json(json!({ "data": item })))
}

// Batch Save Items
pub async fn batch_save_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<Vec<SaveItemRequest>>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let mut results = Vec::new();
    for item in body {
        let saved = state.item_service
            .save(&item.uid, user_id, item.data)
            .await?;
        results.push(saved);
    }
    Ok(Json(json!({ "success": { "items": results } })))
}
```

**Add to `packages/bruno-server/src/router.rs`**:

```rust
// Add new routes:
.route("/api/collections/:id/folders", post(item::create_folder))
.route("/api/items/:id/clone", post(item::clone_item))
.route("/api/collections/:id/items/resequence", patch(item::resequence_items))
.route("/api/items/:id/content", get(item::get_item_content))
.route("/api/items/batch-save", patch(item::batch_save_items))
.route("/api/items/:id/move", patch(item::move_item))  // Already exists
```

### 2.2 Collection Operations - Missing Endpoints

**Add to `packages/bruno-server/src/handlers/collection.rs`**:

```rust
// Clone Collection (with items)
pub async fn clone_collection(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<CloneCollectionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    let cloned = state.collection_service
        .clone_with_items(&collection_id, user_id, &body.new_name)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": cloned }))))
}

// Get Security Config
pub async fn get_security_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let config = state.collection_service
        .get_security_config(&collection_id, user_id)
        .await?;
    Ok(Json(json!({ "data": config })))
}

// Save Security Config
pub async fn update_security_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<SecurityConfig>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let updated = state.collection_service
        .update_security_config(&collection_id, user_id, body)
        .await?;
    Ok(Json(json!({ "data": updated })))
}

// Get Collection with Items (Tree)
pub async fn get_collection_tree(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let collection = state.collection_service
        .get_with_items(&collection_id, user_id)
        .await?;
    Ok(Json(json!({ "data": collection })))
}
```

**Add to `packages/bruno-server/src/router.rs`**:

```rust
.route("/api/collections/:id/clone", post(collection::clone_collection))
.route("/api/collections/:id/security-config", get(collection::get_security_config))
.route("/api/collections/:id/security-config", patch(collection::update_security_config))
.route("/api/collections/:id/tree", get(collection::get_collection_tree))
```

### 2.3 Environment Operations - Scope Fix

**Issue**: cloud.js expects collection-scoped environments, but bruno-server uses workspace-scoped.

**Solution A: Add Collection-Scoped Endpoints** (Recommended)

```rust
// In handlers/environment.rs - ADD NEW METHODS
pub async fn create_collection_environment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
    Json(body): Json<CreateEnvironmentRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    // Store environment with collection_id field
    let env = state.environment_service
        .create_for_collection(&collection_id, user_id, body.name, body.variables)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": env }))))
}

pub async fn list_collection_environments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let envs = state.environment_service
        .list_for_collection(&collection_id, user_id)
        .await?;
    Ok(Json(json!({ "data": envs })))
}
```

**Add to `packages/bruno-server/src/router.rs`**:

```rust
// Collection-scoped environments
.route("/api/collections/:id/environments", post(environment::create_collection_environment))
.route("/api/collections/:id/environments", get(environment::list_collection_environments))
```

---

## Phase 3: Advanced Features (Medium Priority - 2-3 days)

### 3.1 Import/Export Endpoints

**Add to handlers/import_export.rs**:

```rust
// Import from Bruno ZIP file
pub async fn import_bruno_zip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    body: Body,
) -> AppResult<(StatusCode, Json<Value>)> {
    let user_id = extract_user_id(&claims)?;
    // Parse multipart file, extract collection, create in workspace
    let result = state.import_export_service
        .import_bruno_zip(&workspace_id, user_id, body)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "data": result }))))
}

// Export Collection as Bruno ZIP
pub async fn export_collection_bruno_zip(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let user_id = extract_user_id(&claims)?;
    let zip_bytes = state.import_export_service
        .export_bruno_zip(&collection_id, user_id)
        .await?;
    
    Ok((
        StatusCode::OK,
        [("Content-Type", "application/zip")],
        zip_bytes,
    ))
}
```

**Add to `packages/bruno-server/src/router.rs`**:

```rust
.route("/api/workspaces/:workspace_id/import/bruno-zip", post(import_export::import_bruno_zip))
.route("/api/collections/:id/export?format=bruno-zip", get(import_export::export_collection_bruno_zip))
```

### 3.2 Workspace Collection Management

**Add to handlers/workspace.rs**:

```rust
// Get Collections in Workspace
pub async fn get_workspace_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    let collections = state.workspace_service
        .get_collections(&workspace_id, user_id)
        .await?;
    Ok(Json(json!({ "data": collections })))
}

// Remove Collection from Workspace
pub async fn remove_collection_from_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((workspace_id, collection_id)): Path<(String, String)>,
) -> AppResult<StatusCode> {
    let user_id = extract_user_id(&claims)?;
    state.workspace_service
        .remove_collection(&workspace_id, &collection_id, user_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// Reorder Collections in Workspace
pub async fn reorder_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(workspace_id): Path<String>,
    Json(body): Json<Vec<ReorderItem>>,
) -> AppResult<Json<Value>> {
    let user_id = extract_user_id(&claims)?;
    for (index, item) in body.iter().enumerate() {
        state.workspace_service
            .update_collection_order(&workspace_id, &item.collection_id, user_id, index as i32)
            .await?;
    }
    Ok(Json(json!({ "success": true })))
}
```

**Add to `packages/bruno-server/src/router.rs`**:

```rust
.route("/api/workspaces/:id/collections", get(workspace::get_workspace_collections))
.route("/api/workspaces/:workspace_id/collections/:collection_id", delete(workspace::remove_collection_from_workspace))
.route("/api/workspaces/:id/collections/reorder", patch(workspace::reorder_collections))
```

---

## Phase 4: Optional Features (Low Priority)

### 4.1 OAuth2 Support
- Implement token storage
- Add refresh token logic
- Create `/api/oauth2/*` endpoints

### 4.2 gRPC Support
- Add grpc reflection endpoints
- Implement `generateGrpcurl` handler

### 4.3 Git Integration
- Add `/api/git/clone` endpoint
- Implement file scanning

### 4.4 Dotenv Support
- Add `/api/dotenv/*` endpoints for file operations

---

## Implementation Order

```
Priority 1 (CRITICAL - Do First):
  ✓ Fix getSelectedWorkspace() in cloud.js
  ✓ Add default_workspace_id to User model
  ✓ Create default workspace on registration
  ✓ Implement BrunoServerApi client

Priority 2 (HIGH - Day 1-2):
  - Item operations: create_folder, clone_item, resequence, batch_save
  - Collection operations: clone_with_items, security_config
  - Collection-scoped environments
  - Test basic CRUD operations

Priority 3 (MEDIUM - Day 2-3):
  - Import/Export (Bruno ZIP format)
  - Workspace collection management
  - Error handling & validation

Priority 4 (LOW - Later):
  - OAuth2, gRPC, Git, Dotenv features
  - Performance optimizations
  - Advanced features
```

---

## Testing Strategy

### Unit Tests (After each phase)
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_collection() { ... }

    #[tokio::test]
    async fn test_clone_collection() { ... }

    #[tokio::test]
    async fn test_batch_save_items() { ... }
}
```

### Integration Tests (End of each phase)
```javascript
// In bruno-app test suite
describe('Cloud Storage', () => {
    it('should create collection in cloud', async () => {
        const result = await cloud.createCollection('Test', {});
        expect(result.isCloud).toBe(true);
    });

    it('should clone collection with items', async () => {
        const cloned = await cloud.cloneCollection(...);
        expect(cloned.items.length).toBe(sourceItems.length);
    });
});
```

---

## API Endpoint Summary

| Method | Endpoint | Status | Priority |
|--------|----------|--------|----------|
| POST | `/api/collections/:id/folders` | ✅ | P2 |
| POST | `/api/items/:id/clone` | ✅ | P2 |
| PATCH | `/api/collections/:id/items/resequence` | ✅ | P2 |
| GET | `/api/items/:id/content` | ✅ | P2 |
| PATCH | `/api/items/batch-save` | ✅ | P2 |
| POST | `/api/collections/:id/clone` | ✅ | P2 |
| GET | `/api/collections/:id/security-config` | ✅ | P2 |
| PATCH | `/api/collections/:id/security-config` | ✅ | P2 |
| GET | `/api/collections/:id/tree` | ✅ | P2 |
| POST | `/api/collections/:id/environments` | ✅ | P2 |
| GET | `/api/collections/:id/environments` | ✅ | P2 |
| POST | `/api/workspaces/:workspace_id/import/bruno-zip` | ✅ | P3 |
| GET | `/api/collections/:id/export?format=bruno-zip` | ✅ | P3 |
| GET | `/api/workspaces/:id/collections` | ✅ | P3 |
| DELETE | `/api/workspaces/:workspace_id/collections/:collection_id` | ✅ | P3 |
| PATCH | `/api/workspaces/:id/collections/reorder` | ✅ | P3 |

---

## Timeline Estimate

| Phase | Tasks | Effort | Timeline |
|-------|-------|--------|----------|
| 1 | Fix workspace refs, User model, default workspace, API client | 3-4h | Day 1 Morning |
| 2 | Item ops, Collection ops, Environment scope fix | 6-8h | Day 1 Afternoon - Day 2 |
| 3 | Import/Export, Workspace management, Testing | 4-6h | Day 2 Afternoon |
| 4 | Advanced features, Polish | 2-3 days | Optional |

**Total for fully functional cloud**: 4-5 days
**Minimum viable**: Phase 1-2 = 1-2 days
