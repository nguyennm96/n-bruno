import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';

// Note: bruno-api will be imported after package is linked
let brunoApi = null;

/**
 * Initialize Bruno API client for workspaces
 * Called after app startup with config
 */
export const initializeWorkspacesApi = (apiInstance) => {
  brunoApi = apiInstance;
};

// ──────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all workspaces for current user
 */
export const fetchWorkspaces = createAsyncThunk('workspaces/fetch', async (_, { rejectWithValue }) => {
  try {
    if (!brunoApi) throw new Error('API client not initialized');

    const workspaces = await brunoApi.workspaces.getAll();
    return workspaces;
  } catch (error) {
    const errorData = error.response?.data?.error;
    const message
      = typeof errorData === 'string' ? errorData : errorData?.message || error.message || 'Failed to load workspaces';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/**
 * Create new workspace
 */
export const createWorkspace = createAsyncThunk(
  'workspaces/create',
  async ({ name, description }, { rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      const workspace = await brunoApi.workspaces.create({ name, description });
      toast.success(`Workspace "${name}" created!`);
      return workspace;
    } catch (error) {
      const errorData = error.response?.data?.error;
      const message
        = typeof errorData === 'string' ? errorData : errorData?.message || error.message || 'Failed to create workspace';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Fetch workspace members
 */
export const fetchWorkspaceMembers = createAsyncThunk(
  'workspaces/fetchMembers',
  async (workspaceId, { rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      const members = await brunoApi.workspaces.getMembers(workspaceId);
      return { workspaceId, members };
    } catch (error) {
      const errorData = error.response?.data?.error;
      const message
        = typeof errorData === 'string' ? errorData : errorData?.message || error.message || 'Failed to load members';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Link local collection to cloud workspace
 */
export const linkCollection = createAsyncThunk(
  'workspaces/linkCollection',
  async ({ workspaceId, collectionPath, collectionName }, { rejectWithValue }) => {
    try {
      // Save mapping to local storage via IPC
      await window.ipcRenderer.invoke('workspace:save-link', {
        workspaceId,
        collectionPath,
        collectionName,
        linkedAt: new Date().toISOString()
      });

      toast.success(`Collection "${collectionName}" linked to workspace!`);

      return {
        workspaceId,
        collectionPath,
        collectionName
      };
    } catch (error) {
      const message = error.message || 'Failed to link collection';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Unlink collection from workspace
 */
export const unlinkCollection = createAsyncThunk(
  'workspaces/unlinkCollection',
  async ({ collectionPath, collectionName }, { rejectWithValue }) => {
    try {
      // Remove mapping from local storage via IPC
      await window.ipcRenderer.invoke('workspace:remove-link', {
        collectionPath
      });

      toast.success(`Collection "${collectionName}" unlinked from workspace`);

      return { collectionPath };
    } catch (error) {
      const message = error.message || 'Failed to unlink collection';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Load saved collection links from storage on app startup
 */
export const loadSavedLinks = createAsyncThunk('workspaces/loadLinks', async (_, { rejectWithValue }) => {
  try {
    // Get all linked collections from storage via IPC
    const links = await window.ipcRenderer.invoke('workspace:get-links');

    return links || {};
  } catch (error) {
    console.error('Failed to load saved collection links:', error.message);
    return {}; // Don't show error to user, just return empty object
  }
});

/**
 * Delete workspace (owner only)
 */
export const deleteWorkspace = createAsyncThunk(
  'workspaces/delete',
  async ({ workspaceId, workspaceName }, { rejectWithValue }) => {
    try {
      if (!brunoApi) throw new Error('API client not initialized');

      await brunoApi.workspaces.delete(workspaceId);
      toast.success(`Workspace "${workspaceName}" deleted`);

      return { workspaceId };
    } catch (error) {
      const errorData = error.response?.data?.error;
      const message
        = typeof errorData === 'string' ? errorData : errorData?.message || error.message || 'Failed to delete workspace';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Slice
// ──────────────────────────────────────────────────────────────────────────────

const initialState = {
  workspaces: [], // Array of workspace objects
  linkedCollections: {}, // { collectionPath: { workspaceId, collectionName, linkedAt } }
  workspaceMembers: {}, // { workspaceId: [members] }
  selectedWorkspaceId: null,
  isLoading: false,
  isCreating: false,
  isDeleting: false,
  isLinking: false,
  isLoadingMembers: false,
  error: null
};

const cloudWorkspacesSlice = createSlice({
  name: 'cloudWorkspaces',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Select workspace
    selectWorkspace: (state, action) => {
      state.selectedWorkspaceId = action.payload;
    },

    // Clear selection
    clearSelection: (state) => {
      state.selectedWorkspaceId = null;
    },

    // Reset slice
    resetWorkspaces: () => initialState
  },
  extraReducers: (builder) => {
    // ── Fetch Workspaces ──
    builder
      .addCase(fetchWorkspaces.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workspaces = action.payload;
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // ── Create Workspace ──
    builder
      .addCase(createWorkspace.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createWorkspace.fulfilled, (state, action) => {
        state.isCreating = false;
        state.workspaces.push(action.payload);
        state.selectedWorkspaceId = action.payload.id;
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      });

    // ── Fetch Members ──
    builder
      .addCase(fetchWorkspaceMembers.pending, (state) => {
        state.isLoadingMembers = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceMembers.fulfilled, (state, action) => {
        state.isLoadingMembers = false;
        state.workspaceMembers[action.payload.workspaceId] = action.payload.members;
      })
      .addCase(fetchWorkspaceMembers.rejected, (state, action) => {
        state.isLoadingMembers = false;
        state.error = action.payload;
      });

    // ── Link Collection ──
    builder
      .addCase(linkCollection.pending, (state) => {
        state.isLinking = true;
        state.error = null;
      })
      .addCase(linkCollection.fulfilled, (state, action) => {
        state.isLinking = false;
        state.linkedCollections[action.payload.collectionPath] = {
          workspaceId: action.payload.workspaceId,
          collectionName: action.payload.collectionName,
          linkedAt: new Date().toISOString()
        };
      })
      .addCase(linkCollection.rejected, (state, action) => {
        state.isLinking = false;
        state.error = action.payload;
      });

    // ── Unlink Collection ──
    builder
      .addCase(unlinkCollection.pending, (state) => {
        state.isLinking = true;
        state.error = null;
      })
      .addCase(unlinkCollection.fulfilled, (state, action) => {
        state.isLinking = false;
        delete state.linkedCollections[action.payload.collectionPath];
      })
      .addCase(unlinkCollection.rejected, (state, action) => {
        state.isLinking = false;
        state.error = action.payload;
      });

    // ── Load Saved Links ──
    builder.addCase(loadSavedLinks.fulfilled, (state, action) => {
      state.linkedCollections = action.payload;
    });

    // ── Delete Workspace ──
    builder
      .addCase(deleteWorkspace.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteWorkspace.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.workspaces = state.workspaces.filter((w) => w.id !== action.payload.workspaceId);

        // Clear selection if deleted workspace was selected
        if (state.selectedWorkspaceId === action.payload.workspaceId) {
          state.selectedWorkspaceId = null;
        }

        // Remove members cache
        delete state.workspaceMembers[action.payload.workspaceId];

        // Unlink all collections linked to this workspace
        Object.keys(state.linkedCollections).forEach((path) => {
          if (state.linkedCollections[path].workspaceId === action.payload.workspaceId) {
            delete state.linkedCollections[path];
          }
        });
      })
      .addCase(deleteWorkspace.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  }
});

export const { clearError, selectWorkspace, clearSelection, resetWorkspaces } = cloudWorkspacesSlice.actions;
export default cloudWorkspacesSlice.reducer;

// ──────────────────────────────────────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────────────────────────────────────

export const selectWorkspaces = (state) => state.cloudWorkspaces.workspaces;
export const selectLinkedCollections = (state) => state.cloudWorkspaces.linkedCollections;
export const selectWorkspaceMembers = (state) => state.cloudWorkspaces.workspaceMembers;
export const selectSelectedWorkspaceId = (state) => state.cloudWorkspaces.selectedWorkspaceId;
export const selectIsLoading = (state) => state.cloudWorkspaces.isLoading;
export const selectIsCreating = (state) => state.cloudWorkspaces.isCreating;
export const selectIsDeleting = (state) => state.cloudWorkspaces.isDeleting;
export const selectIsLinking = (state) => state.cloudWorkspaces.isLinking;
export const selectIsLoadingMembers = (state) => state.cloudWorkspaces.isLoadingMembers;
export const selectError = (state) => state.cloudWorkspaces.error;

// Computed selectors
export const selectSelectedWorkspace = (state) => {
  const id = state.cloudWorkspaces.selectedWorkspaceId;
  return state.cloudWorkspaces.workspaces.find((w) => w.id === id) || null;
};

export const selectWorkspaceById = (state, workspaceId) => {
  return state.cloudWorkspaces.workspaces.find((w) => w.id === workspaceId) || null;
};

export const selectIsCollectionLinked = (state, collectionPath) => {
  return !!state.cloudWorkspaces.linkedCollections[collectionPath];
};

export const selectLinkedWorkspaceId = (state, collectionPath) => {
  return state.cloudWorkspaces.linkedCollections[collectionPath]?.workspaceId || null;
};

export const selectMembersByWorkspaceId = (state, workspaceId) => {
  return state.cloudWorkspaces.workspaceMembers[workspaceId] || [];
};
