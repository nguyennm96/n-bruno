import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { storage } from 'utils/storage';

// Note: bruno-api will be imported after package is linked
// For now, we'll setup the structure and integrate later
let brunoApi = null;

/**
 * Initialize Bruno API client
 * Called after app startup with config
 */
export const initializeBrunoApi = (apiInstance) => {
  brunoApi = apiInstance;
};

// ──────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Register new user account
 */
export const register = createAsyncThunk('auth/register', async ({ email, password, name }, { dispatch, rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    // Clear any old tokens from API client before register
    brunoApi.client.clearTokens();

    // Step 1: Register user (only returns user info, no tokens)
    await brunoApi.auth.register({ email, password, name });

    // Step 2: Auto-login to get tokens
    const loginResponse = await brunoApi.auth.login({ email, password });
    const { access_token, refresh_token, user } = loginResponse.data;

    // Save tokens to secure storage (via storage layer)
    await storage.saveAuthTokens({
      accessToken: access_token,
      refreshToken: refresh_token
    });

    toast.success(`Welcome, ${user.name}!`);

    // Initialize cloud data for new user (don't await - runs in background)
    dispatch(initializeCloudData(user.id)).catch((error) => {
      console.error('Failed to initialize cloud data, but registration succeeded:', error);
      toast.error('Registration successful, but failed to load cloud data. You can retry later.');
    });

    return {
      user,
      accessToken: access_token,
      refreshToken: refresh_token
    };
  } catch (error) {
    const errorData = error.response?.data?.error;
    const message = typeof errorData === 'string'
      ? errorData
      : errorData?.message || error.message || 'Registration failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/**
 * Login with email and password
 */
export const login = createAsyncThunk('auth/login', async ({ email, password }, { dispatch, rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    // Clear any old tokens from API client before login
    brunoApi.client.clearTokens();

    const response = await brunoApi.auth.login({ email, password });
    const { access_token, refresh_token, user } = response.data;

    // Save tokens to secure storage
    await storage.saveAuthTokens({
      accessToken: access_token,
      refreshToken: refresh_token
    });

    toast.success(`Welcome back, ${user.name}!`);

    // Initialize cloud data after successful login (don't await - runs in background)
    // If this fails, user is still logged in successfully
    dispatch(initializeCloudData(user.id)).catch((error) => {
      console.error('Failed to initialize cloud data, but login succeeded:', error);
      toast.error('Login successful, but failed to load cloud data. You can retry later.');
    });

    return {
      user,
      accessToken: access_token,
      refreshToken: refresh_token
    };
  } catch (error) {
    const errorData = error.response?.data?.error;
    const message = typeof errorData === 'string'
      ? errorData
      : errorData?.message || error.message || 'Login failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/**
 * Logout and clear tokens
 */
export const logout = createAsyncThunk('auth/logout', async (_, { getState, dispatch, rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    const { refreshToken } = getState().auth;

    if (refreshToken) {
      // Revoke refresh token on server
      await brunoApi.auth.logout(refreshToken);
    }

    // Clear tokens from secure storage
    await storage.clearAuthTokens();

    // Clear IndexedDB cache
    const { clearAllCache } = await import('utils/cache/indexedDB');
    await clearAllCache();

    // Clear cloud workspaces state
    const { resetWorkspaces } = await import('./cloudWorkspaces');
    dispatch(resetWorkspaces());

    // Clear collections state (remove cloud collections from UI)
    dispatch({ type: 'collections/clearAllCollections' });

    toast.success('Logged out successfully');

    return null;
  } catch (error) {
    // Even if server logout fails, clear local tokens and cache
    await storage.clearAuthTokens();

    const { clearAllCache } = await import('utils/cache/indexedDB');
    await clearAllCache();

    const { resetWorkspaces } = await import('./cloudWorkspaces');
    dispatch(resetWorkspaces());

    // Clear collections state
    dispatch({ type: 'collections/clearAllCollections' });

    const errorData = error.response?.data?.error;
    const message = typeof errorData === 'string'
      ? errorData
      : errorData?.message || error.message || 'Logout failed';
    console.error('Logout error:', message);

    return null; // Don't reject, always logout locally
  }
});

/**
 * Refresh access token
 */
export const refreshAccessToken = createAsyncThunk('auth/refresh', async (_, { getState, rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    const { refreshToken } = getState().auth;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await brunoApi.auth.refreshToken(refreshToken);
    const { access_token, refresh_token } = response.data;

    // Save new tokens
    await storage.saveAuthTokens({
      accessToken: access_token,
      refreshToken: refresh_token
    });

    return {
      accessToken: access_token,
      refreshToken: refresh_token
    };
  } catch (error) {
    const errorData = error.response?.data?.error;
    const message = typeof errorData === 'string'
      ? errorData
      : errorData?.message || error.message || 'Token refresh failed';
    console.error('Token refresh error:', message);
    return rejectWithValue(message);
  }
});

/**
 * Initialize cloud data after login
 * Fetches workspaces and collections from cloud, caches locally
 */
export const initializeCloudData = createAsyncThunk(
  'auth/initializeCloudData',
  async (userId, { dispatch, rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      console.log('🔄 Initializing cloud data...');

      // 1. Fetch workspaces from cloud
      const { fetchWorkspaces, fetchWorkspaceItems } = await import('./cloudWorkspaces');
      const workspaces = await dispatch(fetchWorkspaces()).unwrap();

      // 2. Cache workspaces to IndexedDB
      const { cacheWorkspaces } = await import('utils/cache/indexedDB');
      await cacheWorkspaces(workspaces, userId);

      // 3. Fetch items for each workspace
      for (const workspace of workspaces) {
        await dispatch(fetchWorkspaceItems(workspace.id)).unwrap();
      }

      console.log('✅ Cloud data initialized');
      return { success: true };
    } catch (error) {
      const message = error.message || 'Failed to initialize cloud data';
      console.error('Failed to initialize cloud data:', error);
      // Don't show error toast - this is background operation
      return rejectWithValue(message);
    }
  }
);

/**
 * Load saved tokens from storage on app startup
 */
export const loadSavedAuth = createAsyncThunk('auth/loadSaved', async (_, { dispatch, rejectWithValue }) => {
  try {
    // Get tokens from secure storage (via storage layer)
    const tokens = await storage.getAuthTokens();

    if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
      return null; // No saved auth
    }

    if (!brunoApi) throw new Error('API client not initialized');

    // Set tokens in API client
    brunoApi.client.setTokens(tokens.accessToken, tokens.refreshToken);

    // Verify tokens by fetching user info
    const response = await brunoApi.auth.getMe();
    const user = response.data;

    // Initialize cloud data after successful token verification (don't await - runs in background)
    dispatch(initializeCloudData(user.id)).catch((error) => {
      console.error('Failed to initialize cloud data on app start:', error);
      // Don't show toast - user just opened the app, silent failure is okay
    });

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } catch (error) {
    // Invalid tokens - clear them from storage AND API client (via storage layer)
    await storage.clearAuthTokens();
    if (brunoApi?.client) {
      brunoApi.client.clearTokens();
    }
    console.error('Failed to load saved auth:', error.message);
    return null;
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Slice
// ──────────────────────────────────────────────────────────────────────────────

const initialState = {
  user: null, // { id, email, name }
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true, // Loading saved auth on startup
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Set tokens (called by API client after auto-refresh)
    setTokens: (state, action) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    }
  },
  extraReducers: (builder) => {
    // ── Register ──
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // ── Login ──
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // ── Logout ──
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Even if logout fails, clear local state
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = null;
      });

    // ── Refresh Token ──
    builder
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        // Refresh failed - logout
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;

        // Also clear from API client
        if (brunoApi?.client) {
          brunoApi.client.clearTokens();
        }
      });

    // ── Load Saved Auth ──
    builder
      .addCase(loadSavedAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(loadSavedAuth.fulfilled, (state, action) => {
        state.isInitializing = false;

        if (action.payload) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
        }
      })
      .addCase(loadSavedAuth.rejected, (state) => {
        state.isInitializing = false;
      });
  }
});

export const { clearError, setTokens } = authSlice.actions;
export default authSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthLoading = (state) => state.auth.isLoading;
export const selectIsAuthInitializing = (state) => state.auth.isInitializing;
export const selectAuthError = (state) => state.auth.error;
