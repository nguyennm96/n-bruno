# Endpoint Mapping Specification v2

**Generated:** 2026-03-04
**Status:** Phase 2 Planning

Complete API contract documentation for all cloud storage operations.

---

## BASE URL

```
Production: https://api.usebruno.com
Development: http://localhost:8080
```

All endpoints require authentication (Bearer token) except where noted.

---

## 1. AUTHENTICATION

### 1.1 Register

```http
POST /api/auth/register
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "created_at": "2026-03-04T10:00:00Z"
    }
  }
}
```

**Errors:**
- `400 INVALID_REQUEST` - Invalid email or password format
- `409 CONFLICT` - Email already registered

---

### 1.2 Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK` (same format as register)

**Errors:**
- `401 UNAUTHORIZED` - Invalid credentials

---

### 1.3 Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json
```

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ..."
  }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid or expired refresh token

---

### 1.4 Get Current User

```http
GET /api/auth/me
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

---

### 1.5 Logout

```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

---

## 2. WORKSPACES

### 2.1 Create Workspace

```http
POST /api/workspaces
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "My Workspace",
  "description": "Team workspace for API development"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "wks_xyz789",
    "name": "My Workspace",
    "description": "Team workspace for API development",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z",
    "role": "owner"
  }
}
```

---

### 2.2 List Workspaces

```http
GET /api/workspaces
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "wks_xyz789",
      "name": "My Workspace",
      "description": "...",
      "role": "owner",
      "created_at": "2026-03-04T10:00:00Z"
    }
  ]
}
```

---

### 2.3 Get Workspace

```http
GET /api/workspaces/{id}
Authorization: Bearer {access_token}
```

**Response:** `200 OK` (same format as create)

**Errors:**
- `404 NOT_FOUND` - Workspace not found
- `403 FORBIDDEN` - No access to workspace

---

### 2.4 Update Workspace

```http
PATCH /api/workspaces/{id}
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

**Response:** `200 OK` (updated workspace object)

---

### 2.5 Delete Workspace

```http
DELETE /api/workspaces/{id}
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

**Errors:**
- `403 FORBIDDEN` - Only owner can delete
- `409 CONFLICT` - Workspace has collections (optional safety check)

---

### 2.6 Workspace Members

**List Members:**
```http
GET /api/workspaces/{id}/members
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "user_id": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "owner",
      "added_at": "2026-03-04T10:00:00Z"
    }
  ]
}
```

**Add Member:**
```http
POST /api/workspaces/{id}/members
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

**Response:** `201 Created`

**Remove Member:**
```http
DELETE /api/workspaces/{id}/members/{user_id}
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

---

## 3. COLLECTIONS

### 3.1 Create Collection

```http
POST /api/workspaces/{workspace_id}/collections
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "My API Collection",
  "description": "REST API endpoints"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "col_123abc",
    "workspace_id": "wks_xyz789",
    "name": "My API Collection",
    "description": "REST API endpoints",
    "bruno_config": {},
    "root": {},
    "environments": [],
    "items": [],
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
}
```

---

### 3.2 List Collections

```http
GET /api/workspaces/{workspace_id}/collections
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "col_123abc",
      "workspace_id": "wks_xyz789",
      "name": "My API Collection",
      "description": "...",
      "items": [...],
      "environments": [...],
      "created_at": "2026-03-04T10:00:00Z"
    }
  ]
}
```

**Note:** Returns full collection tree with nested items.

---

### 3.3 Get Collection

```http
GET /api/collections/{id}
Authorization: Bearer {access_token}
```

**Response:** `200 OK` (same format as create, includes full tree)

---

### 3.4 Update Collection

```http
PATCH /api/collections/{id}
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Updated Collection Name",
  "description": "Updated description"
}
```

**Response:** `200 OK` (updated collection)

---

### 3.5 Delete Collection

```http
DELETE /api/collections/{id}
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

**Note:** Cascades to delete all items and environments in collection.

---

### 3.6 ✅ Clone Collection (Implemented 2026-03-04)

```http
POST /api/collections/{id}/clone
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Cloned Collection Name",
  "workspace_id": "wks_xyz789"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "col_new123",
    "name": "Cloned Collection Name",
    "description": "...",
    "workspace_id": "wks_xyz789",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
}
```

