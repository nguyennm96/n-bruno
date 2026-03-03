import { createSlice } from '@reduxjs/toolkit';

// ──────────────────────────────────────────────────────────────────────────────
// Slice
// ──────────────────────────────────────────────────────────────────────────────

const initialState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineAt: null,
  lastOfflineAt: null
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    /**
     * Set online status
     */
    setOnline: (state) => {
      state.isOnline = true;
      state.lastOnlineAt = Date.now();
    },

    /**
     * Set offline status
     */
    setOffline: (state) => {
      state.isOnline = false;
      state.lastOfflineAt = Date.now();
    },

    /**
     * Initialize network status from navigator.onLine
     */
    initializeNetworkStatus: (state) => {
      state.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  }
});

export const { setOnline, setOffline, initializeNetworkStatus } = networkSlice.actions;
export default networkSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectIsOnline = (state) => state.network.isOnline;
export const selectIsOffline = (state) => !state.network.isOnline;
export const selectLastOnlineAt = (state) => state.network.lastOnlineAt;
export const selectLastOfflineAt = (state) => state.network.lastOfflineAt;
export const selectNetworkStatus = (state) => state.network;

// ──────────────────────────────────────────────────────────────────────────────
// Network Event Listeners
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Setup network event listeners
 * Call this once in App initialization
 */
export const setupNetworkListeners = (dispatch) => {
  console.log('📡 Setting up network listeners...');

  // Initialize current status
  dispatch(initializeNetworkStatus());

  // Listen to online event
  const handleOnline = () => {
    console.log('🌐 Network: ONLINE');
    dispatch(setOnline());
  };

  // Listen to offline event
  const handleOffline = () => {
    console.log('📴 Network: OFFLINE');
    dispatch(setOffline());
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
