import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { storage } from 'utils/storage';
import { transformCloudItemToLocal, transformCloudEnvironmentToLocal, transformCloudExampleToLocal } from 'utils/storage/transform';
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

    // Cache user profile for offline session restore
    await storage.saveUserCache({ id: user.id, name: user.name, email: user.email, avatar: user.avatar ?? null });

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

    // Cache user profile for offline session restore
    await storage.saveUserCache({ id: user.id, name: user.name, email: user.email, avatar: user.avatar ?? null });

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
    await storage.clearUserCache(); // Clear cached user profile

    // Clear all user-scoped local cache (tabs, UI state, drafts, sync meta)
    if (userId) {
      clearUserCache(userId);
    }

    stopSyncPolling();

    // Disconnect WebSocket
    try {
      const brunoApi = window.__BRUNO_API__;
      if (brunoApi?.ws?.isConnected) {
        brunoApi.ws.disconnect();
      }
    } catch (_) {}

    const { clearAllCache } = await import('utils/cache/indexedDB');
    await clearAllCache();

    // Clear cloud state from Redux
    dispatch({ type: 'collections/clearAllCollections' });
    dispatch({ type: 'tabs/resetTabs' });
    dispatch({ type: 'workspaces/resetWorkspaces' });
    dispatch({ type: 'cloudSync/resetCloudSync' });

    // Re-open local default workspace using IDB
    try {
      const { loadWorkspacesFromIdb } = await import('utils/idb/collectionTree');
      const { createWorkspace: createWorkspaceSlice } = await import('providers/ReduxStore/slices/workspaces');
      const { switchWorkspace } = await import('./workspaces/actions');
      const { idbPut, STORES } = await import('utils/idb/localStore');

      let idbWorkspaces = await loadWorkspacesFromIdb();

      if (idbWorkspaces.length === 0) {
        const { nanoid } = await import('nanoid');
        const uid = nanoid();
        const now = Date.now();
        await idbPut(STORES.WORKSPACES, { uid, name: 'My Workspace', createdAt: now, updatedAt: now });
        idbWorkspaces = [{ uid, name: 'My Workspace' }];
      }

      for (const ws of idbWorkspaces) {
        dispatch(createWorkspaceSlice({ uid: ws.uid, name: ws.name, pathname: null }));
      }
      dispatch(switchWorkspace(idbWorkspaces[0].uid));
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
    console.log(`✅ [Step 1] Fetched ${workspaces.length} workspaces:`, workspaces.map((w) => ({ id: w.uid, name: w.name })));

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
        uid: workspace.uid,
        id: workspace.uid,
        name: workspace.name,
        description: workspace.description,
        isCloud: true,
        role: workspace.role,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at
      }));
    }

    let activeWorkspaceId;
    if (workspaces.length > 0) {
      const defaultWorkspace = workspaces[0];
      activeWorkspaceId = defaultWorkspace.uid;
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
      activeWorkspaceId = defaultWorkspace.uid;
      dispatch(createWorkspace({
        uid: defaultWorkspace.uid,
        id: defaultWorkspace.uid,
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
          transformedItems = (collection.items || []).map((item) => transformCloudItemToLocal(item, collection.uid));
          console.log(`✅ [Step 3] Transformed items for "${collection.name}":`, transformedItems.map((i) => ({ uid: i.uid, type: i.type, name: i.name, pathname: i.pathname })));
        } catch (transformErr) {
          console.error(`❌ [Step 3] Failed to transform items for collection "${collection.name}":`, transformErr);
        }

        let environments = [];
        try {
          const rawEnvs = await brunoApi.environments.listCollectionEnvironments(collection.uid);
          environments = rawEnvs.map(transformCloudEnvironmentToLocal);
          console.log(`✅ [Step 3] Loaded ${environments.length} environments for "${collection.name}"`);
        } catch (envErr) {
          console.warn(`⚠️  [Step 3] Failed to load environments for "${collection.name}":`, envErr?.message);
        }

        // Fetch examples and attach to request items
        try {
          const cloudExamples = await brunoApi.examples.listForCollection(collection.uid);
          if (cloudExamples && cloudExamples.length > 0) {
            const byRequestUid = {};
            for (const ex of cloudExamples) {
              if (!byRequestUid[ex.requestUid]) byRequestUid[ex.requestUid] = [];
              byRequestUid[ex.requestUid].push(ex);
            }
            const attachExamples = (items) => {
              for (const item of items) {
                if (item.type !== 'folder' && byRequestUid[item.uid]) {
                  item.examples = byRequestUid[item.uid].map(transformCloudExampleToLocal);
                }
                if (item.items?.length) attachExamples(item.items);
              }
            };
            attachExamples(transformedItems);
            console.log(`✅ [Step 3] Attached ${cloudExamples.length} examples for "${collection.name}"`);
          }
        } catch (exErr) {
          console.warn(`⚠️  [Step 3] Failed to fetch examples for "${collection.name}":`, exErr?.message);
        }

        const collectionData = {
          uid: collection.uid,
          name: collection.name,
          pathname: collection.uid,
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
          collection: { uid: collection.uid, name: collection.name, path: collection.uid }
        }));

        // Update local sync metadata with server version
        if (collection.updated_at) {
          updateSyncMeta(userId, collection.uid, { server_updated_at: collection.updated_at });
        }

        console.log(`✅ [Step 3] Dispatched collection: "${collection.name}"`);
      }

      console.log(`✅ [Step 3] Done — ${collections.length} collections loaded`);

      // Restore cloud drafts from localStorage
      try {
        const { newItem: _newItem } = await import('providers/ReduxStore/slices/collections');
        const drafts = getAllCloudDrafts();
        const loadedCollectionIds = new Set(collections.map((c) => c.uid));
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
/**
 * Decode a JWT payload without verifying the signature.
 * Safe to use client-side — we only use the data, not trust it for auth decisions.
 */
const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

export const loadSavedAuth = createAsyncThunk('auth/loadSaved', async (_, { dispatch, getState }) => {
  try {
    // 1. Load tokens from secure storage
    const tokens = await storage.getAuthTokens();
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      return null;
    }

    if (!brunoApi) throw new Error('API client not initialized');

    // 2. Set tokens in API client immediately
    brunoApi.client.setTokens(tokens.accessToken, tokens.refreshToken);

    // 3. Resolve user identity — try fastest source first, no network needed
    //    a) Cached user profile (electron-store)
    //    b) JWT payload (the access token embeds sub/name/email — instant decode)
    const cachedUser = await storage.getUserCache();

    let user = null;

    if (cachedUser?.id) {
      user = { id: cachedUser.id, name: cachedUser.name, email: cachedUser.email, avatar: cachedUser.avatar ?? null };
      console.log('🗂️  [LoadSavedAuth] User resolved from cache:', user.id);
    } else {
      // Decode JWT — server embeds sub (userId), email, name in the access token payload
      const jwtPayload = decodeJwtPayload(tokens.accessToken);
      if (jwtPayload?.sub && jwtPayload?.name && jwtPayload?.email) {
        user = { id: jwtPayload.sub, name: jwtPayload.name, email: jwtPayload.email };
        // Persist so next restart skips JWT decode entirely
        await storage.saveUserCache(user);
        console.log('💡 [LoadSavedAuth] User resolved from JWT payload:', user.id);
      }
    }

    if (user?.id) {
      // 4. Restore session immediately — no network needed
      const state = getState();
      if (!state.auth.isInitializingCloudData) {
        console.log('🚀 [LoadSavedAuth] Restoring session for user:', user.id);
        dispatch(initializeCloudData(user.id)).catch((error) => {
          console.error('❌ [LoadSavedAuth] Failed to initialize cloud data on app start:', error);
          toast.error('Failed to load your workspaces. Please check your connection and try again.');
        });
      }

      // 5. Verify tokens in background — update cache if OK, logout only on 401/403
      brunoApi.auth.getMe()
        .then((response) => {
          const freshUser = response.data;
          storage.saveUserCache({ id: freshUser.id, name: freshUser.name, email: freshUser.email, avatar: freshUser.avatar ?? null });
          console.log('✅ [LoadSavedAuth] Token verified, user cache refreshed');
        })
        .catch((error) => {
          const status = error.response?.status;
          if (status === 401 || status === 403) {
            console.warn('[LoadSavedAuth] Tokens revoked (401/403), clearing session');
            dispatch(logout());
          } else {
            console.warn('[LoadSavedAuth] Token verify skipped (network/server unavailable), staying logged in');
          }
        });

      return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }

    // 6. Last resort: JWT decode failed (very old token format?) — try network
    console.log('🌐 [LoadSavedAuth] No local user data, falling back to network...');
    const response = await brunoApi.auth.getMe();
    const networkUser = response.data;
    await storage.saveUserCache({ id: networkUser.id, name: networkUser.name, email: networkUser.email, avatar: networkUser.avatar ?? null });

    const state = getState();
    if (!state.auth.isInitializingCloudData) {
      dispatch(initializeCloudData(networkUser.id)).catch((error) => {
        console.error('❌ [LoadSavedAuth] Failed to initialize cloud data on app start:', error);
        toast.error('Failed to load your workspaces. Please check your connection and try again.');
      });
    }

    return { user: networkUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      await storage.clearAuthTokens();
      await storage.clearUserCache();
      if (brunoApi?.client) brunoApi.client.clearTokens();
      console.error('[LoadSavedAuth] Tokens invalid (401/403), clearing session');
    } else {
      console.error('[LoadSavedAuth] Network error, keeping tokens for next startup:', error.message);
    }
    return null;
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Slice
// ──────────────────────────────────────────────────────────────────────────────

// ── Profile Update ────────────────────────────────────────────────────────────

export const updateProfile = createAsyncThunk('auth/updateProfile', async ({ name, avatar }, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');
    const response = await brunoApi.auth.updateProfile({ name, avatar });
    const updated = response.data;
    return { name: updated.name, avatar: updated.avatar ?? null };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to update profile');
  }
});

// ── Forgot / Reset Password ───────────────────────────────────────────────────

export const forgotPassword = createAsyncThunk('auth/forgotPassword', async ({ email }, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');
    await brunoApi.auth.forgotPassword(email);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send OTP');
  }
});

export const resetPassword = createAsyncThunk('auth/resetPassword', async ({ email, otp, newPassword }, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');
    await brunoApi.auth.resetPassword({ email, otp, new_password: newPassword });
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to reset password');
  }
});

