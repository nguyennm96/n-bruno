# Phase 0 — Scope & Contracts

## Goal

Chốt phạm vi migration và contract chuẩn giữa app và server để các phase sau triển khai không bị đổi hướng.

---

## 1. Complete Operation Inventory

**Source**: `packages/bruno-app/src/utils/storage/index.js` (StorageManager) — Single source of truth

Tổng **85 async methods** được phân loại:

### 1.1 Collections (13 ops)
- `getCollections()` - Get all collections
- `createCollection(name, options)` - Create new collection
- `updateCollection(uid, data)` - Update metadata
- `deleteCollection(uid)` - Delete
- `removeCollection(pathname, uid, workspaceId)` - Remove from workspace
- `renameCollection(uid, newName)` - Rename
- `cloneCollection(name, folderName, location, prevPath, uid)` - Full clone
- `importCollection(collection, location, options)` - Import from file/zip
- `openCollection(options)` - Load into memory
- `importCollectionZip(zipPath, location)` - Zip-specific import
- `getCollectionSecurityConfig(pathOrUid)` - Get security rules
- `saveCollectionSecurityConfig(path, config)` - Save security rules
- `openMultipleCollections(paths, options)` - Load multiple at once

### 1.2 Items (Requests/Folders) (13 ops)
- `createFolder(collectionUid, name, parentId)` - Create folder
- `createRequest(collectionUid, data)` - Create request
- `updateRequest(uid, data)` - Update request metadata
- `saveRequest(pathOrUid, data, format)` - Save request body+meta
- `updateItem(uid, collectionUid, data)` - Generic item update
- `deleteItem(uid, collectionUid)` - Delete request/folder
- `cloneItem(uid, collectionUid, newName)` - Clone request
- `moveItem(params)` - Move between folders
- `renameItemName(pathOrUid, newName, collPath)` - Rename display name
- `renameItemFilename(oldPath, newPath, name, filename, collPath)` - Rename filename
- `newRequest(pathOrParentId, data, format)` - Create & save new request
- `cloneFolder(item, collPath, collPathOrUid)` - Clone folder + contents
- `resequenceItems(items, collPathOrUid)` - Reorder items

### 1.3 Environments (10 ops)
- `createEnvironment(collectionUid, data)` - Create env (new API)
- `updateEnvironment(uid, data)` - Update env
- `deleteEnvironment(uid, collectionUid)` - Delete env
- `renameEnvironment(collPath, oldName, newName)` - Rename
- `saveEnvironment(collPath, data)` - Save env variables
- `updateEnvironmentColor(collPath, envName, color)` - Update color
- `createEnvironment(pathname, name, vars, color)` - Create env (legacy API)
- `deleteEnvironment(pathname, name)` - Delete env (legacy)
- `loadWorkspaceEnvironments(workspacePath)` - Load workspace-level envs
- `createWorkspaceEnvironment(workspacePath, name)` - Create workspace env

### 1.4 Items Data (5 ops)
- `loadRequestViaWorker({collectionUid, pathname})` - Load with worker
- `loadRequest({collectionUid, pathname})` - Load request
- `loadLargeRequest({collectionUid, pathname})` - Load large request
- `saveMultipleRequests(items)` - Batch save
- `runCollectionFolder(collectionUid, folderUid, items, options)` - Run folder tests

### 1.5 Request/Item Metadata (3 ops)
- `saveFolderRoot(data)` - Save folder metadata
- `saveCollectionRoot(collPath, data, brunoConfig)` - Save collection metadata
- `updateBrunoConfig(config, collPath, collRoot)` - Update bruno config

### 1.6 Collection Configuration (3 ops)
- `updateBrunoConfigStorage(config, pathname, collRoot)` - Storage-layer config update
- `saveCollectionSecurityConfig(pathname, config)` - Security config
- `getCollectionSecurityConfig(pathOrUid)` - Get security config