**Behavior:**
- Deep clone: all folders, requests recursively
- New UUIDs for all cloned entities (collection + items)
- Preserve tree structure (parent-child relationships)
- Preserve ordering (sort_order maintained)
- Atomic operation: all items cloned or none
- Cross-workspace cloning supported

**Implementation:**
- File: `packages/bruno-server/src/services/collection.rs`
- Method: `clone_collection()`
- ID mapping: HashMap<old_id, new_id> for parent references

---

### 3.7 🔄 Update Collection Config (Needs Implementation)

```http
PATCH /api/collections/{id}/config
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "bruno_config": {
    "version": "1",
    "type": "collection",
    "format": "bru",
    "name": "My API"
  },
  "root": {
    "auth": {
      "mode": "bearer",
      "bearer": {
        "token": "{{token}}"
      }
    },
    "headers": [],
    "vars": {}
  }
}
```

**Response:** `200 OK` (updated collection)

---

### 3.8 🔄 Get Security Config (Needs Implementation)

```http
GET /api/collections/{id}/security
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": {
    "ssl": {
      "enabled": true,
      "certificate": "-----BEGIN CERTIFICATE-----\n...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n..."
    },
    "proxy": {
      "enabled": true,
      "protocol": "http",
      "hostname": "proxy.example.com",
      "port": 8080,
      "auth": {
        "enabled": true,
        "username": "proxyuser"
      }
    },
    "client_certificates": []
  }
}
```

---

### 3.9 🔄 Save Security Config (Needs Implementation)

```http
PUT /api/collections/{id}/security
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:** (same format as GET response)

**Response:** `200 OK`

---

## 4. ITEMS (Folders & Requests)

### 4.1 Create Folder

```http
POST /api/collections/{collection_id}/folders
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Authentication",
  "parent_item_id": null,
  "sort_order": 1
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "itm_folder123",
    "collection_id": "col_123abc",
    "type": "folder",
    "item_type": "folder",
    "name": "Authentication",
    "parent_item_id": null,
    "sort_order": 1,
    "items": [],
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
}
```

---

### 4.2 Create Request

```http
POST /api/collections/{collection_id}/requests
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request (Nested Structure - Preferred):**
```json
{
  "name": "Login",
  "parent_item_id": "itm_folder123",
  "sort_order": 1,
  "request": {
    "method": "POST",
    "url": "https://api.example.com/auth/login",
    "headers": [
      { "name": "Content-Type", "value": "application/json", "enabled": true }
    ],
    "params": [],
    "auth": {
      "mode": "none"
    },
    "body": {
      "mode": "json",
      "json": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password\"\n}"
    },
    "script": {
      "req": null,
      "res": "bru.setVar(\"token\", res.body.token);"
    },
    "vars": {
      "req": [],
      "res": []
    },
    "assertions": [],
    "tests": null,
    "docs": null
  },
  "settings": {
    "encodeUrl": true,
    "followRedirects": true,
    "maxRedirects": 5,
    "timeout": null
  },
  "filename": "login.bru"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "itm_req456",
    "collection_id": "col_123abc",
    "type": "request",
    "item_type": "request",
    "name": "Login",
    "parent_item_id": "itm_folder123",
    "sort_order": 1,
    "request": { ... },
    "settings": { ... },
    "filename": "login.bru",
    "created_at": "2026-03-04T10:00:00Z",
    "updated_at": "2026-03-04T10:00:00Z"
  }
}
```

---

### 4.3 List Items

```http
GET /api/collections/{collection_id}/items
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "itm_folder123",
      "type": "folder",
      "name": "Authentication",
      "items": [
        {
          "id": "itm_req456",
          "type": "request",
          "name": "Login",
          "request": { ... }
        }
      ]
    }
  ]
}
```

**Note:** Returns nested tree structure.

---

### 4.4 Get Item

```http
GET /api/items/{id}
Authorization: Bearer {access_token}
```

**Response:** `200 OK` (single item object)

---

### 4.5 Update Item

