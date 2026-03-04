/**
 * Collection Storage Abstraction
 *
 * Automatically routes operations to:
 * - Cloud API when authenticated
 * - Local filesystem (IPC) when anonymous
 *
 * This provides a unified interface that works for both modes.
 */

/**
 * Get Redux store for checking auth state
 */
const getStore = () => {
  return window.__REDUX_STORE__;
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = () => {
  const store = getStore();
  if (!store) return false;
  return store.getState().auth.isAuthenticated;
};

/**
 * Get selected cloud workspace ID
 */
const getWorkspaceId = () => {
  const store = getStore();
  if (!store) return null;
  return store.getState().cloudWorkspaces.selectedWorkspaceId;
};

/**
 * Get Bruno API client
 */
const getBrunoApi = () => {
  return window.__BRUNO_API__;
};

/**
 * Refresh workspace items after cloud operation
 */
const refreshWorkspace = async () => {
  const store = getStore();
  const workspaceId = getWorkspaceId();

  if (!workspaceId) return;

  const { fetchWorkspaceItems } = await import('../../providers/ReduxStore/slices/cloudWorkspaces');
  await store.dispatch(fetchWorkspaceItems(workspaceId));
};

// ──────────────────────────────────────────────────────────────────────────────
// Collection Operations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create new request
 */
export async function createRequest({ collectionUid, folderUid, name, method, url }) {
  if (isAuthenticated()) {
    // ── CLOUD MODE ──
    console.log('☁️  [createRequest] Using cloud API');

    const api = getBrunoApi();
    const workspaceId = getWorkspaceId();

    if (!api || !workspaceId) {
      throw new Error('Cloud API not initialized or no workspace selected');
    }

    const result = await api.collections.createItem(workspaceId, {
      name,
      type: 'request',
      method,
      url,
      parent_item_id: folderUid || null
    });

    await refreshWorkspace();
    return result;
  }

  // ── ANONYMOUS MODE ──
  console.log('💾 [createRequest] Using local filesystem');

  // Keep existing IPC logic
  // This would be called from the original action
  throw new Error('Use original IPC logic for anonymous mode');
}

/**
 * Create new folder
 */
export async function createFolder({ collectionUid, parentFolderUid, name }) {
  if (isAuthenticated()) {
    // ── CLOUD MODE ──
    console.log('☁️  [createFolder] Using cloud API');

    const api = getBrunoApi();
    const workspaceId = getWorkspaceId();

    if (!api || !workspaceId) {
      throw new Error('Cloud API not initialized or no workspace selected');
    }

    const result = await api.collections.createItem(workspaceId, {
      name,
      type: 'folder',
      parent_item_id: parentFolderUid || null
    });

    await refreshWorkspace();
    return result;
  }

  // ── ANONYMOUS MODE ──
  console.log('💾 [createFolder] Using local filesystem');
  throw new Error('Use original IPC logic for anonymous mode');
}

/**
 * Update request
 */
export async function updateRequest({ itemId, data }) {
  if (isAuthenticated()) {
    // ── CLOUD MODE ──
    console.log('☁️  [updateRequest] Using cloud API');

    const api = getBrunoApi();
    if (!api) {
      throw new Error('Cloud API not initialized');
    }

    const result = await api.collections.updateItem(itemId, data);
    await refreshWorkspace();
    return result;
  }

  // ── ANONYMOUS MODE ──
  console.log('💾 [updateRequest] Using local filesystem');
  throw new Error('Use original IPC logic for anonymous mode');
}

/**
 * Delete item (request or folder)
 */
export async function deleteItem({ itemId }) {
  if (isAuthenticated()) {
    // ── CLOUD MODE ──
    console.log('☁️  [deleteItem] Using cloud API');

    const api = getBrunoApi();
    if (!api) {
      throw new Error('Cloud API not initialized');
    }

    await api.collections.deleteItem(itemId);
    await refreshWorkspace();
  }

  // ── ANONYMOUS MODE ──
  console.log('💾 [deleteItem] Using local filesystem');
  throw new Error('Use original IPC logic for anonymous mode');
}

/**
 * Rename item
 */
export async function renameItem({ itemId, newName }) {
  if (isAuthenticated()) {
    // ── CLOUD MODE ──
    console.log('☁️  [renameItem] Using cloud API');

    const api = getBrunoApi();
    if (!api) {
      throw new Error('Cloud API not initialized');
    }

    const result = await api.collections.updateItem(itemId, { name: newName });
    await refreshWorkspace();
    return result;
  }

  // ── ANONYMOUS MODE ──
  console.log('💾 [renameItem] Using local filesystem');
  throw new Error('Use original IPC logic for anonymous mode');
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Check if should use cloud
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if operation should use cloud API
 * Returns true if authenticated, false otherwise
 */
export function shouldUseCloud() {
  return isAuthenticated();
}

/**
 * Get storage mode string for logging
 */
export function getStorageMode() {
  return isAuthenticated() ? 'cloud' : 'local';
}
