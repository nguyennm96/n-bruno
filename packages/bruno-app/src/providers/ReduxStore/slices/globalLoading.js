import { createSlice } from '@reduxjs/toolkit';

/**
 * Global Loading Slice
 * Tracks all async operations in the app for global loading indicator
 */

const initialState = {
  // Map of operation ID -> operation details
  operations: {},
  // Current message to display (from the latest operation)
  currentMessage: null,
  // Whether any operation is loading
  isLoading: false
};

const globalLoadingSlice = createSlice({
  name: 'globalLoading',
  initialState,
  reducers: {
    /**
     * Start a loading operation
     * @param {string} id - Unique operation ID
     * @param {string} message - Message to display (e.g., "Loading collections...")
     * @param {number} progress - Progress from 0 to 1 (optional)
     */
    startLoading: (state, action) => {
      const { id, message, progress = null } = action.payload;

      state.operations[id] = {
        id,
        message,
        progress,
        startedAt: Date.now()
      };

      state.isLoading = true;
      state.currentMessage = message;
    },

    /**
     * Update progress for an operation
     */
    updateProgress: (state, action) => {
      const { id, progress, message } = action.payload;

      if (state.operations[id]) {
        if (progress !== undefined) {
          state.operations[id].progress = progress;
        }
        if (message !== undefined) {
          state.operations[id].message = message;
          state.currentMessage = message;
        }
      }
    },

    /**
     * Complete a loading operation
     */
    completeLoading: (state, action) => {
      const { id } = action.payload;

      delete state.operations[id];

      // Update current message to the latest remaining operation
      const remainingOps = Object.values(state.operations);
      if (remainingOps.length > 0) {
        state.currentMessage = remainingOps[remainingOps.length - 1].message;
      } else {
        state.currentMessage = null;
        state.isLoading = false;
      }
    },

    /**
     * Clear all loading operations (useful for errors or logout)
     */
    clearAllLoading: (state) => {
      state.operations = {};
      state.currentMessage = null;
      state.isLoading = false;
    }
  }
});

export const { startLoading, updateProgress, completeLoading, clearAllLoading } = globalLoadingSlice.actions;

export default globalLoadingSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectIsGlobalLoading = (state) => state.globalLoading.isLoading;
export const selectCurrentLoadingMessage = (state) => state.globalLoading.currentMessage;
export const selectLoadingOperations = (state) => state.globalLoading.operations;

// Get progress (average of all operations with progress)
export const selectGlobalProgress = (state) => {
  const operations = Object.values(state.globalLoading.operations);
  const opsWithProgress = operations.filter((op) => op.progress !== null);

  if (opsWithProgress.length === 0) {
    return null; // Indeterminate progress
  }

  const avgProgress = opsWithProgress.reduce((sum, op) => sum + op.progress, 0) / opsWithProgress.length;
  return avgProgress;
};

// Get count of active operations
export const selectActiveOperationsCount = (state) => {
  return Object.keys(state.globalLoading.operations).length;
};
