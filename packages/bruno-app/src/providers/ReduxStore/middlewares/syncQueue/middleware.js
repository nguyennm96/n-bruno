import { setOnline } from 'providers/ReduxStore/slices/network';
import { processSyncQueue, loadSyncQueue } from 'providers/ReduxStore/slices/syncQueue';
import toast from 'react-hot-toast';

/**
 * Sync Queue Middleware
 * Automatically processes sync queue when network comes back online
 */
export const syncQueueMiddleware = (store) => (next) => (action) => {
  // Call next action first
  const result = next(action);

  // Listen for network status changes
  if (action.type === setOnline.type) {
    console.log('🌐 Network back online - checking sync queue...');

    // Get current queue state
    const state = store.getState();
    const { syncQueue, auth } = state;

    // Only sync if user is authenticated
    if (!auth.isAuthenticated) {
      console.log('Not authenticated - skipping sync');
      return result;
    }

    // Load sync queue from IndexedDB first (in case it wasn't loaded yet)
    store.dispatch(loadSyncQueue()).then(() => {
      const updatedState = store.getState();
      const queueCount = updatedState.syncQueue.items.length;

      if (queueCount > 0) {
        console.log(`📤 Found ${queueCount} pending change(s) - syncing to cloud...`);
        toast.loading(`Syncing ${queueCount} change(s) to cloud...`, { id: 'auto-sync' });

        // Process sync queue
        store.dispatch(processSyncQueue()).then((result) => {
          if (result.type === processSyncQueue.fulfilled.type) {
            const { processed, failed } = result.payload;

            if (failed === 0) {
              toast.success(`Successfully synced ${processed} change(s)`, { id: 'auto-sync' });
            } else {
              toast.error(`Synced ${processed}, failed ${failed}`, { id: 'auto-sync' });
            }
          } else {
            toast.error('Sync failed', { id: 'auto-sync' });
          }
        });
      } else {
        console.log('Sync queue is empty - nothing to sync');
      }
    });
  }

  return result;
};

export default {
  middleware: syncQueueMiddleware
};
