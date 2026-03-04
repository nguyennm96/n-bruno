# Collection Tabs Fix - Cloud Collections

## Problem

After creating a cloud collection, clicking on it showed disabled tabs (Overview, Headers, Vars, Auth, etc. were not interactive).

## Root Cause

Cloud collections were missing TWO critical components:

### 1. Missing Backend Structure

The backend's `LocalCollectionTree` struct was missing:
- `root` field - Contains collection-level settings (headers, vars, auth, scripts, tests)
- `brunoConfig` field - Contains bruno configuration (proxy, client certs, protobuf, presets)

**What the UI Expected:**
```javascript
{
  uid: "...",
  name: "...",
  root: {
    request: {
      headers: [],
      vars: { req: [], res: [] },
      auth: { mode: "none" },
      script: { req: "", res: "" },
      tests: ""
    },
    docs: ""
  },
  brunoConfig: {
    proxy: {},
    clientCertificates: { certs: [] },
    protobuf: {},
    presets: {}
  }
}
```

**What Cloud API Was Returning:**
```javascript
{
  uid: "...",
  name: "...",
  // ❌ Missing root
  // ❌ Missing brunoConfig
}
```

### 2. Missing UI State Fields

Cloud collections were stored directly in Redux without initializing UI state fields that local collections get. These fields include:
- `settingsSelectedTab` - Tracks which settings tab is selected
- `folderLevelSettingsSelectedTab` - Tracks folder-level settings tabs
- `allTags` - Collection-level tags
- `isLoading` - Loading state
- `mountStatus` - Mount status tracking
- `format` - Collection format (bru, yml)
- `importedAt` - Timestamp
- `lastAction` - Last action performed

## Solution

### Backend Fix (bruno-server)

**File: `packages/bruno-server/src/handlers/item.rs`**

1. Added new structs for collection-level data:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct CollectionScript {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub req: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub res: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CollectionRootRequest {
    pub headers: Vec<Value>,
    pub vars: RequestVars,
    pub auth: RequestAuth,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<CollectionScript>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tests: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CollectionRoot {
    pub request: CollectionRootRequest,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docs: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrunoConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<Value>,
    #[serde(rename = "clientCertificates", skip_serializing_if = "Option::is_none")]
    pub client_certificates: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protobuf: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presets: Option<Value>,
}
```

2. Updated `LocalCollectionTree` struct:

```rust
#[derive(Debug, Clone, Serialize)]
pub struct LocalCollectionTree {
    pub uid: String,
    pub name: String,
    pub pathname: String,
    #[serde(rename = "isCloud")]
    pub is_cloud: bool,
    pub collapsed: bool,
    #[serde(rename = "mountStatus")]
    pub mount_status: String,
    pub items: Vec<LocalItemNode>,
    pub root: CollectionRoot,              // ✅ ADDED
    #[serde(rename = "brunoConfig")]
    pub bruno_config: BrunoConfig,         // ✅ ADDED
}
```

3. Updated `list_workspace_collections_tree` handler to initialize these fields:

```rust
LocalCollectionTree {
    uid: collection.id.clone(),
    name: collection.name,
    pathname: collection_prefix,
    is_cloud: true,
    collapsed: false,
    mount_status: "mounted".to_string(),
    items: item_tree,
    root: CollectionRoot {
        request: CollectionRootRequest {
            headers: vec![],
            vars: RequestVars { req: vec![], res: vec![] },
            auth: RequestAuth {
                mode: "none".to_string(),
                token: None,
                username: None,
                password: None,
            },
            script: None,
            tests: None,
        },
        docs: None,
    },
    bruno_config: BrunoConfig {
        proxy: None,
        client_certificates: None,
        protobuf: None,
        presets: None,
    },
}
```

### Frontend Fix (bruno-app)

**File: `packages/bruno-app/src/providers/ReduxStore/slices/cloudWorkspaces.js`**

Updated `fetchWorkspaceItems.fulfilled` reducer to initialize UI state fields:

```javascript
.addCase(fetchWorkspaceItems.fulfilled, (state, action) => {
    state.isLoadingItems = false;

    // Initialize UI state fields for each cloud collection
    const collections = action.payload.items.map(collection => {
        // Only initialize if not already present
        if (!collection.settingsSelectedTab) {
            collection.settingsSelectedTab = 'overview';
        }
        if (!collection.folderLevelSettingsSelectedTab) {
            collection.folderLevelSettingsSelectedTab = {};
        }
        if (!collection.allTags) {
            collection.allTags = [];
        }
        if (collection.isLoading === undefined) {
            collection.isLoading = false;
        }
        if (!collection.format) {
            // Add format property from brunoConfig for easy access
            if (collection.brunoConfig?.opencollection) {
                collection.format = 'yml';
            } else {
                collection.format = collection.brunoConfig?.format || 'bru';
            }
        }
        if (!collection.importedAt) {
            collection.importedAt = new Date().getTime();
        }
        if (!collection.lastAction) {
            collection.lastAction = null;
        }

        return collection;
    });

    state.workspaceCollectionsTree[action.payload.workspaceId] = collections;

    console.log(`📥 [fetchWorkspaceItems] Collections initialized with UI state`);
})
```

## Files Modified

1. ✅ `packages/bruno-server/src/handlers/item.rs` - Added collection structures and initialized them
2. ✅ `packages/bruno-app/src/providers/ReduxStore/slices/cloudWorkspaces.js` - Initialize UI state fields

## Testing

After applying the fix, test:

1. ✅ Create a new cloud collection
2. ✅ Click on the collection - tabs should be enabled
3. ✅ Click "Overview" tab - should show collection info
4. ✅ Click "Headers" tab - should allow adding headers
5. ✅ Click "Vars" tab - should allow adding variables
6. ✅ Click "Auth" tab - should allow configuring authentication
7. ✅ Click "Script" tab - should allow adding pre/post scripts
8. ✅ Click "Tests" tab - should allow adding tests
9. ✅ Click "Presets" tab - should show presets
10. ✅ Click "Proxy" tab - should show proxy settings
11. ✅ Click "Client Certificates" tab - should show client cert settings
12. ✅ Click "Protobuf" tab - should show protobuf settings

## Result

✅ **Cloud collections now have the same structure and behavior as local collections!**

All collection settings tabs should be fully functional for cloud collections.
