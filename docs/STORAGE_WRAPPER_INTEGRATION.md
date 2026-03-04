# Storage Wrapper Integration Guide

## Overview

We've created a **unified storage abstraction layer** that centralizes all data interactions. This eliminates the complexity of having separate code paths for local and cloud storage.

## Architecture

### Before (Complex ❌)

```javascript
// Dual storage locations
state.collections.collections = [...];  // Local only
state.cloudWorkspaces.workspaceCollectionsTree = {...};  // Cloud only

// Every action has dual logic
export const createCollection = () => async (dispatch, getState) => {
  const { isAuthenticated } = getState().auth;

  if (isAuthenticated) {
    // ☁️ Cloud path
    const brunoApi = window.__BRUNO_API__;
    const collection = await brunoApi.collections.createCollection(...);
  } else {
    // 💾 Local path
    await ipcRenderer.invoke('renderer:create-collection', ...);
  }
};
```

### After (Simple ✅)

```javascript
// Single storage - storage layer handles routing
import { storage } from 'utils/storage';

export const createCollection = (name) => async (dispatch) => {
  const collection = await storage.createCollection(name);
  dispatch(addCollection(collection));
};
```

## Storage Modes

The storage layer operates in **2 modes**, automatically detected based on authentication state:

### 1. Anonymous Mode (Local Filesystem)
- **When**: User is NOT authenticated
- **Backend**: Electron IPC → Local filesystem
- **Storage**: `.bru` files in local directories
- **Use case**: Offline work, privacy-focused users

### 2. Cloud Mode (bruno-server API)
- **When**: User IS authenticated
- **Backend**: HTTP API → bruno-server (Rust + MongoDB)
- **Storage**: Cloud database with real-time sync
- **Use case**: Team collaboration, cross-device sync

## Schema Synchronization

### Problem: Schema Mismatch
Originally, cloud and local had different data structures:

**Local (nested)**:
```javascript
{
  uid: "...",
  type: "http-request",
  request: {          // ← nested object
    method: "GET",
    url: "...",
    headers: [...],
    body: {...},
    auth: {...}
  },
  settings: {...}
}
```

**Cloud (flat)** ❌:
```javascript
{
  id: "...",
  type: "request",
  method: "GET",     // ← flat
  url: "..."         // ← flat
  // Missing: headers, body, auth, settings...
}
```

### Solution: Schema Transformation ✅

We've implemented:

1. **Backend Schema Update** (`bruno-server/src/models/item.rs`):
   - Added nested `request` object with full details
   - Added `settings` object
   - Kept old flat fields for backward compatibility

2. **Transformation Layer** (`packages/bruno-app/src/utils/storage/transform.js`):
   - `transformCloudItemToLocal()` - Converts cloud → local format
   - `transformLocalItemToCloud()` - Converts local → cloud format
   - Ensures UI code works identically for both modes

3. **Result**: UI receives **identical structure** regardless of storage mode

## Usage

### Import Storage

```javascript
import { storage } from 'utils/storage';
```

### Check Current Mode

```javascript
// Get mode string
const mode = storage.getMode(); // 'cloud' or 'local'

// Boolean checks
if (storage.isCloud()) {
  console.log('Using cloud storage');
}

if (storage.isLocal()) {
  console.log('Using local storage');
}
```

### Collection Operations

```javascript
// List collections
const collections = await storage.getCollections();

// Create collection
const collection = await storage.createCollection('My API', {
  description: 'API documentation'
});

// Update collection
await storage.updateCollection(collectionUid, {
  name: 'Updated Name',
  description: 'New description'
});

// Delete collection
await storage.deleteCollection(collectionUid);

// Clone collection
const cloned = await storage.cloneCollection(collectionUid, 'Copy of API');
```

### Request Operations

```javascript
// Create HTTP request
const request = await storage.createRequest({
  collectionUid: 'collection-123',
  folderUid: 'folder-456',  // optional
  name: 'Get Users',
  type: 'http-request',
  method: 'GET',
  url: 'https://api.example.com/users'
});

// Update request
await storage.updateItem(requestUid, {
  request: {
    method: 'POST',
    url: 'https://api.example.com/users',
    headers: [
      { name: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: {
      mode: 'json',
      json: '{"name": "John"}'
    }
  }
});

// Delete request
await storage.deleteItem(requestUid);

// Clone request
const cloned = await storage.cloneItem(requestUid);

// Move request to another folder
await storage.moveItem(requestUid, newParentUid);
```

### Folder Operations

```javascript
// Create folder
const folder = await storage.createFolder({
  collectionUid: 'collection-123',
  parentFolderUid: null,  // root level
  name: 'Authentication'
});

// Rename folder
await storage.renameItem(folderUid, 'Auth Endpoints');
```

### Environment Operations

```javascript
// List environments
const envs = await storage.getEnvironments(collectionUid);

// Create environment
const env = await storage.createEnvironment(collectionUid, {
  name: 'Production',
  variables: [
    { name: 'API_URL', value: 'https://api.prod.com', enabled: true }
  ]
});

// Update environment
await storage.updateEnvironment(collectionUid, envUid, {
  name: 'Production v2',
  variables: [...]
});

// Select active environment
await storage.selectEnvironment(collectionUid, envUid);

// Delete environment
await storage.deleteEnvironment(collectionUid, envUid);
```

## Migration from Dual-Path Code

### Step 1: Remove authentication checks

**Before:**
```javascript
export const saveRequest = (...) => async (dispatch, getState) => {
  const { isAuthenticated } = getState().auth;

  if (isAuthenticated) {
    // Cloud logic...
  } else {
    // Local logic...
  }
};
```

**After:**
```javascript
import { storage } from 'utils/storage';

export const saveRequest = (collectionUid, itemUid, requestData) => async (dispatch) => {
  await storage.saveRequest(collectionUid, itemUid, requestData);
  // Storage layer handles routing automatically
};
```

### Step 2: Use storage methods directly

Replace:
- `ipcRenderer.invoke('renderer:...')` → `storage.xxx()`
- `brunoApi.collections.xxx()` → `storage.xxx()`

### Step 3: Remove dual state management

**Before:**
```javascript
// Two different state slices
const localCollections = state.collections.collections;
const cloudCollections = state.cloudWorkspaces.workspaceCollectionsTree;
```

**After:**
```javascript
// Single state slice
const collections = state.collections.collections;
// Storage layer normalizes data from both sources
```

## Implementation Files

- **Storage Manager**: `packages/bruno-app/src/utils/storage/index.js`
- **Local Adapter**: `packages/bruno-app/src/utils/storage/local.js`
- **Cloud Adapter**: `packages/bruno-app/src/utils/storage/cloud.js`
- **Transformations**: `packages/bruno-app/src/utils/storage/transform.js`
- **Backend Models**: `packages/bruno-server/src/models/item.rs`
- **Backend Handlers**: `packages/bruno-server/src/handlers/item.rs`

## Benefits

✅ **Simpler Code**: No dual-path logic in actions  
✅ **Type Safety**: Consistent data structure  
✅ **Maintainability**: Single source of truth  
✅ **Scalability**: Easy to add new storage backends  
✅ **Testing**: Mock storage layer instead of IPC/API  

## Next Steps

1. ✅ Backend schema updated with nested structure
2. ✅ Transformation layer implemented
3. ✅ Storage manager initialized in Redux
4. ⏳ Migrate Redux actions to use storage
5. ⏳ Write comprehensive tests
6. ⏳ Update all components to use unified storage

The storage wrapper is ready - start migrating actions! 🚀