### 1.7 Workspaces (11 ops)
- `createWorkspace(name, path)` - Create workspace
- `openWorkspace(path)` - Open workspace
- `openWorkspaceDialog()` - Browse to open
- `closeWorkspace(path)` - Close workspace
- `removeCollectionFromWorkspace(uid, path, collPath, opts)` - Remove collection
- `renameWorkspace(...args)` - Rename workspace
- `loadWorkspaceCollections(path)` - Load collections in workspace
- `loadWorkspaceApiSpecs(path)` - Load API specs
- `reorderWorkspaceCollections(path, collPaths)` - Reorder collections
- `addCollectionToWorkspace(pathOrUid, workspaceCollection)` - Add to workspace
- `getCollectionWorkspaces(pathOrUid)` - Get workspaces containing collection

### 1.8 Workspace Environments (4 ops)
- `loadWorkspaceEnvironments(path)` - Load all workspace envs
- `createWorkspaceEnvironment(path, name)` - Create workspace env
- `deleteWorkspaceEnvironment(path, uid)` - Delete workspace env
- `selectWorkspaceEnvironment(path, uid)` - Set active workspace env

### 1.9 Global Operations (12 ops)
- `saveWorkspaceDocs(path, docs)` - Save workspace docs
- `openApiSpecFile(path, workspacePath)` - Open API spec file
- `getGlobalEnvironments(path)` - Load global environments
- `getLastOpenedWorkspaces()` - Get recent workspaces
- `startWorkspaceWatcher(path)` - Watch for file changes
- `getCollectionWorkspaces(pathOrUid)` - Get workspaces with collection
- `setCollectionWorkspace(uid, pathname)` - Set workspace for collection
- `loadWorkspaceCollections(path)` - Load collections from workspace
- `scanForBrunoFiles(dir)` - Scan directory for collections
- `mountCollection(data)` - Mount collection from URL/git
- `clearUserCollections(userId)` - Clear all user collections
- `deleteTransientRequests(paths, tempDir)` - Clean temp requests

### 1.10 OAuth2 (4 ops)
- `fetchOAuth2Credentials(data)` - Fetch OAuth2 token
- `refreshOAuth2Credentials(data)` - Refresh token
- `isOAuth2AuthorizationInProgress()` - Check auth state
- `cancelOAuth2Authorization()` - Cancel auth flow

### 1.11 Dotenv (4 ops)
- `saveDotenvVariables(path, vars, filename)` - Save .env variables
- `saveDotenvRaw(path, content, filename)` - Save raw .env file
- `createDotenvFile(path, filename)` - Create .env file
- `deleteDotenvFile(path, filename)` - Delete .env file

### 1.12 Git Operations (1 op)
- `cloneGitRepository(data)` - Clone repo with collections (⚠️ LOCAL ONLY - not supported in cloud)

### 1.13 Cookies (6 ops)
- `deleteCookiesForDomain(domain)` - Delete all domain cookies
- `deleteCookie(domain, path, key)` - Delete single cookie
- `addCookie(domain, cookie)` - Add cookie
- `modifyCookie(domain, oldCookie, cookie)` - Modify cookie
- `getParsedCookie(str)` - Parse cookie string
- `createCookieString(obj)` - Create cookie string

### 1.14 Preferences & UI State (3 ops)
- `savePreferences(prefs)` - Save user preferences
- `updateUiStateSnapshot(data)` - Save UI state
- `completeQuitFlow()` - Graceful shutdown

### 1.15 System & Network (4 ops)
- `getSystemProxyVariables()` - Get system proxy
- `refreshSystemProxy()` - Refresh proxy settings
- `browseDirectory()` - File browser dialog
- `browseFiles(filters, props)` - File picker dialog
- `showInFolder(path)` - Open folder in explorer

### 1.16 Auth & Tokens (3 ops)
- `saveAuthTokens(tokens)` - Save JWT tokens locally
- `getAuthTokens()` - Retrieve saved tokens
- `clearAuthTokens()` - Clear all tokens

