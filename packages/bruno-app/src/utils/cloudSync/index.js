import { getBrunoApi } from 'services/brunoApi';
import { parseRequest } from '@usebruno/filestore';
import path from 'utils/common/path';
import toast from 'react-hot-toast';

/**
 * Convert .bru file data to bruno-server API format
 */
const convertBruToApiFormat = (bruData, pathname) => {
  return {
    type: bruData.type === 'http-request' ? 'request' : 'folder',
    name: bruData.name || path.basename(pathname),
    path: pathname,
    method: bruData.method || 'GET',
    url: bruData.url || '',
    headers: bruData.headers?.reduce((acc, h) => {
      if (h.enabled !== false) {
        acc[h.name] = h.value;
      }
      return acc;
    }, {}) || {},
    body: bruData.body || null,
    seq: bruData.seq || 0
  };
};

/**
 * Read and parse a .bru file
 */
const readBruFile = async (pathname) => {
  if (!window.ipcRenderer) {
    throw new Error('IPC not available');
  }

  try {
    const content = await window.ipcRenderer.invoke('renderer:read-file', pathname);
    const parsed = await parseRequest(content, { format: 'bru' });
    return parsed;
  } catch (error) {
    console.error(`Failed to read .bru file: ${pathname}`, error);
    throw error;
  }
};

/**
 * Sync a single item to cloud (create, update, or delete)
 */
export const syncItemToCloud = async (workspaceId, pathname, changeType) => {
  const api = getBrunoApi();
  if (!api) {
    console.error('Bruno API not initialized');
    return { success: false, error: 'API not initialized' };
  }

  try {
    if (changeType === 'delete') {
      // For delete, we need to find the item ID first
      const existingItem = await api.collections.getItemByPath(workspaceId, pathname);
      if (existingItem) {
        await api.collections.deleteItem(existingItem.id);
        console.log(`☁️  Deleted item from cloud: ${pathname}`);
        return { success: true, action: 'deleted' };
      } else {
        // Item doesn't exist in cloud, nothing to delete
        return { success: true, action: 'skipped' };
      }
    }

    // For add/update, read and parse the .bru file
    const bruData = await readBruFile(pathname);
    const apiData = convertBruToApiFormat(bruData, pathname);

    if (changeType === 'add') {
      // Check if item already exists (in case of race condition)
      const existingItem = await api.collections.getItemByPath(workspaceId, pathname);
      if (existingItem) {
        // Item exists, update instead
        await api.collections.updateItem(existingItem.id, apiData);
        console.log(`☁️  Updated existing item in cloud: ${pathname}`);
        return { success: true, action: 'updated' };
      } else {
        // Create new item
        await api.collections.createItem(workspaceId, apiData);
        console.log(`☁️  Created new item in cloud: ${pathname}`);
        return { success: true, action: 'created' };
      }
    }

    if (changeType === 'update') {
      // Find existing item and update
      const existingItem = await api.collections.getItemByPath(workspaceId, pathname);
      if (existingItem) {
        await api.collections.updateItem(existingItem.id, apiData);
        console.log(`☁️  Updated item in cloud: ${pathname}`);
        return { success: true, action: 'updated' };
      } else {
        // Item doesn't exist, create it
        await api.collections.createItem(workspaceId, apiData);
        console.log(`☁️  Created item in cloud (was missing): ${pathname}`);
        return { success: true, action: 'created' };
      }
    }

    return { success: false, error: `Unknown change type: ${changeType}` };
  } catch (error) {
    console.error(`Failed to sync item to cloud: ${pathname}`, error);

    const errorMessage = error.response?.data?.error?.message
      || error.response?.data?.error
      || error.message;

    return {
      success: false,
      error: errorMessage,
      statusCode: error.response?.status
    };
  }
};

/**
 * Queue for batching sync requests
 */
class SyncQueue {
  constructor() {
    this.queue = new Map(); // pathname -> { workspaceId, changeType, timestamp, collectionPath }
    this.processing = false;
    this.debounceTimer = null;
    this.DEBOUNCE_MS = 1000; // Wait 1 second after last change before syncing
    this.store = null; // Redux store will be set externally
  }

  /**
   * Set Redux store for dispatching actions
   */
  setStore(store) {
    this.store = store;
  }

