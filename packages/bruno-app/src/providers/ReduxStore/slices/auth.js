import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { storage } from 'utils/storage';
import { transformCloudItemToLocal, transformCloudEnvironmentToLocal } from 'utils/storage/transform';
import { getAllDrafts as getAllCloudDrafts } from 'utils/storage/cloudDrafts';
import {
  getCollectionUiState,
  updateSyncMeta,
  clearAll as clearUserCache
} from 'utils/workspaceCache';
import { startSyncPolling, stopSyncPolling } from 'utils/cloudSync';

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
export const register = createAsyncThunk('auth/register', async ({ email, password, name }, { dispatch, getState, rejectWithValue }) => {
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
    const state = getState();
    if (!state.auth.isInitializingCloudData) {
      console.log('🚀 [Register] Dispatching initializeCloudData for user:', user.id);
      dispatch(initializeCloudData(user.id)).catch((error) => {
        console.error('❌ [Register] Failed to initialize cloud data, but registration succeeded:', error);
        toast.error('Registration successful, but failed to load cloud data. You can retry later.');
      });
    } else {
      console.log('⏭️  [Register] Cloud data already initializing, skipping...');
    }

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
export const login = createAsyncThunk('auth/login', async ({ email, password }, { dispatch, getState, rejectWithValue }) => {
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
    const state = getState();
    if (!state.auth.isInitializingCloudData) {
      console.log('🚀 [Login] Dispatching initializeCloudData for user:', user.id);
      dispatch(initializeCloudData(user.id)).catch((error) => {
        console.error('❌ [Login] Failed to initialize cloud data, but login succeeded:', error);
        toast.error('Login successful, but failed to load cloud data. You can retry later.');
      });
    } else {
      console.log('⏭️  [Login] Cloud data already initializing, skipping...');
    }

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
  const doLogout = async () => {
    // Capture userId before clearing auth state
    const userId = getState().auth?.user?.id;

    await storage.clearAuthTokens();

    // Clear all user-scoped local cache (tabs, UI state, drafts, sync meta)
    if (userId) {
      clearUserCache(userId);
    }

    stopSyncPolling();

    const { clearAllCache } = await import('utils/cache/indexedDB');
    await clearAllCache();

    // Clear cloud state from Redux
    dispatch({ type: 'collections/clearAllCollections' });
    dispatch({ type: 'tabs/resetTabs' });
    dispatch({ type: 'workspaces/resetWorkspaces' });

    // Re-open local default workspace
    try {
      const { ipcRenderer } = window;
      if (ipcRenderer) {
        const result = await ipcRenderer.invoke('renderer:get-default-workspace');
        if (result) {
          const { workspaceOpenedEvent } = await import('./workspaces/actions');
          dispatch(workspaceOpenedEvent(result.workspacePath, result.workspaceUid, result.workspaceConfig));
        }
      }
    } catch (e) {
      console.error('Failed to re-open local workspace after logout:', e);
    }
  };

  try {
    if (!brunoApi) throw new Error('API client not initialized');

    const { refreshToken } = getState().auth;
    if (refreshToken) {
      await brunoApi.auth.logout(refreshToken);
    }

    await doLogout();
    toast.success('Logged out successfully');
    return null;
  } catch (error) {
    // Even if server logout fails, clear local state
    await doLogout().catch(console.error);

    const errorData = error.response?.data?.error;
    const message = typeof errorData === 'string'
      ? errorData
      : errorData?.message || error.message || 'Logout failed';
    console.error('Logout error:', message);

    return null; // Don't reject, always logout locally
  }
});

/**
 * Initialize cloud data after login/register
 * This runs in background and doesn't block the auth flow
 */
export const initializeCloudData = createAsyncThunk('auth/initializeCloudData', async (userId, { dispatch, getState }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    console.log('🔄 [Step 1] Fetching cloud workspaces for user:', userId);
    const workspaces = await brunoApi.workspaces.getAll();
    console.log(`✅ [Step 1] Fetched ${workspaces.length} workspaces:`, workspaces.map((w) => ({ id: w.id, name: w.name })));

    console.log('🔄 [Step 2] Clearing local state and loading cloud workspaces...');
    const { createWorkspace, setActiveWorkspace, resetWorkspaces } = await import('./workspaces');
    const { addTab, focusTab, resetTabs } = await import('./tabs');

    // Clear all local state (tabs, workspaces, collections) before loading cloud data
    dispatch(resetTabs());
    dispatch(resetWorkspaces());
    dispatch({ type: 'collections/clearAllCollections' });
    console.log('🧹 [Step 2] Cleared local tabs, workspaces, collections');

    for (const workspace of workspaces) {
      dispatch(createWorkspace({
        uid: workspace.id,
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        isCloud: true, // Mark as cloud workspace
        role: workspace.role,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at
      }));
    }

    let activeWorkspaceId;
    if (workspaces.length > 0) {
      const defaultWorkspace = workspaces[0];
      activeWorkspaceId = defaultWorkspace.id;
      dispatch(setActiveWorkspace(activeWorkspaceId));
      dispatch(addTab({ uid: `${activeWorkspaceId}-overview`, collectionUid: activeWorkspaceId, type: 'workspaceOverview' }));
      dispatch(focusTab({ uid: `${activeWorkspaceId}-overview` }));
      console.log(`✅ [Step 2] Active workspace set: ${defaultWorkspace.name} (${activeWorkspaceId})`);
    } else {
      console.warn('⚠️  [Step 2] No workspaces found — creating default workspace...');
      const defaultWorkspace = await brunoApi.workspaces.create({
        name: 'My Workspace',
        description: 'Default workspace'
      });
      activeWorkspaceId = defaultWorkspace.id;
      dispatch(createWorkspace({
        uid: defaultWorkspace.id,
        id: defaultWorkspace.id,
        name: defaultWorkspace.name,
        description: defaultWorkspace.description,
        isCloud: true,
        role: defaultWorkspace.role
      }));
      dispatch(setActiveWorkspace(activeWorkspaceId));
      dispatch(addTab({ uid: `${activeWorkspaceId}-overview`, collectionUid: activeWorkspaceId, type: 'workspaceOverview' }));
      dispatch(focusTab({ uid: `${activeWorkspaceId}-overview` }));
      console.log(`✅ [Step 2] Created default workspace: ${defaultWorkspace.name} (${activeWorkspaceId})`);
    }

    console.log('🔄 [Step 3] Loading collections for workspace:', activeWorkspaceId);

    // Load workspace-level (global) environments
    try {
      const globalEnvsSlice = await import('./global-environments');
      const updateGlobalEnvironments = globalEnvsSlice.updateGlobalEnvironments;
      const result = await storage.getGlobalEnvironments({ workspaceUid: activeWorkspaceId });
      dispatch(updateGlobalEnvironments({
        globalEnvironments: result?.globalEnvironments || [],
        activeGlobalEnvironmentUid: result?.activeGlobalEnvironmentUid || null
      }));
      console.log(`✅ [Step 3] Loaded ${(result?.globalEnvironments || []).length} global environments`);
    } catch (envErr) {
      console.warn('⚠️  [Step 3] Failed to load global environments:', envErr?.message);
    }

    try {
      const collectionsSlice = await import('./collections');
      const workspacesSlice = await import('./workspaces');
      const createCollection = collectionsSlice.createCollection;
      const addCollectionToWorkspace = workspacesSlice.addCollectionToWorkspace;

      console.log('🔄 [Step 3] Calling getCollectionsTreeByWorkspace...');
      const collections = await brunoApi.collections.getCollectionsTreeByWorkspace(activeWorkspaceId);
      console.log(`✅ [Step 3] Fetched ${collections.length} collections`);

      for (const collection of collections) {
        console.log(`🔄 [Step 3] Transforming collection "${collection.name}" with ${(collection.items || []).length} items...`);
        let transformedItems = [];
        try {
          transformedItems = (collection.items || []).map((item) => transformCloudItemToLocal(item, collection.id));
          console.log(`✅ [Step 3] Transformed items for "${collection.name}":`, transformedItems.map((i) => ({ uid: i.uid, type: i.type, name: i.name, pathname: i.pathname })));
        } catch (transformErr) {
          console.error(`❌ [Step 3] Failed to transform items for collection "${collection.name}":`, transformErr);
        }

        let environments = [];
        try {
          const rawEnvs = await brunoApi.environments.listCollectionEnvironments(collection.id);
          environments = rawEnvs.map(transformCloudEnvironmentToLocal);
          console.log(`✅ [Step 3] Loaded ${environments.length} environments for "${collection.name}"`);
        } catch (envErr) {
          console.warn(`⚠️  [Step 3] Failed to load environments for "${collection.name}":`, envErr?.message);
        }

        const collectionData = {
          uid: collection.id,
          name: collection.name,
          pathname: `cloud://${collection.id}`,
          items: transformedItems,
          version: '1',
          isCloud: true,
          workspaceId: activeWorkspaceId,
          createdAt: collection.created_at,
          updatedAt: collection.updated_at,
          brunoConfig: collection.bruno_config || {},
          root: collection.root || {},
          mountStatus: 'unmounted',
          runtimeVariables: {},
          environments
        };

        dispatch(createCollection(collectionData));
        dispatch(addCollectionToWorkspace({
          workspaceUid: activeWorkspaceId,
          collection: { uid: collection.id, name: collection.name, path: `cloud://${collection.id}` }
        }));

        // Update local sync metadata with server version
        if (collection.updated_at) {
          updateSyncMeta(userId, collection.id, { server_updated_at: collection.updated_at });
        }

        console.log(`✅ [Step 3] Dispatched collection: "${collection.name}"`);
      }

      console.log(`✅ [Step 3] Done — ${collections.length} collections loaded`);

      // Restore cloud drafts from localStorage
      try {
        const { newItem: _newItem } = await import('providers/ReduxStore/slices/collections');
        const drafts = getAllCloudDrafts();
        const loadedCollectionIds = new Set(collections.map((c) => c.id));
        for (const draft of drafts) {
          if (loadedCollectionIds.has(draft.collectionUid)) {
            dispatch(_newItem({ collectionUid: draft.collectionUid, currentItemUid: null, item: draft }));
            console.log(`✅ [Step 3] Restored draft: "${draft.name}"`);
          }
        }
      } catch (draftError) {
        console.warn('⚠️ [Step 3] Failed to restore drafts:', draftError);
      }

      // Restore collection UI state (selected environments)
      try {
        const { selectEnvironment } = await import('providers/ReduxStore/slices/collections');
        const savedUiState = getCollectionUiState(userId);
        for (const [collectionUid, uiState] of Object.entries(savedUiState)) {
          if (uiState?.activeEnvironmentUid) {
            dispatch(selectEnvironment({ collectionUid, environmentUid: uiState.activeEnvironmentUid }));
          }
        }
        console.log(`✅ [Step 4] Restored collection UI state`);
      } catch (uiError) {
        console.warn('⚠️ [Step 4] Failed to restore collection UI state:', uiError?.message);
      }

      // Start background sync polling for team changes
      startSyncPolling(userId, dispatch, getState);
      console.log(`✅ [Step 4] Background sync polling started`);

      return { success: true, workspaceCount: workspaces.length, collectionCount: collections.length };
    } catch (collectionError) {
      console.error('❌ [Step 3] Failed to load collections:', collectionError);
      console.error('❌ [Step 3] Stack:', collectionError?.stack);
      toast.error(`Failed to load collections: ${collectionError?.message || 'Unknown error'}`);
      return { success: true, workspaceCount: workspaces.length, collectionCount: 0, collectionError: collectionError.message };
    }
  } catch (error) {
    console.error('❌ [initializeCloudData] Fatal error:', error);
    console.error('❌ [initializeCloudData] Stack:', error?.stack);
    throw error;
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
 * Load saved tokens from storage on app startup
 */
export const loadSavedAuth = createAsyncThunk('auth/loadSaved', async (_, { dispatch, getState, rejectWithValue }) => {
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
    const state = getState();
    if (!state.auth.isInitializingCloudData) {
      console.log('🚀 [LoadSavedAuth] Dispatching initializeCloudData for user:', user.id);
      dispatch(initializeCloudData(user.id)).catch((error) => {
        console.error('❌ [LoadSavedAuth] Failed to initialize cloud data on app start:', error);
        // Don't show toast - user just opened the app, silent failure is okay
      });
    } else {
      console.log('⏭️  [LoadSavedAuth] Cloud data already initializing, skipping...');
    }

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
  isInitializingCloudData: false, // Guard for duplicate cloud data initialization
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

    // ── Initialize Cloud Data ──
    builder
      .addCase(initializeCloudData.pending, (state) => {
        state.isInitializingCloudData = true;
      })
      .addCase(initializeCloudData.fulfilled, (state) => {
        state.isInitializingCloudData = false;
      })
      .addCase(initializeCloudData.rejected, (state) => {
        state.isInitializingCloudData = false;
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