### 1.17 Workspace Links (3 ops)
- `saveWorkspaceLink(data)` - Save workspace link
- `removeWorkspaceLink(data)` - Remove workspace link
- `getWorkspaceLinks()` - List workspace links

### 1.18 Workspace Environments (2 ops)
- `importWorkspaceEnvironment(path, data)` - Import workspace env
- `updateWorkspaceEnvironment(path, uid, data)` - Update workspace env

---

## 2. Capability Matrix

| Category | Operation | Local Impl | Cloud Impl | Endpoint | Status | Notes |
|----------|-----------|-----------|----------|----------|--------|-------|
| **Collections** | getCollections | ✅ FS | ❌ | `/api/workspaces/{id}/collections` | Not started | Core feature |
| | createCollection | ✅ FS | ❌ | `POST /api/collections` | Not started | |
| | updateCollection | ✅ FS | ❌ | `PATCH /api/collections/{id}` | Not started | |
| | deleteCollection | ✅ FS | ❌ | `DELETE /api/collections/{id}` | Not started | |
| | removeCollection | ✅ FS | ❌ | `DELETE /api/workspaces/{id}/collections/{cid}` | Not started | Workspace-scoped |
| | renameCollection | ✅ FS | ❌ | `PATCH /api/collections/{id}/rename` | Not started | |
| | cloneCollection | ✅ FS | ❌ | `POST /api/collections/{id}/clone` | Not started | ⚠️ Requires deep copy |
| | importCollection | ✅ FS | ❌ | `POST /api/collections/import` | Not started | |
| | openCollection | ✅ IPC | ❌ | N/A (local only) | Local only | File browser |
| | importCollectionZip | ✅ IPC | ❌ | `POST /api/collections/import-zip` | Not started | |
| | getCollectionSecurityConfig | ✅ FS | ❌ | `GET /api/collections/{id}/security` | Not started | Advanced |
| | saveCollectionSecurityConfig | ✅ FS | ❌ | `PATCH /api/collections/{id}/security` | Not started | Advanced |
| | openMultipleCollections | ✅ IPC | ❌ | N/A | Local only | File browser |
| **Items** | createFolder | ✅ FS | ❌ | `POST /api/folders` | Not started | |
| | createRequest | ✅ FS | ❌ | `POST /api/items/request` | Not started | |
| | updateRequest | ✅ FS | ❌ | `PATCH /api/items/{id}` | Not started | Metadata only |
| | saveRequest | ✅ FS | ❌ | `POST /api/items/{id}/save` | Not started | Body + metadata |
| | updateItem | ✅ FS | ❌ | `PATCH /api/items/{id}` | Not started | Generic |
| | deleteItem | ✅ FS | ❌ | `DELETE /api/items/{id}` | Not started | |
| | cloneItem | ✅ FS | ❌ | `POST /api/items/{id}/clone` | Not started | ⚠️ Missing endpoint |
| | moveItem | ✅ FS | ❌ | `PATCH /api/items/{id}/move` | Partial | |
| | renameItemName | ✅ FS | ❌ | `PATCH /api/items/{id}/name` | Not started | |
| | renameItemFilename | ✅ FS | ❌ | `PATCH /api/items/{id}/filename` | Not started | |
| | newRequest | ✅ FS | ❌ | `POST /api/items/request` | Not started | Create + save |
| | cloneFolder | ✅ FS | ❌ | `POST /api/folders/{id}/clone` | Not started | ⚠️ Missing endpoint |
| | resequenceItems | ✅ FS | ❌ | `PATCH /api/items/resequence` | Not started | ⚠️ Missing endpoint |
| **Environments** | createEnvironment (new) | ✅ FS | ❌ | `POST /api/environments` | Not started | Collection-scoped |
| | updateEnvironment | ✅ FS | ❌ | `PATCH /api/environments/{id}` | Not started | |
| | deleteEnvironment (new) | ✅ FS | ❌ | `DELETE /api/environments/{id}` | Not started | |
| | renameEnvironment | ✅ FS | ❌ | `PATCH /api/environments/{id}/rename` | Not started | |
| | saveEnvironment | ✅ FS | ❌ | `POST /api/environments/{id}/save` | Not started | |
| | updateEnvironmentColor | ✅ FS | ❌ | `PATCH /api/environments/{id}/color` | Not started | |
| | createEnvironment (legacy) | ✅ FS | ❌ | N/A | Deprecated | |
| | deleteEnvironment (legacy) | ✅ FS | ❌ | N/A | Deprecated | |
| | loadWorkspaceEnvironments | ✅ FS | ❌ | `GET /api/workspaces/{id}/environments` | Not started | Workspace-level |
| | createWorkspaceEnvironment | ✅ FS | ❌ | `POST /api/workspaces/{id}/environments` | Not started | Workspace-level |
| **Request Data** | loadRequestViaWorker | ✅ IPC | ❌ | N/A | Local only | Worker-based loading |
| | loadRequest | ✅ IPC | ❌ | `GET /api/items/{id}/content` | Not started | Full request body |
| | loadLargeRequest | ✅ IPC | ❌ | `GET /api/items/{id}/content` | Not started | Streaming variant |
| | saveMultipleRequests | ✅ FS | ❌ | `POST /api/items/batch-save` | Not started | Batch operation |
| | runCollectionFolder | ✅ IPC | ❌ | `POST /api/folders/{id}/run` | Not started | Test runner integration |
| **Metadata** | saveFolderRoot | ✅ FS | ❌ | `PATCH /api/folders/{id}/meta` | Not started | Folder metadata |
| | saveCollectionRoot | ✅ FS | ❌ | `PATCH /api/collections/{id}/meta` | Not started | Collection metadata |
| | updateBrunoConfig | ✅ FS | ❌ | `PATCH /api/collections/{id}/bruno.json` | Not started | |
| **Workspaces** | createWorkspace | ✅ IPC | ❌ | `POST /api/workspaces` | Not started | ⚠️ Scope mismatch |
| | openWorkspace | ✅ IPC | ❌ | N/A | Local only | File browser |
| | openWorkspaceDialog | ✅ IPC | ❌ | N/A | Local only | File dialog |
| | closeWorkspace | ✅ IPC | ✅ (stub) | N/A | Not started | |
| | removeCollectionFromWorkspace | ✅ IPC | ❌ | `DELETE /api/workspaces/{id}/collections/{cid}` | Fixed | Bug: param mismatch |
| | renameWorkspace | ✅ IPC | ❌ | `PATCH /api/workspaces/{id}` | Not started | |
| | loadWorkspaceCollections | ✅ IPC | ❌ | `GET /api/workspaces/{id}/collections` | Not started | |
| | loadWorkspaceApiSpecs | ✅ IPC | ❌ | `GET /api/workspaces/{id}/api-specs` | Not started | |
| | reorderWorkspaceCollections | ✅ IPC | ❌ | `PATCH /api/workspaces/{id}/collections/reorder` | Not started | ⚠️ Missing endpoint |
| | addCollectionToWorkspace | ✅ IPC | ❌ | `POST /api/workspaces/{id}/collections` | Not started | |
| | getCollectionWorkspaces | ✅ IPC | ❌ | `GET /api/collections/{id}/workspaces` | Not started | |
| **OAuth2** | fetchOAuth2Credentials | ✅ IPC | ❌ | `POST /api/oauth2/token` | Not started | Advanced, Phase 4 |
| | refreshOAuth2Credentials | ✅ IPC | ❌ | `POST /api/oauth2/refresh` | Not started | Advanced, Phase 4 |
| | isOAuth2AuthorizationInProgress | ✅ IPC | ❌ | N/A | Not started | Advanced |
| | cancelOAuth2Authorization | ✅ IPC | ❌ | N/A | Not started | Advanced |
| **Dotenv** | saveDotenvVariables | ✅ IPC | ❌ | `POST /api/dotenv/variables` | Not started | Advanced, Phase 4 |
| | saveDotenvRaw | ✅ IPC | ❌ | `POST /api/dotenv/raw` | Not started | Advanced, Phase 4 |
| | createDotenvFile | ✅ IPC | ❌ | `POST /api/dotenv` | Not started | Advanced, Phase 4 |
| | deleteDotenvFile | ✅ IPC | ❌ | `DELETE /api/dotenv/{id}` | Not started | Advanced, Phase 4 |
| **Git** | cloneGitRepository | ✅ IPC | ❌ N/A | N/A | Local only | Git not supported in cloud mode |
| **Cookies** | deleteCookiesForDomain | ✅ IPC | ❌ | `DELETE /api/cookies/domain/{domain}` | Not started | |
| | deleteCookie | ✅ IPC | ❌ | `DELETE /api/cookies` | Not started | |
| | addCookie | ✅ IPC | ❌ | `POST /api/cookies` | Not started | |
| | modifyCookie | ✅ IPC | ❌ | `PATCH /api/cookies` | Not started | |
| | getParsedCookie | ✅ IPC | ❌ | `POST /api/cookies/parse` | Not started | Utility |
| | createCookieString | ✅ IPC | ❌ | `POST /api/cookies/stringify` | Not started | Utility |
| **Preferences** | savePreferences | ✅ IPC | ❌ | `PATCH /api/users/preferences` | Not started | |
| | updateUiStateSnapshot | ✅ IPC | ❌ | `POST /api/users/ui-state` | Not started | |
| | completeQuitFlow | ✅ IPC | ❌ | N/A | Local only | Shutdown |
| **System** | getSystemProxyVariables | ✅ IPC | ❌ | N/A | Local only | System-specific |
| | refreshSystemProxy | ✅ IPC | ❌ | N/A | Local only | System-specific |
| | browseDirectory | ✅ IPC | ❌ | N/A | Local only | File dialog |
| | browseFiles | ✅ IPC | ❌ | N/A | Local only | File dialog |
| | showInFolder | ✅ IPC | ❌ | N/A | Local only | OS integration |
| **Transient** | deleteTransientRequests | ✅ IPC | ❌ | N/A | Local only | Temp cleanup |
| | clearUserCollections | ✅ IPC | ❌ | `POST /api/users/clear-collections` | Not started | User cleanup |
| | scanForBrunoFiles | ✅ IPC | ❌ | N/A | Local only | Directory scan |
| | mountCollection | ✅ IPC | ❌ | `POST /api/collections/mount` | Not started | Advanced mount |
| **Links** | saveWorkspaceLink | ✅ IPC | ❌ | `POST /api/workspace-links` | Not started | |
| | removeWorkspaceLink | ✅ IPC | ❌ | `DELETE /api/workspace-links/{id}` | Not started | |
| | getWorkspaceLinks | ✅ IPC | ❌ | `GET /api/workspace-links` | Not started | |
| **Workspace Envs** | importWorkspaceEnvironment | ✅ IPC | ❌ | `POST /api/workspaces/{id}/environments/import` | Not started | Workspace-level |
| | updateWorkspaceEnvironment | ✅ IPC | ❌ | `PATCH /api/workspaces/{id}/environments/{eid}` | Not started | Workspace-level |
| | deleteWorkspaceEnvironment | ✅ IPC | ❌ | `DELETE /api/workspaces/{id}/environments/{eid}` | Not started | Workspace-level |
| | selectWorkspaceEnvironment | ✅ IPC | ❌ | `PATCH /api/workspaces/{id}/active-environment` | Not started | Workspace-level |

