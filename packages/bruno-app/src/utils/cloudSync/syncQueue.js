/**
 * Cloud Sync Queue
 *
 * Manages a queue of file changes to sync to cloud workspace.
 * Debounces rapid changes and batches uploads.
 */

class SyncQueue {
  constructor() {
    this.queue = new Map(); // path -> { action, data, timestamp }
    this.timer = null;
    this.isProcessing = false;
    this.debounceMs = 2000; // Wait 2s after last change before syncing
  }

  /**
   * Add a change to the sync queue
   */
  enqueue(path, action, data) {
    console.log(`📝 [SyncQueue] Enqueued: ${action} ${path}`);

    this.queue.set(path, {
      action, // 'create' | 'update' | 'delete'
      data,
      timestamp: Date.now()
    });

    // Debounce: reset timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.process();
    }, this.debounceMs);
  }

  /**
   * Process the queue and sync to cloud
   */
  async process() {
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 [SyncQueue] Processing ${this.queue.size} changes...`);

    const changes = Array.from(this.queue.entries()).map(([path, change]) => ({
      path,
      ...change
    }));

    try {
      // Get Redux store and dispatch sync action
      const store = window.__REDUX_STORE__;
      if (!store) {
        console.error('❌ [SyncQueue] Redux store not available');
        return;
      }

      const state = store.getState();
      const { isAuthenticated } = state.auth;
      const { selectedWorkspaceId } = state.cloudWorkspaces;

      if (!isAuthenticated || !selectedWorkspaceId) {
        console.log('⏭️  [SyncQueue] Not authenticated or no workspace selected, skipping sync');
        this.queue.clear();
        return;
      }

      // Import and call sync action
      const { syncItemsToCloud } = await import('../../providers/ReduxStore/slices/cloudWorkspaces');
      await store.dispatch(syncItemsToCloud({
        workspaceId: selectedWorkspaceId,
        items: changes.map((c) => ({
          path: c.path,
          action: c.action,
          data: c.data
        }))
      })).unwrap();

      console.log(`✅ [SyncQueue] Synced ${changes.length} changes`);
      this.queue.clear();
    } catch (error) {
      console.error('❌ [SyncQueue] Sync failed:', error);
      // Don't clear queue on error - retry later
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.size;
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();

/**
 * Enqueue a file change for cloud sync
 */
export function enqueueSync(path, action, data) {
  syncQueue.enqueue(path, action, data);
}

/**
 * Force process the queue immediately
 */
export function flushSyncQueue() {
  return syncQueue.process();
}

/**
 * Clear the sync queue
 */
export function clearSyncQueue() {
  syncQueue.clear();
}
