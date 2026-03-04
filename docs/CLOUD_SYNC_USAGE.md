# Cloud Sync Usage Guide

## Overview

Bruno Cloud Sync automatically syncs file changes to cloud workspaces when authenticated.

## How It Works

### 1. Switch Workspace - Auto Fetch Data

When you switch between cloud workspaces, data is automatically fetched:

```javascript
// AppTitleBar or ManageWorkspace
import { switchWorkspace } from 'providers/ReduxStore/slices/cloudWorkspaces';

dispatch(switchWorkspace(workspaceId)); // Auto fetches workspace items
```

**What happens:**
- Checks if workspace items are cached
- If not cached → fetches from server
- If cached → uses cached data
- Updates `selectedWorkspaceId`

### 2. File Changes - Auto Sync Queue

When you create/modify/delete collections or items, changes are queued for sync:

```javascript
import { enqueueSync } from 'utils/cloudSync/syncQueue';

// When creating a new request file
enqueueSync('/path/to/request.bru', 'create', {
  name: 'New Request',
  method: 'GET',
  url: 'https://api.example.com'
});

// When updating a file
enqueueSync('/path/to/request.bru', 'update', {
  name: 'Updated Request',
  url: 'https://api.example.com/v2'
});

// When deleting a file
enqueueSync('/path/to/request.bru', 'delete');
```

**What happens:**
- Changes are added to a queue
- Debounced 2 seconds (batches rapid changes)
- Auto-syncs to cloud if authenticated
- Shows success/error toast

## Integration Points

### File Watcher Integration (TODO)

To enable auto-sync, hook into file watchers:

```javascript
// In your file watcher code
import { enqueueSync } from 'utils/cloudSync/syncQueue';

ipcRenderer.on('file:created', (event, { path, content }) => {
  const { isAuthenticated } = store.getState().auth;
  if (isAuthenticated) {
    enqueueSync(path, 'create', parseFileContent(content));
  }
});

ipcRenderer.on('file:modified', (event, { path, content }) => {
  const { isAuthenticated } = store.getState().auth;
  if (isAuthenticated) {
    enqueueSync(path, 'update', parseFileContent(content));
  }
});

ipcRenderer.on('file:deleted', (event, { path }) => {
  const { isAuthenticated } = store.getState().auth;
  if (isAuthenticated) {
    enqueueSync(path, 'delete');
  }
});
```

### Manual Sync

Force sync immediately (bypass debounce):

```javascript
import { flushSyncQueue } from 'utils/cloudSync/syncQueue';

// Sync all queued changes now
await flushSyncQueue();
```

### Clear Queue

Clear all pending changes (e.g., on logout):

```javascript
import { clearSyncQueue } from 'utils/cloudSync/syncQueue';

clearSyncQueue();
```

## API Endpoints Used

- `POST /api/workspaces/:id/sync` - Bulk sync items
- `POST /api/workspaces/:id/items` - Create single item
- `PATCH /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `GET /api/workspaces/:id/collections-tree` - Fetch workspace data

## State Flow

```
User Action (Create/Edit/Delete File)
  ↓
enqueueSync(path, action, data)
  ↓
SyncQueue (debounce 2s)
  ↓
Check: isAuthenticated?
  ↓ YES
syncItemsToCloud(workspaceId, items)
  ↓
bruno-api.collections.syncItems()
  ↓
Server processes changes
  ↓
Success/Error toast
```

## Error Handling

- Network errors: Changes stay in queue, will retry on next enqueue
- Auth errors: Queue is cleared
- Partial failures: Shows count of succeeded vs failed items

## Current Status

✅ Infrastructure complete:
- Sync queue with debouncing
- Bulk sync thunk
- Switch workspace auto-fetch

🚧 TODO:
- Hook into file watchers
- Real-time file change detection
- Conflict resolution
- Offline support with retry queue