**Summary**:
- ✅ **85 local implementations** (IPC-based filesystem operations)
- ❌ **85 cloud implementations** needed
- 🔄 **~45 core endpoints** to implement in bruno-server
- ⚠️ **7 advanced endpoints** (cloning, batch ops, OAuth2, Git) — defer to Phase 4

---

## 3. Data Mapping Spec

### 3.1 Identifier System

**Local (Filesystem)**:
- `pathname`: Full filesystem path, e.g., `/Users/user/workspace/my-collection/requests`
- `uid`: UUID, derived from collection/item name + metadata
- Mapping: pathname ↔ uid (both used interchangeably in local API)

**Cloud**:
- `id`: UUID primary key in database
- `uid`: Same UUID for backwards compatibility with app layer
- Mapping: Always use `id` in REST API URLs; app layer converts uid ↔ id

**Action Item**: Standardize on UUID everywhere; define uid generation rules for new items.

### 3.2 Workspace Context

**Local**:
- `workspacePath`: Filesystem path to workspace folder
- `workspaceUid`: (was removed from Redux state) — **problematic**
- **Fix**: Use `workspace.uid` from loaded workspace object or fetch from first API call

**Cloud**:
- `workspace_id`: UUID in database
- Must always have a `default_workspace_id` per user (set during registration)
- App must use `selectedWorkspaceId` from Redux after auth

