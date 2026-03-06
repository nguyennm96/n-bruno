import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  addToSyncQueue as addToQueueDB,
  getSyncQueue as getQueueDB,
  updateSyncQueueItem as updateQueueItemDB,
  removeFromSyncQueue as removeFromQueueDB,
  clearSyncQueue as clearQueueDB,
  getSyncQueueCount as getQueueCountDB
} from 'utils/cache/indexedDB';

// Note: bruno-api will be imported after initialization
let brunoApi = null;

/**
 * Initialize Bruno API client
 */
export const initializeSyncQueueApi = (apiInstance) => {
  brunoApi = apiInstance;
};

// ──────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Load sync queue from IndexedDB
 */
export const loadSyncQueue = createAsyncThunk('syncQueue/load', async (_, { rejectWithValue }) => {
  try {
    const items = await getQueueDB();
    return items;
  } catch (error) {
    const message = error.message || 'Failed to load sync queue';
    console.error('Failed to load sync queue:', error);
    return rejectWithValue(message);
  }
});

/**
 * Add item to sync queue
 */
export const queueChange = createAsyncThunk(
  'syncQueue/queueChange',
  async ({ action, type, data, workspaceId }, { rejectWithValue }) => {
    try {
      const id = await addToQueueDB({
        action, // 'create', 'update', 'delete'
        type, // 'request', 'folder', 'collection', etc.
        data,
        workspaceId
      });

      return {
        id,
        action,
        type,
        data,
        workspaceId,
        timestamp: Date.now(),
        status: 'pending',
        retries: 0
      };
    } catch (error) {
      const message = error.message || 'Failed to queue change';
      console.error('Failed to queue change:', error);
      return rejectWithValue(message);
    }
  }
);

/**
 * Process sync queue - sync all pending items to cloud
 */
export const processSyncQueue = createAsyncThunk(
  'syncQueue/process',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      const { network, syncQueue } = getState();

      // Must be online to sync
      if (!network.isOnline) {
        console.log('Cannot process sync queue: offline');
        return { skipped: true, reason: 'offline' };
      }

      const items = syncQueue.items;

      if (items.length === 0) {
        console.log('Sync queue is empty');
        return { processed: 0, failed: 0 };
      }

      console.log(`🔄 Processing ${items.length} items in sync queue...`);

      let processed = 0;
      let failed = 0;

      // Process items sequentially
      for (const item of items) {
        try {
          await dispatch(syncQueueItem(item)).unwrap();
          processed++;
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          failed++;
        }
      }

      if (processed > 0) {
        toast.success(`Synced ${processed} change(s) to cloud`);
      }

      if (failed > 0) {
        toast.error(`Failed to sync ${failed} change(s)`);
      }

      return { processed, failed };
    } catch (error) {
      const message = error.message || 'Failed to process sync queue';
      console.error('Failed to process sync queue:', error);
      toast.error(`Sync failed: ${message}`);
      return rejectWithValue(message);
    }
  }
);

/**
 * Sync a single queue item to cloud
 */
export const syncQueueItem = createAsyncThunk(
  'syncQueue/syncItem',
  async (item, { rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      console.log(`🔄 Syncing: ${item.action} ${item.type} (ID: ${item.id})`);

      let result;

      // Execute the appropriate API call based on action and type
      switch (item.action) {
        case 'create':
          if (item.type === 'request') {
            result = await brunoApi.collections.createRequest(item.data.collectionUid, item.data);
          } else if (item.type === 'folder') {
            result = await brunoApi.collections.createFolder(item.data.collectionUid, item.data);
          } else if (item.type === 'environment') {
            result = await brunoApi.environments.createEnvironment(item.data.workspaceUid, item.data);
          }
          break;

        case 'update':
          if (item.type === 'request' || item.type === 'folder') {
            result = await brunoApi.collections.updateItem(item.data.uid, item.data);
          } else if (item.type === 'environment') {
            result = await brunoApi.environments.updateEnvironment(item.data.uid, item.data);
          }
          break;

        case 'delete':
          if (item.type === 'request' || item.type === 'folder') {
            result = await brunoApi.collections.deleteItem(item.data.uid);
          } else if (item.type === 'environment') {
            result = await brunoApi.environments.deleteEnvironment(item.data.uid);
          }
          break;

        default:
          throw new Error(`Unknown action: ${item.action}`);
      }

      // Remove from queue after successful sync
      await removeFromQueueDB(item.id);

      console.log(`✅ Synced: ${item.action} ${item.type} (ID: ${item.id})`);

      return { id: item.id, result };
    } catch (error) {
      // Update retry count
      const retries = (item.retries || 0) + 1;

      if (retries >= 3) {
        // Max retries reached - mark as failed
        await updateQueueItemDB(item.id, {
          status: 'failed',
          error: error.message,
          retries
        });
      } else {
        // Increment retry count
        await updateQueueItemDB(item.id, {
          retries,
          error: error.message
        });
      }

      const message = error.response?.data?.error || error.message || 'Sync failed';
      console.error(`Failed to sync item ${item.id}:`, message);
      return rejectWithValue({ id: item.id, message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Slice
// ──────────────────────────────────────────────────────────────────────────────

const initialState = {
  items: [], // Queue items loaded from IndexedDB
  isProcessing: false,
  lastProcessedAt: null,
  error: null
};

const syncQueueSlice = createSlice({
  name: 'syncQueue',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // ── Load Queue ──
    builder
      .addCase(loadSyncQueue.fulfilled, (state, action) => {
        state.items = action.payload;
      })
      .addCase(loadSyncQueue.rejected, (state, action) => {
        state.error = action.payload;
      });

    // ── Queue Change ──
    builder
      .addCase(queueChange.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(queueChange.rejected, (state, action) => {
        state.error = action.payload;
      });

    // ── Process Queue ──
    builder
      .addCase(processSyncQueue.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(processSyncQueue.fulfilled, (state) => {
        state.isProcessing = false;
        state.lastProcessedAt = Date.now();
      })
      .addCase(processSyncQueue.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      });

    // ── Sync Item ──
    builder.addCase(syncQueueItem.fulfilled, (state, action) => {
      // Remove item from queue after successful sync
      state.items = state.items.filter((item) => item.id !== action.payload.id);
    });
  }
});

export const { clearError } = syncQueueSlice.actions;
export default syncQueueSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectSyncQueue = (state) => state.syncQueue.items;
export const selectSyncQueueCount = (state) => state.syncQueue.items.length;
export const selectIsProcessingSyncQueue = (state) => state.syncQueue.isProcessing;
export const selectSyncQueueError = (state) => state.syncQueue.error;
export const selectLastProcessedAt = (state) => state.syncQueue.lastProcessedAt;
