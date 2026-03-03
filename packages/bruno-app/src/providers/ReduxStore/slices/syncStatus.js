import { createSlice } from '@reduxjs/toolkit';

/**
 * Sync Status Slice
 * Tracks cloud sync status for each collection
 */

const initialState = {
  // Map of collectionPath -> sync status
  collections: {
    // Example: '/path/to/collection': {
    //   status: 'synced' | 'syncing' | 'error' | 'offline',
    //   lastSyncedAt: '2024-03-02T10:30:00Z',
    //   error: null,
    //   pendingChanges: 0
    // }
  }
};

const syncStatusSlice = createSlice({
  name: 'syncStatus',
  initialState,
  reducers: {
    // Set sync status for a collection
    setSyncStatus: (state, action) => {
      const { collectionPath, status, lastSyncedAt, error, pendingChanges } = action.payload;

      if (!state.collections[collectionPath]) {
        state.collections[collectionPath] = {};
      }

      if (status !== undefined) {
        state.collections[collectionPath].status = status;
      }

      if (lastSyncedAt !== undefined) {
        state.collections[collectionPath].lastSyncedAt = lastSyncedAt;
      }

      if (error !== undefined) {
        state.collections[collectionPath].error = error;
      }

      if (pendingChanges !== undefined) {
        state.collections[collectionPath].pendingChanges = pendingChanges;
      }
    },

    // Mark collection as syncing
    startSyncing: (state, action) => {
      const { collectionPath } = action.payload;

      if (!state.collections[collectionPath]) {
        state.collections[collectionPath] = {};
      }

      state.collections[collectionPath].status = 'syncing';
      state.collections[collectionPath].error = null;
    },

    // Mark collection as synced
    completeSyncing: (state, action) => {
      const { collectionPath, success, error } = action.payload;

      if (!state.collections[collectionPath]) {
        state.collections[collectionPath] = {};
      }

      if (success) {
        state.collections[collectionPath].status = 'synced';
        state.collections[collectionPath].lastSyncedAt = new Date().toISOString();
        state.collections[collectionPath].error = null;
        state.collections[collectionPath].pendingChanges = 0;
      } else {
        state.collections[collectionPath].status = 'error';
        state.collections[collectionPath].error = error;
      }
    },

    // Increment pending changes count
    incrementPendingChanges: (state, action) => {
      const { collectionPath } = action.payload;

      if (!state.collections[collectionPath]) {
        state.collections[collectionPath] = {
          status: 'synced',
          pendingChanges: 0
        };
      }

      state.collections[collectionPath].pendingChanges
        = (state.collections[collectionPath].pendingChanges || 0) + 1;

      // Mark as syncing if there are pending changes
      if (state.collections[collectionPath].pendingChanges > 0) {
        state.collections[collectionPath].status = 'syncing';
      }
    },

    // Clear sync status for a collection
    clearSyncStatus: (state, action) => {
      const { collectionPath } = action.payload;
      delete state.collections[collectionPath];
    }
  }
});

export const {
  setSyncStatus,
  startSyncing,
  completeSyncing,
  incrementPendingChanges,
  clearSyncStatus
} = syncStatusSlice.actions;

export default syncStatusSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectSyncStatus = (state, collectionPath) => {
  return state.syncStatus.collections[collectionPath] || {
    status: 'synced',
    lastSyncedAt: null,
    error: null,
    pendingChanges: 0
  };
};

export const selectAllSyncStatuses = (state) => state.syncStatus.collections;

export const selectIsSyncing = (state, collectionPath) => {
  const status = state.syncStatus.collections[collectionPath];
  return status?.status === 'syncing';
};

export const selectHasError = (state, collectionPath) => {
  const status = state.syncStatus.collections[collectionPath];
  return status?.status === 'error';
};