**Action Item**: Restore workspace selection after auth; default to user's default workspace.

### 3.3 Collection Scope

**Local**:
- Collections are filesystem-independent (can exist in multiple workspaces)
- Collection UID is global but collection path is workspace-scoped

**Cloud**:
- Collections owned by user, can be linked to multiple workspaces
- Proposal: Store `linked_workspaces: [workspace_id]` in collections table

**Action Item**: Define collection ownership model (user-owned vs workspace-owned vs read-only shared).

### 3.4 Environment Scope

**Local** (Current):
- Workspace-level environments: `/workspace/.env`
- Collection-level environments: `/collection/.env.{name}`
- App treats both as collections-scoped (mismatch!)

**Cloud** (Current):
- Server implements workspace-scoped only (`/api/workspaces/{id}/environments`)
- App expects collection-scoped

**Action Item**: **Design Phase 2** — decide on cloud environment model (workspace-scoped, collection-scoped, or both).

### 3.5 Request/Item Hierarchy

| Level | Local | Cloud | ID Type |
|-------|-------|-------|---------|
| Collection | Folder | Table | UUID (collection_id) |
| Folder | Directory | Table | UUID (folder_id) |
| Request | File (.bru) | Table | UUID (item_id) |
| Variable/Metadata | File properties | Columns | UUID |

