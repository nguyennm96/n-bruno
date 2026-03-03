import { startLoading, completeLoading } from '../../slices/globalLoading';

/**
 * Middleware to automatically track loading state for async thunks
 *
 * Auto-tracks pending/fulfilled/rejected lifecycle of createAsyncThunk actions
 */

// Map of action types to user-friendly messages
const ACTION_MESSAGES = {
  'auth/login': 'Signing in...',
  'auth/register': 'Creating account...',
  'auth/logout': 'Signing out...',
  'auth/loadSaved': 'Restoring session...',
  'auth/refresh': 'Refreshing token...',

  'workspaces/fetch': 'Loading workspaces...',
  'workspaces/create': 'Creating workspace...',
  'workspaces/fetchMembers': 'Loading members...',
  'workspaces/linkCollection': 'Linking collection...',
  'workspaces/unlinkCollection': 'Unlinking collection...',

  'collections/fetch': 'Loading collections...',
  'collections/create': 'Creating collection...',
  'collections/update': 'Updating collection...',
  'collections/delete': 'Deleting collection...',

  'sync/push': 'Syncing to cloud...',
  'sync/pull': 'Fetching from cloud...',
  'sync/queue': 'Processing offline changes...'
};

// Actions to exclude from global loading (too frequent or not user-visible)
const EXCLUDED_ACTIONS = [
  'auth/refresh' // Silent background refresh
  // Add more actions to exclude if needed
];

/**
 * Get user-friendly message for an action type
 */
const getMessageForAction = (actionType) => {
  return ACTION_MESSAGES[actionType] || 'Loading...';
};

/**
 * Check if action should be tracked
 */
const shouldTrackAction = (actionType) => {
  return !EXCLUDED_ACTIONS.includes(actionType);
};

/**
 * Global Loading Middleware
 */
export const globalLoadingMiddleware = (store) => (next) => (action) => {
  const { type } = action;

  // Check if this is an async thunk action (pending/fulfilled/rejected)
  const isPending = type.endsWith('/pending');
  const isFulfilled = type.endsWith('/fulfilled');
  const isRejected = type.endsWith('/rejected');

  if (isPending) {
    // Extract base action type (remove '/pending')
    const baseActionType = type.replace('/pending', '');

    if (shouldTrackAction(baseActionType)) {
      const message = getMessageForAction(baseActionType);

      // Start loading with action requestId as unique ID
      store.dispatch(
        startLoading({
          id: action.meta?.requestId || baseActionType,
          message
        })
      );
    }
  } else if (isFulfilled || isRejected) {
    // Extract base action type
    const baseActionType = type.replace(/\/(fulfilled|rejected)$/, '');

    if (shouldTrackAction(baseActionType)) {
      // Complete loading
      store.dispatch(
        completeLoading({
          id: action.meta?.requestId || baseActionType
        })
      );
    }
  }

  return next(action);
};

export default {
  middleware: globalLoadingMiddleware
};
