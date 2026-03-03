import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

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
export const register = createAsyncThunk('auth/register', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    // Clear any old tokens from API client before register
    brunoApi.client.clearTokens();

    // Step 1: Register user (only returns user info, no tokens)
    await brunoApi.auth.register({ email, password, name });

    // Step 2: Auto-login to get tokens
    const loginResponse = await brunoApi.auth.login({ email, password });
    const { access_token, refresh_token, user } = loginResponse.data;

    // Save tokens to secure storage (via IPC)
    await window.ipcRenderer.invoke('auth:save-tokens', {
      accessToken: access_token,
      refreshToken: refresh_token
    });

    toast.success(`Welcome, ${user.name}!`);

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
export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    // Clear any old tokens from API client before login
    brunoApi.client.clearTokens();

    const response = await brunoApi.auth.login({ email, password });
    const { access_token, refresh_token, user } = response.data;

    // Save tokens to secure storage
    await window.ipcRenderer.invoke('auth:save-tokens', {
      accessToken: access_token,
      refreshToken: refresh_token
    });

    toast.success(`Welcome back, ${user.name}!`);

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
export const logout = createAsyncThunk('auth/logout', async (_, { getState, rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    const { refreshToken } = getState().auth;

    if (refreshToken) {
      // Revoke refresh token on server
      await brunoApi.auth.logout(refreshToken);
    }

    // Clear tokens from secure storage
    await window.ipcRenderer.invoke('auth:clear-tokens');

    toast.success('Logged out successfully');

    return null;
  } catch (error) {
    // Even if server logout fails, clear local tokens
    await window.ipcRenderer.invoke('auth:clear-tokens');

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
    await window.ipcRenderer.invoke('auth:save-tokens', {
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
 * Load saved tokens from storage on app startup
 */
export const loadSavedAuth = createAsyncThunk('auth/loadSaved', async (_, { rejectWithValue }) => {
  try {
    // Get tokens from secure storage
    const tokens = await window.ipcRenderer.invoke('auth:get-tokens');

    if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
      return null; // No saved auth
    }

    if (!brunoApi) throw new Error('API client not initialized');

    // Set tokens in API client
    brunoApi.client.setTokens(tokens.accessToken, tokens.refreshToken);

    // Verify tokens by fetching user info
    const response = await brunoApi.auth.getMe();

    return {
      user: response.data,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  } catch (error) {
    // Invalid tokens - clear them from storage AND API client
    await window.ipcRenderer.invoke('auth:clear-tokens');
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