**Action Item**: Ensure folder nesting and request-in-folder relationships are preserved during cloud sync.

---

## 4. Error Contract

### 4.1 Standard Error Response (Cloud)

```json
{
  "error": {
    "code": "COLLECTION_NOT_FOUND",
    "message": "Collection with ID 123 does not exist",
    "details": {
      "collectionId": "123",
      "userId": "user-xyz"
    },
    "retryable": false,
    "statusCode": 404
  }
}
```

### 4.2 Error Codes

| Code | HTTP | Retryable | Examples |
|------|------|-----------|----------|
| `INVALID_REQUEST` | 400 | No | Bad params, missing fields |
| `UNAUTHORIZED` | 401 | No | Invalid/expired token |
| `FORBIDDEN` | 403 | No | No permission to resource |
| `NOT_FOUND` | 404 | No | Collection/item doesn't exist |
| `CONFLICT` | 409 | No | Duplicate name, state mismatch |
| `UNPROCESSABLE_ENTITY` | 422 | No | Invalid data (e.g., cycles in items) |
| `RATE_LIMITED` | 429 | Yes | Too many requests |
| `INTERNAL_ERROR` | 500 | Yes | Server error, try again |
| `SERVICE_UNAVAILABLE` | 503 | Yes | Server down, maintenance |

### 4.3 Client Error Handling

**Local (Filesystem)**:
- Wrap in `{ error: { code, message } }` for consistency
- Don't retry on filesystem errors (permission, not found)
- Log all errors to console

**Cloud (HTTP)**:
- Parse error response per 4.1 schema
- Retry only if `retryable: true` + exponential backoff (max 3 retries)
- Show user-friendly toast messages for HTTP 4xx/5xx
- Log server response + request for debugging

