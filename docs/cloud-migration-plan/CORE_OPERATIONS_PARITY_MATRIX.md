# Core Operations Parity Matrix v2

**Generated:** 2026-03-04
**Status:** Phase 2 Planning

This matrix maps all storage operations between local and cloud modes, documenting implementation status and identifying gaps.

## Legend

- ✅ **Implemented** - Operation exists and is functional
- 🚧 **Partial** - Operation exists but incomplete or limited
- ❌ **Missing** - Operation does not exist
- 🔄 **Needs Implementation** - Planned but not yet implemented
- 🌐 **Cloud Only** - Not applicable to local mode
- 💾 **Local Only** - Not applicable to cloud mode (system/filesystem-specific)

---

## 1. COLLECTION OPERATIONS

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Get collections** | ✅ `getCollections` | ✅ `GET /api/workspaces/:id/collections` | ✅ Complete | Both return collection trees |
| **Create collection** | ✅ `createCollection` | ✅ `POST /api/workspaces/:id/collections` | ✅ Complete | - |
| **Update collection** | ✅ `updateCollection` | ✅ `PATCH /api/collections/:id` | ✅ Complete | Name, description |
| **Delete collection** | ✅ `deleteCollection` | ✅ `DELETE /api/collections/:id` | ✅ Complete | - |
| **Rename collection** | ✅ `renameCollection` | ✅ `PATCH /api/collections/:id` | ✅ Complete | Same as update |
| **Clone collection** | ✅ `cloneCollection` | ✅ `POST /api/collections/:id/clone` | ✅ Complete (Backend) | Frontend integration pending |
| **Import collection** | ✅ `importCollection` | ✅ `POST /api/workspaces/:id/import/*` | ✅ Complete | Postman, Insomnia, OpenAPI |
| **Export collection** | ✅ `exportCollectionZip` | ✅ `GET /api/collections/:id/export` | ✅ Complete | Formats: Postman, OpenAPI |
| **Open collection** | ✅ `openCollection` | 🌐 N/A | 💾 Local Only | File picker dialog |
| **Remove from workspace** | ✅ `removeCollection` | 🔄 Needs Implementation | 🔄 Needs Implementation | Unlink collection from workspace |

---

## 2. ITEM OPERATIONS (Requests & Folders)

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Create folder** | ✅ `createFolder` | ✅ `POST /api/collections/:id/folders` | ✅ Complete | Supports parent_item_id |
| **Create request** | ✅ `createRequest` | ✅ `POST /api/collections/:id/requests` | ✅ Complete | Nested request structure |
| **Get item** | ✅ (implicit via collection load) | ✅ `GET /api/items/:id` | ✅ Complete | Individual item fetch |
| **List items** | ✅ `getCollections` (nested) | ✅ `GET /api/collections/:id/items` | ✅ Complete | Flat or tree format |
| **Update item** | ✅ `updateItem` | ✅ `PATCH /api/items/:id` | 🚧 Partial | Cloud supports nested request update; local has multiple IPC methods |
| **Delete item** | ✅ `deleteItem` | ✅ `DELETE /api/items/:id` | ✅ Complete | Single item delete |
| **Move item** | ✅ `moveItem` | ✅ `PATCH /api/items/:id/move` | ✅ Complete | Change parent folder |
| **Clone item** | ✅ `cloneItem` | ✅ `POST /api/items/:id/clone` | ✅ Complete (Backend) | Frontend integration pending |
| **Clone folder** | ✅ `cloneFolder` | ✅ `POST /api/items/:id/clone` | ✅ Complete (Backend) | Same endpoint, deep clone |
| **Resequence items** | ✅ `resequenceItems` | ✅ `PATCH /api/collections/:id/resequence` | ✅ Complete (Backend) | Frontend integration pending |
| **Save request** | ✅ `saveRequest` | ✅ `PATCH /api/items/:id` | ✅ Complete | Full request content |
| **Save multiple requests** | ✅ `saveMultipleRequests` | ❌ Missing | 🔄 Needs Implementation | Batch save operation |
| **Rename item** | ✅ `renameItemName` | ✅ `PATCH /api/items/:id` | ✅ Complete | Name field only |
| **Load request** | ✅ `loadRequest` | 🌐 N/A | 💾 Local Only | Read .bru file from disk |
| **Load large request** | ✅ `loadLargeRequest` | 🌐 N/A | 💾 Local Only | Stream large .bru files |