  /**
   * Add item to sync queue
   */
  add(pathname, workspaceId, changeType, collectionPath) {
    // Store in queue (overwrites if same file changes multiple times)
    this.queue.set(pathname, { workspaceId, changeType, timestamp: Date.now(), collectionPath });

    // Update pending changes count
    if (this.store && collectionPath) {
      const { incrementPendingChanges } = require('providers/ReduxStore/slices/syncStatus');
      this.store.dispatch(incrementPendingChanges({ collectionPath }));
    }

    // Debounce: wait for changes to settle before syncing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Process all queued items
   */
  async processQueue() {
    if (this.processing || this.queue.size === 0) {
      return;
    }

    this.processing = true;
    const items = Array.from(this.queue.entries());
    this.queue.clear();

    console.log(`☁️  Processing sync queue: ${items.length} items`);

    // Group items by collection path
    const collectionGroups = {};
    for (const [pathname, { workspaceId, changeType, collectionPath }] of items) {
      if (!collectionGroups[collectionPath]) {
        collectionGroups[collectionPath] = [];
      }
      collectionGroups[collectionPath].push({ pathname, workspaceId, changeType });
    }

    // Process each collection group
    for (const [collectionPath, collectionItems] of Object.entries(collectionGroups)) {
      // Mark collection as syncing
      if (this.store) {
        const { startSyncing } = require('providers/ReduxStore/slices/syncStatus');
        this.store.dispatch(startSyncing({ collectionPath }));
      }

      let successCount = 0;
      let failCount = 0;
      let lastError = null;

      for (const { pathname, workspaceId, changeType } of collectionItems) {
        const result = await syncItemToCloud(workspaceId, pathname, changeType);

        if (result.success) {
          successCount++;
        } else {
          failCount++;
          lastError = result.error;

          // Show error toast for failed syncs
          if (result.statusCode === 401 || result.statusCode === 403) {
            toast.error('Authentication expired. Please sign in again.');
          } else if (result.error) {
            toast.error(`Sync failed: ${result.error}`);
          }
        }
      }

      // Update sync status for this collection
      if (this.store) {
        const { completeSyncing } = require('providers/ReduxStore/slices/syncStatus');
        this.store.dispatch(
          completeSyncing({
            collectionPath,
            success: failCount === 0,
            error: lastError
          })
        );
      }

      if (successCount > 0) {
        console.log(`☁️  Synced ${successCount} items to cloud for ${collectionPath}`);
      }

      if (failCount > 0) {
        console.error(`☁️  Failed to sync ${failCount} items for ${collectionPath}`);
      }
    }

    this.processing = false;

    // Check if new items were added while processing
    if (this.queue.size > 0) {
      this.processQueue();
    }
  }
}

// Global sync queue instance
export const syncQueue = new SyncQueue();

/**
 * Auto-link and sync collection to cloud
 * Called when collection is opened/mounted
 */
export const autoLinkCollectionToCloud = async (dispatch, collection, getState) => {
  try {
    const state = getState();
    const { isAuthenticated } = state.auth;
    const { workspaces, linkedCollections } = state.cloudWorkspaces;

    // Skip if not authenticated
    if (!isAuthenticated) {
      return false;
    }

    // Skip if already linked
    const isLinked = !!linkedCollections[collection.pathname];
    if (isLinked) {
      return false;
    }

    let targetWorkspace;

    // Find or create default workspace
    const defaultWorkspace = workspaces.find((w) => w.name === 'My Collections');

    if (defaultWorkspace) {
      targetWorkspace = defaultWorkspace;
    } else {
      // Create default workspace
      const { createWorkspace } = await import('providers/ReduxStore/slices/cloudWorkspaces');
      const result = await dispatch(
        createWorkspace({
          name: 'My Collections',
          description: 'Default workspace for all collections'
        })
      ).unwrap();
      targetWorkspace = result;
    }

    // Link collection to workspace
    const { linkCollection } = await import('providers/ReduxStore/slices/cloudWorkspaces');
    await dispatch(
      linkCollection({
        workspaceId: targetWorkspace.id,
        collectionPath: collection.pathname,
        collectionName: collection.name
      })
    ).unwrap();

    console.log(`✅ Auto-linked "${collection.name}" to "${targetWorkspace.name}"`);
    return true;
  } catch (error) {
    console.error('Failed to auto-link collection:', error);
    return false;
  }
};