**Action Item**: Implement error transformer in StorageManager to normalize local vs cloud errors.

---

## 5. Mode Contract

### 5.1 Storage Mode Selection

```
User is Unauthenticated 
  → mode = "local"
  → All storage calls use localStorage (filesystem)

User is Authenticated
  → mode = "cloud"
  → All storage calls use cloudStorage (REST API)
  → Fallback to local if offline (Phase 5)
```

### 5.2 Mode Switching Logic

**Logout**:
1. Clear auth tokens from Redux
2. Clear API client tokens
3. Storage router detects `isAuthenticated = false`
4. All future calls use localStorage
5. Clear cloud-specific state (workspaces, collections)
6. Optionally clear collections from IndexedDB (keep local)

**Login**:
1. Fetch tokens, set in Redux + API client
2. Storage router detects `isAuthenticated = true`
3. All future calls use cloudStorage
4. Dispatch `initializeCloudData(userId)` to load user's cloud workspaces
5. Populate collections from cloud

**Workspace Selection**:
- **Local**: User selects from file dialog; path becomes workspace context
- **Cloud**: User selects from dropdown (list of user's cloud workspaces); ID becomes workspace context

### 5.3 Feature Availability by Mode

| Feature | Local | Cloud |
|---------|-------|-------|
| Create/manage workspaces | ✅ | ❌ (Phase 3) |
| Import collections | ✅ | ✅ (Phase 2) |
| CRUD requests | ✅ | ✅ (Phase 2) |
| OAuth2 | ✅ | ❌ (Phase 4) |
| Dotenv | ✅ | ❌ (Phase 4) |
| Clone from Git | ✅ | ❌ (Local only, not planned) |
| File watchers | ✅ | ❌ (local only) |
| Sync to cloud | ❌ | ⚠️ (Phase 5) |

**Action Item**: Add feature flags to UI to disable unavailable operations in cloud mode.

---

## 6. Backward Compatibility Rules

### 6.1 Redux State Shape

**Existing selectors that must remain**:
```javascript
selectAuthUser(state)           // state.auth.user
selectIsAuthenticated(state)    // state.auth.isAuthenticated
selectCollections(state)        // state.collections.collections
selectActiveCollection(state)   // state.collections.activeCollection
selectActiveEnvironment(state)  // state.environments.activeEnvironment
selectWorkspaces(state)         // state.workspaces.workspaces (changed from cloudWorkspaces)
```

**Changes**:
- Rename `state.cloudWorkspaces` → `state.workspaces` (breaking, but OK because feature is new)
- Add `state.workspaces.activeWorkspaceId` to track selected workspace
- Keep all collection/item/environment state shape unchanged

### 6.2 Component Integration Points

**Components using storage**:
- Use only through `storage` singleton or `dispatch(reduxAction)`
- Never directly call `cloud.js` or `local.js` functions
- Respect feature availability flags (disable cloud-only features in local mode)

**Components using workspace context**:
- Use `selectActiveWorkspace(state)` selector
- Handle both local (path-based) and cloud (id-based) workspaces transparently
- App layer (StorageManager) hides the difference

### 6.3 API Integration Points

**App ↔ Server** (new):
- Use BrunoServerApi client initialized at startup
- All endpoints return standard error response (section 4.1)
- Implement retry logic in API client, not in storage layer

**Storage ↔ Collections**:
- No changes to collection loading/unloading flow
- Collections in both modes have same Redux state shape
- Diff: local path-based, cloud id-based (transparent to app)

**Action Item**: Audit all components using `workspace`, `collection`, `item` state to ensure compatibility.

---

## 7. Phase 0 Deliverables

✅ **Created**:
1. **Complete Operation Inventory** (section 1): 85 operations × 18 categories
2. **Capability Matrix** (section 2): Status, endpoint mapping, priority
3. **Data Mapping Spec** (section 3): uid/id, workspace context, environment scope, item hierarchy
4. **Error Contract** (section 4): Standard response shape, error codes, retry logic
5. **Mode Contract** (section 5): Storage mode selection, switching logic, feature availability
6. **Backward Compatibility Rules** (section 6): Redux state, components, API integration

---

## 8. Exit Criteria

- [x] All 85 operations inventoried and classified
- [x] Capability matrix completed with endpoint mapping
- [x] Data mapping standardized (uid, workspace context, environment scope)
- [x] Error taxonomy defined with retry rules
- [x] Mode contract documented (local vs cloud switching)
- [x] Backward compatibility rules established
- [x] **Team sign-off on contracts** (approved 2026-03-04)
- [x] **Critical blockers fixed** (workspaces slice, initializeCloudData, error transformer)
- [x] Ready to proceed to Phase 1 (Core Foundation)

---

## 9. Implementation Notes (2026-03-04)

### Decisions Made:
1. **Workspace Slice Naming**: `state.workspaces` (not `cloudWorkspaces`)
2. **Environment Scope Model**: Both collection-scoped AND workspace-scoped (comprehensive support)
3. **Fixed Critical Blockers**: Yes, all blockers resolved before Phase 1

### Changes Applied:

#### 1. Workspace Context Fixed ✅
- **File**: `packages/bruno-app/src/utils/storage/cloud.js`
- **Change**: Updated `getSelectedWorkspace()` to use `state.workspaces.activeWorkspaceUid`
- **Previously**: Looked for non-existent `state.cloudWorkspaces.selectedWorkspaceId`
- **Status**: Cloud storage can now access workspace context correctly

#### 2. initializeCloudData Implemented ✅
- **File**: `packages/bruno-app/src/providers/ReduxStore/slices/auth.js`
- **Changes**:
  - Fetches user's cloud workspaces after login/register
  - Populates Redux with workspace data
  - Sets first workspace as active (or creates default if none exist)
  - Marks workspaces as `isCloud: true` for differentiation
- **Status**: Cloud mode now bootstraps correctly after authentication

#### 3. Duplicate createEnvironment Fixed ✅
- **File**: `packages/bruno-app/src/utils/storage/index.js`
- **Changes**:
  - Renamed `createEnvironment(collectionUid, ...)` → `createCollectionEnvironment()`
  - Renamed `deleteEnvironment(environmentUid, ...)` → `deleteCollectionEnvironment()`
  - Removed legacy `createEnvironment(pathname, name, ...)` duplicate
  - Kept existing `createWorkspaceEnvironment()` for workspace-scoped envs
- **Status**: Supports both collection and workspace environment scopes

#### 4. Error Transformer Created ✅
- **File**: `packages/bruno-app/src/utils/storage/errors.js` (NEW)
- **Features**:
  - Standard error format per Phase 0 Section 4.1
  - `transformCloudError()` - normalizes HTTP/Axios errors
  - `transformLocalError()` - normalizes filesystem errors
  - `retryWithBackoff()` - retry logic for retryable errors
  - Error code mappings and helper functions
- **Status**: Ready for integration in Phase 1

### Workspace Slice Details:
The existing workspace slice (`packages/bruno-app/src/providers/ReduxStore/slices/workspaces/index.js`) was already present and functional. It uses:
- `activeWorkspaceUid` to track selected workspace
- `workspaces: []` array for workspace list
- Local-first design (has `pathname` field)

For cloud mode, `initializeCloudData` now populates this same slice with cloud workspaces marked by `isCloud: true` flag.

---

## Next: Phase 1 — Core Foundation

Phase 0 is complete. Phase 1 will build upon this foundation to:
1. ✅ Initialize complete BrunoServerApi client (already done)
2. ✅ Fix workspace context (`activeWorkspaceUid`) (already done)
3. Integrate error transformer into storage operations
4. ✅ Transform layer exists (already done)
5. Implement auth lifecycle hooks
6. Add observability/logging for cloud operations