/**
 * Login via OAuth social provider using the one-time code from the bruno:// callback.
 * The `otc` (one-time code) is extracted by the Electron protocol handler and sent to the renderer.
 */
export const loginWithOAuth = createAsyncThunk(
  'auth/loginWithOAuth',
  async ({ provider, code }, { dispatch, getState, rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      brunoApi.client.clearTokens();

      const response = await brunoApi.auth.oauthExchange(code);
      const { access_token, refresh_token, user } = response.data;

      await storage.saveAuthTokens({ accessToken: access_token, refreshToken: refresh_token });
      await storage.saveUserCache({ id: user.id, name: user.name, email: user.email, avatar: user.avatar ?? null });

      const state = getState();
      if (!state.auth.isInitializingCloudData) {
        dispatch(initializeCloudData(user.id)).catch((error) => {
          console.error('❌ [OAuth] Failed to initialize cloud data:', error);
        });
      }

      return { user, accessToken: access_token, refreshToken: refresh_token };
    } catch (error) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || error.message || 'OAuth login failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  user: null, // { id, email, name, avatar }
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

    // ── Login with OAuth ──
    builder
      .addCase(loginWithOAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithOAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(loginWithOAuth.rejected, (state, action) => {
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

    // ── Update Profile ──
    builder
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (state.user) {
          state.user.name = action.payload.name ?? state.user.name;
          state.user.avatar = action.payload.avatar;
        }
      });

    // forgotPassword and resetPassword manage their own loading state in the component
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
export const selectIsInitializingCloudData = (state) => state.auth.isInitializingCloudData;
export const selectAuthError = (state) => state.auth.error;