---

## 3. ENVIRONMENT OPERATIONS

### 3.1 Collection-Level Environments

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Create environment** | ✅ `createEnvironment` | ✅ `POST /api/collections/:id/environments` | ✅ Complete (Backend) | Frontend integration pending |
| **Update environment** | ✅ `saveEnvironment` | ✅ `PATCH /api/environments/:id` | ✅ Complete (Backend) | Works for both collection & workspace |
| **Delete environment** | ✅ `deleteEnvironment` | ✅ `DELETE /api/environments/:id` | ✅ Complete (Backend) | Works for both collection & workspace |
| **Rename environment** | ✅ `renameEnvironment` | ✅ `PATCH /api/environments/:id` | ✅ Complete (Backend) | Same as update |
| **Update color** | ✅ `updateEnvironmentColor` | ✅ `PATCH /api/environments/:id` | ✅ Complete (Backend) | Same as update |

### 3.2 Workspace-Level Environments

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Create workspace env** | ✅ `createWorkspaceEnvironment` | ✅ `POST /api/workspaces/:id/environments` | ✅ Complete | - |
| **Get workspace envs** | ✅ `loadWorkspaceEnvironments` | ✅ `GET /api/workspaces/:id/environments` | ✅ Complete | - |
| **Update workspace env** | ✅ `updateWorkspaceEnvironment` | ✅ `PATCH /api/environments/:id` | ✅ Complete | - |
| **Delete workspace env** | ✅ `deleteWorkspaceEnvironment` | ✅ `DELETE /api/environments/:id` | ✅ Complete | - |
| **Rename workspace env** | ✅ `renameWorkspaceEnvironment` | ✅ `PATCH /api/environments/:id` | ✅ Complete | Same as update |
| **Copy workspace env** | ✅ `copyWorkspaceEnvironment` | ❌ Missing | 🔄 Needs Implementation | Clone environment |
| **Select workspace env** | ✅ `selectWorkspaceEnvironment` | ❌ Missing | 💾 Local Only | UI state, not persisted |
| **Update color** | ✅ `updateGlobalEnvironmentColor` | ✅ `PATCH /api/environments/:id` | ✅ Complete | - |

**Decision (from Phase 0):** Support **both** collection-level and workspace-level environments.
**Status:** Workspace-level ✅ complete, collection-level ✅ **complete (backend)**, frontend integration pending.

---

## 4. CONFIG & SECURITY OPERATIONS

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Get collection root** | ✅ (part of collection load) | ✅ (part of collection) | ✅ Complete | bruno.json equivalent |
| **Save collection root** | ✅ `saveCollectionRoot` | ❌ Missing | 🔄 Needs Implementation | Update bruno.json |
| **Update bruno config** | ✅ `updateBrunoConfig` | ❌ Missing | 🔄 Needs Implementation | Collection settings |
| **Get security config** | ✅ `getCollectionSecurityConfig` | ❌ Missing | 🔄 Needs Implementation | SSL certs, proxy settings |
| **Save security config** | ✅ `saveCollectionSecurityConfig` | ❌ Missing | 🔄 Needs Implementation | - |
| **Get collection workspaces** | ✅ `getCollectionWorkspaces` | 🌐 N/A | 💾 Local Only | Local workspace links |

---

