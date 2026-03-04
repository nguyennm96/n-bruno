# Local to Cloud Migration Checklist

## Strategy
- **Anonymous**: All operations via local filesystem (IPC)
- **Authenticated**: All operations via cloud API (NO local files)

## Status

### Collection Operations
- [x] Create collection - `createCollection()` - DONE
- [x] Rename collection - `renameCollection()` - DONE
- [x] Delete collection - `removeCollection()` - DONE
- [x] Clone collection - `cloneCollection()` - DONE
- [x] Import collection - `importCollection()` - DONE (basic implementation)

### Request/Folder Operations (Items)
- [x] Create HTTP request - `newHttpRequest()` - DONE
- [x] Create gRPC request - `newGrpcRequest()` - DONE
- [x] Create WebSocket request - `newWsRequest()` - DONE
- [x] Create folder - `newFolder()` - DONE
- [x] Save request - `saveRequest()` - DONE
- [x] Delete item - `deleteItem()` - DONE
- [x] Rename item - `renameItem()` - DONE
- [x] Move item - `moveItem()` - DONE
- [x] Clone item - `cloneItem()` - DONE
- [x] Resequence items - `updateItemsSequences()` - DONE

### Environment Operations
- [x] Add environment - `addEnvironment()` - DONE
- [x] Import environment - `importEnvironment()` - DONE
- [x] Copy environment - `copyEnvironment()` - DONE
- [x] Save environment - `saveEnvironment()` - DONE
- [x] Rename environment - `renameEnvironment()` - DONE
- [x] Delete environment - `deleteEnvironment()` - DONE
- [x] Update environment color - `updateEnvironmentColor()` - DONE

### Collection Settings
- [x] Save collection settings - `saveCollectionSettings()` - DONE
- [x] Save collection root - `saveCollectionRoot()` - DONE
- [x] Save folder root - `saveFolderRoot()` - DONE
- [x] Update bruno config - `updateBrunoConfig()` - DONE
- [x] Save collection security config - `saveCollectionSecurityConfig()` - DONE
- [x] Select environment - `selectEnvironment()` - DONE

### Collection Loading
- [x] Open collection - `openCollection()` - DONE (no-op in cloud)
- [x] Open multiple collections - `openMultipleCollections()` - DONE (no-op in cloud)
- [ ] Load request - `loadRequest()` (not needed - loaded from workspace)
- [ ] Mount collection - `mountCollection()` (not needed - loaded from workspace)

### Bulk Operations
- [x] Save multiple requests - `saveMultipleRequests()` - DONE
- [x] Save multiple collections - `saveMultipleCollections()` - DONE
- [x] Save multiple folders - `saveMultipleFolders()` - DONE

### Other Operations
- [ ] Show in folder - N/A (disable for cloud)
- [ ] Update UI state snapshot - N/A (cloud mode doesn't need local snapshots)

## Implementation Pattern

For each operation:

```javascript
export const operationName = (...args) => async (dispatch, getState) => {
  const state = getState();
  const { isAuthenticated } = state.auth;

  if (isAuthenticated) {
    // ── CLOUD MODE: Use API ──
    const { selectedWorkspaceId } = state.cloudWorkspaces;
    const brunoApi = window.__BRUNO_API__;

    try {
      const result = await brunoApi.collections.apiMethod(...);
      // Refresh workspace items
      await dispatch(fetchWorkspaceItems(selectedWorkspaceId));
      return result;
    } catch (error) {
      throw error;
    }
  }

  // ── ANONYMOUS MODE: Use IPC ──
  const { ipcRenderer } = window;
  return ipcRenderer.invoke('renderer:ipc-method', ...args);
};
```

## Priority Order

1. **Phase 1 - Item CRUD** (Most common):
   - Create request/folder
   - Save request
   - Delete item
   - Rename item

2. **Phase 2 - Collection Management**:
   - Rename collection
   - Delete collection

3. **Phase 3 - Advanced**:
   - Import/Export
   - Move items
   - Clone operations

4. **Phase 4 - Settings**:
   - Environments
   - Config
   - Security

## Testing

For each migrated operation:
1. Test in anonymous mode (should use IPC)
2. Test in authenticated mode (should use API)
3. Verify NO local files created when authenticated
4. Check console logs for correct branch
