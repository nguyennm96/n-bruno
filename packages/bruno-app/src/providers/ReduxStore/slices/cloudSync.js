import { createSlice } from '@reduxjs/toolkit';

/**
 * Cloud Sync Slice
 * Tracks global WebSocket connection state and incremental sync state
 * for cloud workspaces.
 */

const initialState = {
  wsConnected: false,
  syncState: 'idle', // 'idle' | 'syncing' | 'error'
  lastSyncedAt: null, // ISO string
  error: null
};

const cloudSyncSlice = createSlice({
  name: 'cloudSync',
  initialState,
  reducers: {
    setWsConnected: (state, action) => {
      state.wsConnected = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setSyncState: (state, action) => {
      state.syncState = action.payload;
    },
    setSyncError: (state, action) => {
      state.syncState = 'error';
      state.error = action.payload;
    },
    setSyncComplete: (state, action) => {
      state.syncState = 'idle';
      state.lastSyncedAt = action.payload || new Date().toISOString();
      state.error = null;
    },
    resetCloudSync: () => initialState
  }
});

export const { setWsConnected, setSyncState, setSyncError, setSyncComplete, resetCloudSync } = cloudSyncSlice.actions;

export default cloudSyncSlice.reducer;

// Selectors
export const selectWsConnected = (state) => state.cloudSync?.wsConnected ?? false;
export const selectSyncState = (state) => state.cloudSync?.syncState ?? 'idle';
export const selectLastSyncedAt = (state) => state.cloudSync?.lastSyncedAt ?? null;
export const selectSyncError = (state) => state.cloudSync?.error ?? null;