## 5. WORKSPACE OPERATIONS

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Create workspace** | ✅ `createWorkspace` | ✅ `POST /api/workspaces` | ✅ Complete | - |
| **Get workspaces** | ✅ `getLastOpenedWorkspaces` | ✅ `GET /api/workspaces` | ✅ Complete | - |
| **Get workspace** | ✅ `openWorkspace` | ✅ `GET /api/workspaces/:id` | ✅ Complete | - |
| **Update workspace** | ✅ `renameWorkspace` | ✅ `PATCH /api/workspaces/:id` | ✅ Complete | Name, description |
| **Delete workspace** | ✅ `closeWorkspace` | ✅ `DELETE /api/workspaces/:id` | ✅ Complete | - |
| **Add member** | 🌐 N/A | ✅ `POST /api/workspaces/:id/members` | 🌐 Cloud Only | Collaboration feature |
| **Remove member** | 🌐 N/A | ✅ `DELETE /api/workspaces/:id/members/:user_id` | 🌐 Cloud Only | - |
| **List members** | 🌐 N/A | ✅ `GET /api/workspaces/:id/members` | 🌐 Cloud Only | - |
| **Export workspace** | ✅ `exportWorkspace` | ✅ `GET /api/workspaces/:id/export` | ✅ Complete | All collections |
| **Import workspace** | ✅ `importWorkspace` | ❌ Missing | 🔄 Needs Implementation | Restore from zip |
| **Load workspace collections** | ✅ `loadWorkspaceCollections` | ✅ (via collections list) | ✅ Complete | - |
| **Reorder collections** | ✅ `reorderWorkspaceCollections` | ❌ Missing | 🔄 Needs Implementation | Custom collection order |

---

## 6. SYSTEM & LOCAL-ONLY OPERATIONS

These operations are **filesystem or system-specific** and not applicable to cloud mode:

| Operation | Local (IPC) | Cloud (API) | Type |
|-----------|------------|-------------|------|
| **Browse directory** | ✅ `browseDirectory` | 🌐 N/A | 💾 File picker |
| **Browse files** | ✅ `browseFiles` | 🌐 N/A | 💾 File picker |
| **Show in folder** | ✅ `showInFolder` | 🌐 N/A | 💾 OS file explorer |
| **Scan for bruno files** | ✅ `scanForBrunoFiles` | 🌐 N/A | 💾 Filesystem scan |
| **Mount collection** | ✅ `mountCollection` | 🌐 N/A | 💾 File watcher setup |
| **Save preferences** | ✅ `savePreferences` | 🌐 N/A | 💾 Local app settings |
| **Complete quit flow** | ✅ `completeQuitFlow` | 🌐 N/A | 💾 App lifecycle |
| **Cookie operations** | ✅ Multiple IPC methods | 🌐 N/A | 💾 Electron cookies |
| **System proxy** | ✅ `getSystemProxyVariables`, `refreshSystemProxy` | 🌐 N/A | 💾 OS proxy detection |
| **OAuth2 credentials** | ✅ `fetchOAuth2Credentials`, etc. | 🌐 N/A | 💾 Local OAuth flow |
| **gRPC operations** | ✅ `loadMethodsReflection`, etc. | 🌐 N/A | 💾 Local gRPC runtime |
| **Dotenv files** | ✅ Multiple dotenv methods | 🌐 N/A | 💾 Filesystem .env files |
| **Transient requests** | ✅ `saveTransientRequest`, `deleteTransientRequests` | 🌐 N/A | 💾 Temp file storage |
| **Workspace scratch** | ✅ `mountWorkspaceScratch` | 🌐 N/A | 💾 Temp collections |
| **API specs** | ✅ Multiple API spec methods | 🌐 N/A | 💾 OpenAPI file management |
| **Workspace docs** | ✅ `saveWorkspaceDocs` | 🌐 N/A | 💾 Local markdown docs |
| **Auth tokens (secure storage)** | ✅ `saveAuthTokens`, `getAuthTokens`, `clearAuthTokens` | 🌐 N/A | 💾 Keychain/secure storage |
| **Workspace links** | ✅ `saveWorkspaceLink`, `getWorkspaceLinks` | 🌐 N/A | 💾 Local workspace mappings |

