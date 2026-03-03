# File Watching Strategy for Hybrid Mode

## Overview

Bruno operates in **Hybrid Mode** - supporting both cloud-first collections and local `.bru` file collections. File watching should be conditional based on collection type.

---

## File Watching Decision Tree

```
Should we watch this collection's files?
├─ Is user authenticated?
│  ├─ No (Anonymous) ────────────────► YES - Watch files (local-only mode)
│  └─ Yes (Authenticated)
│     └─ Is collection linked to cloud?
│        ├─ Yes ─────────────────────► NO - Don't watch (cloud-first)
│        └─ No ──────────────────────► YES - Watch files (local-only)
```

---

## Implementation Rules

### Rule 1: Anonymous Users
**Always watch files** because anonymous users work exclusively with local `.bru` files.

```javascript
if (!userId) {
  // Anonymous mode - watch all files
  startFileWatcher(collectionPath);
}
```

### Rule 2: Authenticated Users - Cloud Collections
**Never watch files** for cloud-linked collections because:
- Changes go through UI → Cloud API → Redux → Cache
- No `.bru` files involved in normal workflow
- File watching would cause conflicts

```javascript
if (userId && collection.cloudWorkspaceId) {
  // Cloud collection - no file watching
  // Changes handled by cloud sync
}
```

### Rule 3: Authenticated Users - Local Collections
**Always watch files** for local-only collections (not linked to cloud).

```javascript
if (userId && !collection.cloudWorkspaceId) {
  // Local collection - watch files
  startFileWatcher(collectionPath);
}
```

---

## Edge Case: Offline Mode

When authenticated user is offline but has cloud collections:

**Option A: No File Watching (Recommended)**
- User works from IndexedDB cache
- Changes queued for sync
- When back online, sync queue to cloud
- No `.bru` files touched

**Option B: Export to .bru for Offline Editing**
- Allow user to export cloud collection to `.bru` files
- Enable file watching temporarily
- On reconnect, prompt: "Merge local changes with cloud?"
- Show conflict resolution UI

Recommend **Option A** for simplicity.

---

## Implementation Checklist

### Phase 2: Workspace Linking
- [ ] Track `cloudWorkspaceId` in collection metadata
- [ ] Store in `.bruno/cloud-sync.json`:
  ```json
  {
    "cloudWorkspaceId": "ws_123",
    "cloudCollectionId": "col_456",
    "syncStatus": "synced",
    "lastSyncedAt": "2024-01-01T00:00:00Z"
  }
  ```

### Phase 3: Conditional File Watching
- [ ] Check if collection has `cloudWorkspaceId`
- [ ] Skip file watcher setup for cloud collections
- [ ] Keep file watcher for local collections
- [ ] Keep file watcher for all anonymous collections

### File Watcher Service
```javascript
// packages/bruno-electron/src/services/fileWatcher.js

const activeWatchers = new Map(); // collectionPath -> watcher

export function shouldWatchCollection(collection, userId) {
  // Anonymous users - always watch
  if (!userId) return true;

  // Authenticated users - only watch local collections
  const metadata = loadCloudSyncMetadata(collection.pathname);
  return !metadata?.cloudWorkspaceId;
}

export function startWatchingCollection(collection, userId) {
  if (!shouldWatchCollection(collection, userId)) {
    console.log(`Skipping file watcher for cloud collection: ${collection.name}`);
    return;
  }

  console.log(`Starting file watcher for local collection: ${collection.name}`);
  const watcher = chokidar.watch(collection.pathname, {
    // ... watcher options
  });

  activeWatchers.set(collection.pathname, watcher);
}

export function stopWatchingCollection(collectionPath) {
  const watcher = activeWatchers.get(collectionPath);
  if (watcher) {
    watcher.close();
    activeWatchers.delete(collectionPath);
  }
}

export function stopAllWatchers() {
  activeWatchers.forEach((watcher) => watcher.close());
  activeWatchers.clear();
}
```

---

## User Experience

### Anonymous User
1. Opens Bruno (not logged in)
2. Creates collection "My API"
3. **File watcher active** ✅
4. **No network status indicator** (not authenticated)
5. Edits `.bru` file in VS Code → Bruno UI updates

### Authenticated User - Cloud Collection
1. Logs in to Bruno account
2. Sees cloud collections automatically
3. Creates new request via UI
4. **No file watcher** ✅
5. Change goes: UI → Cloud API → Redux → Cache
6. **No `.bru` files created**

### Authenticated User - Local Collection
1. Logs in to Bruno account
2. Creates "Local Testing" collection (not linked to cloud)
3. **File watcher active** ✅
4. Edits `.bru` file → Bruno UI updates
5. Later: Can link to cloud workspace (Phase 2)

---

## Migration Path

When user links local collection to cloud:

1. **Detect linking**:
   ```javascript
   dispatch(linkCollectionToWorkspace(collectionId, workspaceId));
   ```

2. **Upload existing `.bru` files to cloud**:
   ```javascript
   const items = parseLocalBruFiles(collection.pathname);
   await api.collections.uploadItems(workspaceId, items);
   ```

3. **Stop file watcher**:
   ```javascript
   stopWatchingCollection(collection.pathname);
   ```

4. **Switch to cloud mode**:
   - Primary source: Cloud API
   - Cache: IndexedDB
   - No more file watching

---

## Performance Benefits

### Without Conditional Watching
- Watches ALL collections (anonymous + authenticated + cloud)
- Unnecessary file system monitoring
- Potential conflicts between cloud sync and file changes

### With Conditional Watching
- Only watches necessary collections
- Reduced file system overhead
- Clear separation: cloud collections vs local collections
- No sync conflicts

---

## Summary

| User Type | Collection Type | File Watching | Data Source |
|-----------|----------------|---------------|-------------|
| Anonymous | Local `.bru` files | ✅ YES | File system |
| Authenticated | Cloud-linked | ❌ NO | Cloud API + Cache |
| Authenticated | Local-only | ✅ YES | File system |

**Key Principle**: File watching is only needed when `.bru` files are the primary source of truth.