```http
PATCH /api/items/{id}
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request (Partial Update):**
```json
{
  "name": "Updated Request Name",
  "request": {
    "url": "https://api.example.com/v2/auth/login"
  }
}
```

**Response:** `200 OK` (updated item)

**Note:** Supports partial updates - only provided fields are updated.

---

### 4.6 Delete Item

```http
DELETE /api/items/{id}
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

**Note:** Deleting a folder cascades to all child items.

---

### 4.7 Move Item

```http
PATCH /api/items/{id}/move
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "parent_item_id": "itm_folder789",
  "sort_order": 3
}
```

**Response:** `200 OK` (moved item)

**Behavior:**
- `parent_item_id: null` - Move to collection root
- Updates tree structure immediately
- Other items' sort_order not affected (fractional indexing recommended)

---

### 4.8 ✅ Clone Item (Implemented 2026-03-04)

```http
POST /api/items/{id}/clone
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Login (Copy)",
  "parent_item_id": "itm_folder123"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "itm_new456",
    "type": "request",
    "name": "Login (Copy)",
    "collection_id": "col_123abc",
    "parent_item_id": "itm_folder123",
    "sort_order": 2.0,
    "request": { ... },
    "settings": { ... },
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

**Behavior:**
- **Requests:** Shallow clone (copy all fields, new UUID)
- **Folders:** Deep clone (all children cloned recursively with new UUIDs)
- Preserves parent-child relationships within cloned subtree
- Atomic operation for folders (all children cloned or none)
- sort_order = source.sort_order + 1.0 (placed after source)

**Implementation:**
- File: `packages/bruno-server/src/services/item.rs`
- Methods: `clone_item()`, `clone_request()`, `clone_folder_recursive()`, `clone_children()`

---

### 4.9 ✅ Resequence Items (Implemented 2026-03-04)

```http
PATCH /api/collections/{collection_id}/resequence
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "items": [
    { "id": "itm_req456", "sort_order": 1.0 },
    { "id": "itm_req789", "sort_order": 2.0 },
    { "id": "itm_folder123", "sort_order": 3.0 }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "updated": 3,
    "failed": 0
  }
}
```

**Behavior:**
- **Atomic:** Validates all items exist before updating (all or nothing)
- Updates only provided items' sort_order
- Other items' order unchanged
- All items must belong to specified collection
- Supports fractional sort_order values (1.5, 2.5, etc.)
- Updates timestamp for modified items

**Validation:**
- All item IDs must be valid ObjectIds
- All items must exist in the collection
- Returns 400 if any item not found
- Returns 403 if user lacks write permissions

**Implementation:**
- File: `packages/bruno-server/src/services/collection.rs`
- Method: `resequence_items()`
- Transaction: Sequential updates (validates first, then updates)

---

### 4.10 🔄 Batch Save Requests (Needs Implementation)

```http
POST /api/collections/{collection_id}/batch-save
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "items": [
    {
      "id": "itm_req456",
      "request": { ... }
    },
    {
      "id": "itm_req789",
      "request": { ... }
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "success": 2,
    "failed": 0,
    "errors": []
  }
}
```

**Partial Failure Behavior:**
- Non-atomic: save what succeeds
- Return errors for failed items
- UI shows partial success state

---

## 5. ENVIRONMENTS

### 5.1 Workspace-Level Environments

**Create:**
```http
POST /api/workspaces/{workspace_id}/environments
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Production",
  "variables": [
    { "name": "BASE_URL", "value": "https://api.prod.com", "enabled": true },
    { "name": "API_KEY", "value": "secret", "enabled": true, "secret": true }
  ],
  "color": "#FF5733"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "env_abc123",
    "workspace_id": "wks_xyz789",
    "name": "Production",
    "variables": [...],
    "color": "#FF5733",
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

**List:**
```http
GET /api/workspaces/{workspace_id}/environments
```

**Update:**
```http
PATCH /api/environments/{id}
Content-Type: application/json
```

**Delete:**
```http
DELETE /api/environments/{id}
```

---

### 5.2 ✅ Collection-Level Environments (Implemented 2026-03-04)