---

## 7. BATCH OPERATIONS

| Operation | Local (IPC) | Cloud (API) | Status | Notes |
|-----------|------------|-------------|--------|-------|
| **Batch delete items** | ❌ Not explicit | ❌ Missing | 🔄 Needs Design | Should we support? |
| **Batch move items** | ❌ Not explicit | ❌ Missing | 🔄 Needs Design | Drag-drop multiple items |
| **Resequence items** | ✅ `resequenceItems` | ❌ Missing | 🔄 Needs Implementation | Update sort_order for multiple items |
| **Save multiple requests** | ✅ `saveMultipleRequests` | ❌ Missing | 🔄 Needs Implementation | Batch save for performance |
| **Sync items** | 🌐 N/A | 🚧 `POST /api/workspaces/:id/sync` | 🚧 Partial | Exists in TS client but not in server router |

---

## SUMMARY

### ✅ Complete Parity (39 operations) - **Updated 2026-03-04**
Collections: Get, create, update, delete, rename, import, export, **clone** ✨
Items: Create folder/request, get, list, update, delete, move, rename, **clone**, **resequence** ✨
Collection Environments: **Full CRUD** ✨ (backend complete)
Workspace Environments: Full CRUD
Workspaces: Full CRUD, members

### 🔄 Needs Implementation (9 operations)

**High Priority (Backend Complete, Frontend Pending):**
1. ✅ Clone collection - **BACKEND DONE** (frontend integration needed)
2. ✅ Clone item/folder - **BACKEND DONE** (frontend integration needed)
3. ✅ Resequence items - **BACKEND DONE** (frontend integration needed)
4. ✅ Collection-level environments - **BACKEND DONE** (frontend integration needed)

**Medium Priority:**
5. Save collection root/bruno config
6. Security config operations
7. Batch save multiple requests
8. Import workspace
9. Reorder workspace collections

### 💾 Local-Only (40+ operations)
Filesystem, system, OAuth, gRPC, cookies, preferences, temp files, etc.

### 🌐 Cloud-Only (3 operations)
Workspace members (add, remove, list)

---

## IMPLEMENTATION STATUS (2026-03-04)

### ✅ Recently Completed (Backend):
1. **Clone Collection** - POST /api/collections/:id/clone
   - Deep clones all items recursively
   - Maintains parent-child relationships with new ObjectIds
   - Supports cross-workspace cloning
   - File: `packages/bruno-server/src/services/collection.rs`

2. **Clone Item/Folder** - POST /api/items/:id/clone
   - Shallow clone for requests
   - Deep recursive clone for folders
   - Preserves tree structure
   - File: `packages/bruno-server/src/services/item.rs`

3. **Resequence Items** - PATCH /api/collections/:id/resequence
   - Atomic bulk sort_order updates
   - Validates all items before updating
   - File: `packages/bruno-server/src/services/collection.rs`

4. **Collection Environments** - POST/GET /api/collections/:id/environments
   - Collection-scoped environment CRUD
   - Update/delete use generic endpoints (PATCH/DELETE /api/environments/:id)
   - Environment model supports both workspace_id and collection_id
   - Files: `packages/bruno-server/src/services/environment.rs`, `models/environment.rs`

### 🔄 Next: Frontend Integration (Task #18)
- Update `packages/bruno-app/src/utils/storage/cloud.js`
- Add methods: cloneCollection, cloneItem, resequenceItems, collection environment CRUD
- Update Redux actions and UI components

### 📋 Remaining (Phase 3+):
- Config operations (bruno config, security config)
- Batch save requests
- Import workspace
- Reorder workspace collections

**Exit Criteria for Phase 2:** ✅ Matrix complete, backend implementation in progress, frontend integration next.
