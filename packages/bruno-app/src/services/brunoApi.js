import { createBrunoApi } from '@usebruno/api';
import { initializeBrunoApi as initializeAuthSlice, setTokens } from 'providers/ReduxStore/slices/auth';

let brunoApiInstance = null;

/**
 * Initialize Bruno Cloud API client
 * Should be called on app startup
 */
export const initializeBrunoCloudApi = (store) => {
  // Get bruno-server URL from environment or default
  const baseURL = import.meta.env?.VITE_BRUNO_SERVER_URL || 'http://localhost:8080';

  console.log('Initializing Bruno Cloud API with baseURL:', baseURL);

  // Create API instance
  brunoApiInstance = createBrunoApi({
    baseURL,
    timeout: 30000,

    // Callback when tokens are refreshed
    onTokenRefresh: (tokens) => {
      console.log('Tokens refreshed automatically');

      // Update Redux store with new tokens
      store.dispatch(setTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }));

      // Save to secure storage
      if (window.ipcRenderer) {
        window.ipcRenderer.invoke('auth:save-tokens', {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }).catch((err) => {
          console.error('Failed to save refreshed tokens:', err);
        });
      }
    },

    // Callback when auth fails (user needs to re-login)
    onAuthError: () => {
      console.log('Auth error - tokens expired, user needs to re-login');

      // Dispatch logout action
      store.dispatch({ type: 'auth/logout/fulfilled' });

      // Optionally show a notification
      // toast.error('Session expired. Please sign in again.');
    }
  });

  // Initialize auth slice with API instance
  initializeAuthSlice(brunoApiInstance);

  return brunoApiInstance;
};

/**
 * Get the Bruno API instance
 * Returns null if not initialized
 */
export const getBrunoApi = () => {
  return brunoApiInstance;
};

/**
 * Check if Bruno API is initialized
 */
export const isBrunoApiInitialized = () => {
  return brunoApiInstance !== null;
};