**Create Collection Environment:**
```http
POST /api/collections/{collection_id}/environments
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Production",
  "variables": [
    { "key": "BASE_URL", "value": "https://api.prod.com", "enabled": true }
  ]
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "env_abc123",
    "name": "Production",
    "collection_id": "col_123abc",
    "variables": [...],
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

**List Collection Environments:**
```http
GET /api/collections/{collection_id}/environments
Authorization: Bearer {access_token}
```

**Response:** `200 OK` (array of environments)

**Update Environment (works for both scopes):**
```http
PATCH /api/environments/{id}
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Delete Environment (works for both scopes):**
```http
DELETE /api/environments/{id}
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

**Implementation:**
- Files: `packages/bruno-server/src/services/environment.rs`, `models/environment.rs`
- Methods: `create_for_collection()`, `list_for_collection()`
- Environment model supports both `workspace_id` and `collection_id` (one is None)
- Update/delete methods check scope automatically

**Scope Decision (Phase 0):** ✅ **COMPLETE** - Support **both** workspace and collection-level environments.

---

## 6. IMPORT / EXPORT

### 6.1 Import Collection

**Postman:**
```http
POST /api/workspaces/{workspace_id}/import/postman
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request:**
```json
{
  "collection": { ... postman collection JSON ... }
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "collection_id": "col_123abc",
    "items_created": 25,
    "environments_created": 3
  }
}
```

**Insomnia:**
```http
POST /api/workspaces/{workspace_id}/import/insomnia
```

(Same format)

---

### 6.2 Export Collection

```http
GET /api/collections/{id}/export?format=postman
Authorization: Bearer {access_token}
```

**Query Params:**
- `format`: `postman`, `openapi`, `swagger`

**Response:** `200 OK`
```json
{
  "data": {
    ... exported collection in requested format ...
  }
}
```

---

### 6.3 Export Workspace

```http
GET /api/workspaces/{workspace_id}/export
Authorization: Bearer {access_token}
```

**Response:** `200 OK` (all collections as Postman format)

---

## 7. ERROR RESPONSES

All errors follow standard format (from Phase 0):

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Collection not found",
    "details": {
      "collection_id": "col_123abc"
    },
    "retryable": false,
    "statusCode": 404
  }
}
```

### Standard Error Codes

| HTTP Status | Error Code | Retryable | Description |
|------------|-----------|-----------|-------------|
| 400 | INVALID_REQUEST | No | Invalid request body or parameters |
| 401 | UNAUTHORIZED | No | Invalid or missing auth token |
| 403 | FORBIDDEN | No | No permission to access resource |
| 404 | NOT_FOUND | No | Resource does not exist |
| 409 | CONFLICT | No | Resource conflict (duplicate, constraint) |
| 429 | RATE_LIMITED | Yes | Too many requests |
| 500 | INTERNAL_ERROR | Yes | Server error |
| 503 | SERVICE_UNAVAILABLE | Yes | Service temporarily unavailable |

**Retry Policy (Phase 1):**
- Retryable errors (429, 500, 503): 3 retries with exponential backoff (1s, 2s, 4s)
- Non-retryable errors: Fail immediately

---

## 8. PAGINATION & FILTERING

### Pagination (Future)

For large collections/workspaces:

```http
GET /api/workspaces/{id}/collections?page=1&limit=50
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "has_next": true
  }
}
```

**Status:** Not yet implemented, add when needed.

---

## SUMMARY (Updated 2026-03-04)

### ✅ Implemented Endpoints: 42

- Auth: 5 endpoints
- Workspaces: 8 endpoints (CRUD + members)
- Collections: 7 endpoints (CRUD + **clone** + **resequence**) ✨
- Items: 8 endpoints (CRUD + move + **clone**) ✨
- Environments: 6 endpoints (workspace-level + **collection-level**) ✨
- Import/Export: 6 endpoints
- Examples: 4 endpoints

### 🔄 Backend Complete, Frontend Pending: 4

- ✅ Clone collection - `POST /api/collections/:id/clone`
- ✅ Clone item - `POST /api/items/:id/clone`
- ✅ Resequence items - `PATCH /api/collections/:id/resequence`
- ✅ Collection environments - `POST/GET /api/collections/:id/environments`

### 🔄 Still Needs Implementation: 4

- Batch save requests
- Collection config (bruno config, root)
- Security config (SSL, proxy, client certs)
- Import workspace

### Next: Frontend Integration (Task #18)

Update `cloud.js` to call new endpoints and integrate with UI.
