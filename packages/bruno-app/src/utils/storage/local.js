/**
 * Local Storage Implementation
 *
 * Handles data operations using Electron IPC for local filesystem storage.
 * This is used when the user is NOT authenticated (anonymous mode).
 */

const { ipcRenderer } = window;

export const getCollections = async (getState) => {
  // For local mode, trigger a workspace reload to pick up file system changes
  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);

  if (activeWorkspace && activeWorkspace.pathname && activeWorkspace.type !== 'default') {
    // Trigger reload of workspace collections from disk
    try {
      await ipcRenderer.invoke('renderer:load-workspace-collections', activeWorkspace.pathname);

      // Wait a bit for IPC events to update Redux state
      // The IPC handler sends events that update collections asynchronously
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('Failed to reload workspace collections:', error);
    }
  }

  // Return current state (should be updated by IPC events now)
  return getState().collections.collections;
};

export const createCollection = async (name, options = {}, getState) => {
  const state = getState();
  const userId = state.auth?.user?.id || null;

  // Determine workspace
  let workspaceId = options.workspaceId;
  if (!workspaceId) {
    const { workspaces } = state;
    const activeWorkspace = workspaces.workspaces.find((w) => w.uid === workspaces.activeWorkspaceUid);
    workspaceId = activeWorkspace?.pathname || 'default';
  }

  return new Promise((resolve, reject) => {
    ipcRenderer
      .invoke('renderer:create-collection', name, userId, { ...options, workspaceId })
      .then(resolve)
      .catch(reject);
  });
};

export const updateCollection = async (collectionUid, data, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  // For local collections, we need to use the specific IPC methods
  // based on what's being updated
  if (data.name) {
    return ipcRenderer.invoke('renderer:rename-collection', data.name, collection.pathname);
  }

  // For security config updates
  if (data.securityConfig) {
    return ipcRenderer.invoke('renderer:save-collection-security-config', collection.pathname, data.securityConfig);
  }

  // For other updates (root, brunoConfig, etc.), use save-collection-root
  if (data.root || data.brunoConfig) {
    const collectionCopy = { ...collection };
    if (data.root) {
      collectionCopy.root = data.root;
    }
    if (data.brunoConfig) {
      collectionCopy.brunoConfig = data.brunoConfig;
    }

    return ipcRenderer.invoke(
      'renderer:save-collection-root',
      collection.pathname,
      collectionCopy.root,
      data.brunoConfig || collection.brunoConfig
    );
  }

  return Promise.resolve();
};

export const deleteCollection = async (collectionUid, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  return ipcRenderer.invoke('renderer:remove-collection', collection.pathname);
};

export const removeCollection = async (pathname, collectionUid, workspaceId) => {
  console.log('[LocalStorage] removeCollection:', { pathname, collectionUid, workspaceId });
  return ipcRenderer.invoke('renderer:remove-collection', pathname, collectionUid, workspaceId);
};

export const cloneCollection = async (collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid, getState) => {
  return ipcRenderer.invoke(
    'renderer:clone-collection',
    collectionName,
    collectionFolderName,
    collectionLocation,
    previousPath
  );
};

export const importCollection = async (collection, collectionLocation, options, getState) => {
  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
  const isMultiple = Array.isArray(collection);
  const DEFAULT_COLLECTION_FORMAT = options?.format || 'bru';

  const result = await ipcRenderer.invoke('renderer:import-collection', collection, collectionLocation, DEFAULT_COLLECTION_FORMAT);
  const importedPaths = result.success.items;

  if (importedPaths.length > 0 && activeWorkspace && activeWorkspace.pathname && activeWorkspace.type !== 'default') {
    for (const importedItem of importedPaths) {
      const workspaceCollection = {
        name: importedItem.name,
        path: importedItem.path
      };
      await ipcRenderer.invoke('renderer:add-collection-to-workspace', activeWorkspace.pathname, workspaceCollection);
    }
  }

  return isMultiple ? importedPaths : importedPaths[0];
};

export const renameCollection = async (collectionUid, newName, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  console.log('LocalStorage.renameCollection: invoking IPC', { collectionUid, newName, pathname: collection.pathname });
  return ipcRenderer.invoke('renderer:rename-collection', newName, collection.pathname);
};

export const createFolder = async (collectionUid, folderName, parentFolderId = null, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  // Find parent item to get its pathname
  let parentPathname = collection.pathname;
  if (parentFolderId) {
    const findItem = (items, uid) => {
      for (const item of items || []) {
        if (item.uid === uid) return item;
        if (item.items) {
          const found = findItem(item.items, uid);
          if (found) return found;
        }
      }
      return null;
    };
    const parentItem = findItem(collection.items, parentFolderId);
    if (parentItem) {
      parentPathname = parentItem.pathname;
    }
  }

  // Get collection format
  const format = collection.brunoConfig?.format || collection.format || 'bru';

  // Determine folder directory name (sanitized version of folder name)
  const sanitizeName = (name) => {
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };
  const directoryName = sanitizeName(folderName);

  // Calculate full pathname
  const path = require('path');
  const fullPathname = path.join(parentPathname, directoryName);

  // Get items count for sequence number
  const parentItem = parentFolderId
    ? (() => {
        const findItem = (items, uid) => {
          for (const item of items || []) {
            if (item.uid === uid) return item;
            if (item.items) {
              const found = findItem(item.items, uid);
              if (found) return found;
            }
          }
          return null;
        };
        return findItem(collection.items, parentFolderId);
      })()
    : collection;

  const items = (parentItem?.items || []).filter((i) => i.type === 'folder' || i.type?.includes('request'));

  // Build folder data structure that IPC expects
  const folderData = {
    meta: {
      name: folderName,
      seq: items.length + 1
    },
    request: {
      auth: {
        mode: 'inherit'
      }
    }
  };

  return ipcRenderer.invoke('renderer:new-folder', {
    pathname: fullPathname,
    folderData,
    format
  });
};

export const createRequest = async (collectionUid, requestData, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  const { name, method = 'GET', url = '', parentFolderId = null, type = 'http-request' } = requestData;

  // Build the item structure that the IPC handler expects
  const { v4: uuid } = require('uuid');
  const path = require('path');

  // Build filename based on collection format
  const format = collection.brunoConfig?.format || collection.format || 'bru';
  const extension = format === 'json' ? '.json' : '.bru';
  const filename = `${name}${extension}`;

  // Determine parent item and pathname
  let parentItem = collection;
  let parentPathname = collection.pathname;

  if (parentFolderId) {
    // Find parent folder
    const findItemByUid = (items, uid) => {
      for (const item of items || []) {
        if (item.uid === uid) return item;
        if (item.items) {
          const found = findItemByUid(item.items, uid);
          if (found) return found;
        }
      }
      return null;
    };
    const found = findItemByUid(collection.items, parentFolderId);
    if (found) {
      parentItem = found;
      parentPathname = found.pathname;
    }
  }

  // Calculate sequence number
  const items = (parentItem.items || []).filter((i) => i.type === 'folder' || i.type?.includes('request'));
  const seq = items.length + 1;

  const item = {
    uid: uuid(),
    name: name,
    filename: filename,
    type: type,
    seq: seq,
    request: {
      url: url,
      method: method,
      auth: { mode: 'inherit' },
      headers: [],
      params: [],
      body: {
        mode: 'none',
        json: null,
        text: null,
        xml: null,
        sparql: null,
        multipartForm: [],
        formUrlEncoded: [],
        file: []
      },
      script: { req: null, res: null },
      vars: { req: [], res: [] },
      assertions: [],
      tests: null
    },
    settings: {
      encodeUrl: true
    }
  };

  const fullPathname = path.join(parentPathname, filename);

  console.log('🔍 [LocalStorage] Creating request:', {
    fullPathname,
    itemName: item.name,
    itemType: item.type,
    collectionPath: collection.pathname
  });

  // Call the IPC handler - this will trigger file watcher events
  try {
    const result = await ipcRenderer.invoke('renderer:new-request', fullPathname, item);
    console.log('✅ [LocalStorage] IPC call succeeded:', result);

    // Manually scan the collection directory to pick up the new file
    // This is more reliable than waiting for file watchers
    const brunoFiles = await ipcRenderer.invoke('renderer:scan-for-bruno-files', collection.pathname);
    console.log('📂 [LocalStorage] Scanned collection, found', brunoFiles?.length, 'files');
  } catch (error) {
    console.error('❌ [LocalStorage] IPC call failed:', error);
    throw error;
  }

  // Return the created item with pathname
  return {
    ...item,
    pathname: fullPathname,
    collectionUid: collectionUid
  };
};

export const updateRequest = async (itemUid, data, getState) => {
  const state = getState();

  // Find the collection containing this item
  let collection = null;
  for (const col of state.collections.collections) {
    // Recursive search would be needed here - simplified for now
    collection = col;
    break;
  }

  if (!collection) {
    throw new Error('Collection not found for item');
  }

  return ipcRenderer.invoke('renderer:save-request', {
    collectionUid: collection.uid,
    itemUid,
    ...data
  });
};

/**
 * Save request to filesystem
 * @param {string} pathname - Full path to the request file
 * @param {object} itemData - Request data (already transformed for saving)
 * @param {string} format - Collection format (json/bru)
 */
export const saveRequest = async (pathname, itemData, format) => {
  console.log('LocalStorage.saveRequest: invoking IPC', { pathname, format });
  return ipcRenderer.invoke('renderer:save-request', pathname, itemData, format);
};

export const updateItem = async (itemUid, collectionUid, data, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  // Find the item to get its pathname
  const findItem = (items, uid) => {
    for (const item of items) {
      if (item.uid === uid) return item;
      if (item.items?.length) {
        const found = findItem(item.items, uid);
        if (found) return found;
      }
    }
    return null;
  };

  const item = findItem(collection.items, itemUid);
  if (!item) {
    throw new Error('Item not found');
  }

  // Handle name updates
  if (data.name !== undefined) {
    return ipcRenderer.invoke('renderer:rename-item-name', {
      itemPath: item.pathname,
      newName: data.name,
      collectionPathname: collection.pathname
    });
  }

  // For other updates, use save-request
  return ipcRenderer.invoke('renderer:save-request', {
    collectionUid: collection.uid,
    itemUid,
    ...data
  });
};

export const deleteItem = async (itemUid, collectionUid, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  // Find the item to get its pathname and type
  const findItem = (items, uid) => {
    for (const item of items || []) {
      if (item.uid === uid) return item;
      if (item.items) {
        const found = findItem(item.items, uid);
        if (found) return found;
      }
    }
    return null;
  };

  const item = findItem(collection.items, itemUid);
  if (!item) {
    throw new Error('Item not found');
  }

  // IPC handler expects: (pathname, type, collectionPathname)
  return ipcRenderer.invoke('renderer:delete-item', item.pathname, item.type, collection.pathname);
};

export const moveItem = async (params, getState) => {
  const { targetDirname, sourcePathname } = params;

  console.log('LocalStorage.moveItem: invoking IPC', { targetDirname, sourcePathname });
  return ipcRenderer.invoke('renderer:move-item', {
    targetDirname,
    sourcePathname
  });
};

export const renameItemName = async (itemPath, newName, collectionPathname) => {
  console.log('LocalStorage.renameItemName: invoking IPC', { itemPath, newName, collectionPathname });
  return ipcRenderer.invoke('renderer:rename-item-name', { itemPath, newName, collectionPathname });
};

export const renameItemFilename = async (oldPath, newPath, newName, newFilename, collectionPathname) => {
  console.log('LocalStorage.renameItemFilename: invoking IPC', { oldPath, newPath, newFilename });
  return ipcRenderer.invoke('renderer:rename-item-filename', { oldPath, newPath, newName, newFilename, collectionPathname });
};

export const newRequest = async (pathname, itemData, format) => {
  console.log('LocalStorage.newRequest: invoking IPC', { pathname, format });
  return ipcRenderer.invoke('renderer:new-request', pathname, itemData, format);
};

export const cloneFolder = async (item, collectionPath, collectionPathname) => {
  console.log('LocalStorage.cloneFolder: invoking IPC', { itemUid: item.uid, collectionPath });
  return ipcRenderer.invoke('renderer:clone-folder', item, collectionPath, collectionPathname);
};

export const resequenceItems = async (itemsToResequence, collectionPathname) => {
  console.log('LocalStorage.resequenceItems: invoking IPC', { itemCount: itemsToResequence.length });
  return ipcRenderer.invoke('renderer:resequence-items', itemsToResequence, collectionPathname);
};

export const cloneItem = async (itemUid, collectionUid, newName, getState) => {
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  return ipcRenderer.invoke('renderer:clone-item', {
    collectionPath: collection.pathname,
    itemUid,
    newName
  });
};

export const renameEnvironment = async (collectionPathname, oldName, newName) => {
  console.log('LocalStorage.renameEnvironment: invoking IPC', { collectionPathname, oldName, newName });
  return ipcRenderer.invoke('renderer:rename-environment', collectionPathname, oldName, newName);
};

export const saveEnvironment = async (collectionPathname, environmentData) => {
  console.log('LocalStorage.saveEnvironment: invoking IPC', { collectionPathname, envName: environmentData.name });
  return ipcRenderer.invoke('renderer:save-environment', collectionPathname, environmentData);
};

export const updateEnvironmentColor = async (collectionPathname, environmentName, color) => {
  console.log('LocalStorage.updateEnvironmentColor: invoking IPC', { collectionPathname, environmentName, color });
  return ipcRenderer.invoke('renderer:update-environment-color', collectionPathname, environmentName, color);
};

export const saveCollectionRoot = async (collectionPathname, collectionRootData, brunoConfig) => {
  console.log('LocalStorage.saveCollectionRoot: invoking IPC', { collectionPathname });
  return ipcRenderer.invoke('renderer:save-collection-root', collectionPathname, collectionRootData, brunoConfig);
};

export const updateBrunoConfig = async (brunoConfig, collectionPathname, collectionRoot) => {
  console.log('LocalStorage.updateBrunoConfig: invoking IPC', { collectionPathname });
  return ipcRenderer.invoke('renderer:update-bruno-config', brunoConfig, collectionPathname, collectionRoot);
};

export const openCollection = async (options = {}) => {
  console.log('LocalStorage.openCollection: invoking IPC', { options });
  return ipcRenderer.invoke('renderer:open-collection', options);
};

export const importCollectionZip = async (zipFilePath, collectionLocation) => {
  console.log('LocalStorage.importCollectionZip: invoking IPC', { zipFilePath, collectionLocation });
  return ipcRenderer.invoke('renderer:import-collection-zip', zipFilePath, collectionLocation);
};

export const addCollectionToWorkspace = async (workspacePath, workspaceCollection) => {
  console.log('LocalStorage.addCollectionToWorkspace: invoking IPC', { workspacePath });
  return ipcRenderer.invoke('renderer:add-collection-to-workspace', workspacePath, workspaceCollection);
};

export const getCollectionSecurityConfig = async (pathname) => {
  console.log('LocalStorage.getCollectionSecurityConfig: invoking IPC', { pathname });
  return ipcRenderer.invoke('renderer:get-collection-security-config', pathname);
};

export const getCollectionWorkspaces = async (collectionPathname) => {
  console.log('LocalStorage.getCollectionWorkspaces: invoking IPC', { collectionPathname });
  return ipcRenderer.invoke('renderer:get-collection-workspaces', collectionPathname);
};

export const setCollectionWorkspace = async (collectionUid, workspacePathname) => {
  console.log('[LocalStorage] setCollectionWorkspace:', { collectionUid, workspacePathname });
  return ipcRenderer.invoke('renderer:set-collection-workspace', collectionUid, workspacePathname);
};

export const openMultipleCollections = async (collectionPaths, options = {}) => {
  console.log('[LocalStorage] openMultipleCollections:', { count: collectionPaths.length });
  return ipcRenderer.invoke('renderer:open-multiple-collections', collectionPaths, options);
};

export const deleteTransientRequests = async (filePaths, tempDir) => {
  console.log('[LocalStorage] deleteTransientRequests:', { count: filePaths.length, tempDir });
  return ipcRenderer.invoke('renderer:delete-transient-requests', filePaths, tempDir);
};

export const clearUserCollections = async (userId) => {
  console.log('[LocalStorage] clearUserCollections:', { userId });
  return ipcRenderer.invoke('renderer:clear-user-collections', userId);
};

// UI/System operations (local-only)
export const updateUiStateSnapshot = async (data) => {
  console.log('[LocalStorage] updateUiStateSnapshot:', data.type);
  return ipcRenderer.invoke('renderer:update-ui-state-snapshot', data);
};

export const browseDirectory = async () => {
  console.log('[LocalStorage] browseDirectory');
  return ipcRenderer.invoke('renderer:browse-directory');
};

export const browseFiles = async (filters, properties) => {
  console.log('[LocalStorage] browseFiles:', { filters, properties });
  return ipcRenderer.invoke('renderer:browse-files', filters, properties);
};

export const showInFolder = async (collectionPath) => {
  console.log('[LocalStorage] showInFolder:', { collectionPath });
  return ipcRenderer.invoke('renderer:show-in-folder', collectionPath);
};

// Load request operations (may be deprecated)
export const loadRequestViaWorker = async ({ collectionUid, pathname }) => {
  console.log('[LocalStorage] loadRequestViaWorker:', { collectionUid, pathname });
  return ipcRenderer.invoke('renderer:load-request-via-worker', { collectionUid, pathname });
};

export const loadRequest = async ({ collectionUid, pathname }) => {
  console.log('[LocalStorage] loadRequest:', { collectionUid, pathname });
  return ipcRenderer.invoke('renderer:load-request', { collectionUid, pathname });
};

export const loadLargeRequest = async ({ collectionUid, pathname }) => {
  console.log('[LocalStorage] loadLargeRequest:', { collectionUid, pathname });
  return ipcRenderer.invoke('renderer:load-large-request', { collectionUid, pathname });
};

// Save and folder operations
export const saveMultipleRequests = async (itemsToSave) => {
  console.log('[LocalStorage] saveMultipleRequests:', { count: itemsToSave.length });
  return ipcRenderer.invoke('renderer:save-multiple-requests', itemsToSave);
};

export const saveFolderRoot = async (folderData) => {
  console.log('[LocalStorage] saveFolderRoot:', { folderData });
  return ipcRenderer.invoke('renderer:save-folder-root', folderData);
};

export const runCollectionFolder = async (collectionUid, folderUid, itemsToRun, options) => {
  console.log('[LocalStorage] runCollectionFolder:', { collectionUid, folderUid });
  return ipcRenderer.invoke('renderer:run-collection-folder', collectionUid, folderUid, itemsToRun, options);
};

// Environment operations
export const createEnvironment = async (pathname, name, variables, color) => {
  console.log('[LocalStorage] createEnvironment:', { pathname, name });
  return ipcRenderer.invoke('renderer:create-environment', pathname, name, variables, color);
};

export const deleteEnvironment = async (pathname, name) => {
  console.log('[LocalStorage] deleteEnvironment:', { pathname, name });
  return ipcRenderer.invoke('renderer:delete-environment', pathname, name);
};

// Variable operations
export const updateVariableInFile = async (pathname, variable, scopeType, collectionRoot, format) => {
  console.log('[LocalStorage] updateVariableInFile:', { pathname });
  return ipcRenderer.invoke('renderer:update-variable-in-file', pathname, variable, scopeType, collectionRoot, format);
};

// Bruno config operations
export const updateBrunoConfigStorage = async (brunoConfig, pathname, collectionRoot) => {
  console.log('[LocalStorage] updateBrunoConfigStorage:', { pathname });
  return ipcRenderer.invoke('renderer:update-bruno-config', brunoConfig, pathname, collectionRoot);
};

// Workspace operations
export const reorderWorkspaceCollections = async (workspacePathname, collectionPaths) => {
  console.log('[LocalStorage] reorderWorkspaceCollections:', { count: collectionPaths.length });
  return ipcRenderer.invoke('renderer:reorder-workspace-collections', workspacePathname, collectionPaths);
};

export const saveCollectionSecurityConfig = async (pathname, securityConfig) => {
  console.log('[LocalStorage] saveCollectionSecurityConfig:', { pathname });
  return ipcRenderer.invoke('renderer:save-collection-security-config', pathname, securityConfig);
};

// OAuth2 operations
export const fetchOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log('[LocalStorage] fetchOAuth2Credentials:', { itemUid });
  return ipcRenderer.invoke('renderer:fetch-oauth2-credentials', { itemUid, request, collection });
};

export const refreshOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log('[LocalStorage] refreshOAuth2Credentials:', { itemUid });
  return ipcRenderer.invoke('renderer:refresh-oauth2-credentials', { itemUid, request, collection });
};

export const isOAuth2AuthorizationInProgress = async () => {
  console.log('[LocalStorage] isOAuth2AuthorizationInProgress');
  return ipcRenderer.invoke('renderer:is-oauth2-authorization-request-in-progress');
};

export const cancelOAuth2Authorization = async () => {
  console.log('[LocalStorage] cancelOAuth2Authorization');
  return ipcRenderer.invoke('renderer:cancel-oauth2-authorization-request');
};

// Dotenv operations
export const saveDotenvVariables = async (pathname, variables, filename) => {
  console.log('[LocalStorage] saveDotenvVariables:', { pathname, filename });
  return ipcRenderer.invoke('renderer:save-dotenv-variables', pathname, variables, filename);
};

export const saveDotenvRaw = async (pathname, content, filename) => {
  console.log('[LocalStorage] saveDotenvRaw:', { pathname, filename });
  return ipcRenderer.invoke('renderer:save-dotenv-raw', pathname, content, filename);
};

export const createDotenvFile = async (pathname, filename) => {
  console.log('[LocalStorage] createDotenvFile:', { pathname, filename });
  return ipcRenderer.invoke('renderer:create-dotenv-file', pathname, filename);
};

export const deleteDotenvFile = async (pathname, filename) => {
  console.log('[LocalStorage] deleteDotenvFile:', { pathname, filename });
  return ipcRenderer.invoke('renderer:delete-dotenv-file', pathname, filename);
};

// Git operations
export const cloneGitRepository = async (data) => {
  console.log('[LocalStorage] cloneGitRepository');
  return ipcRenderer.invoke('renderer:clone-git-repository', data);
};

export const scanForBrunoFiles = async (dir) => {
  console.log('[LocalStorage] scanForBrunoFiles:', { dir });
  return ipcRenderer.invoke('renderer:scan-for-bruno-files', dir);
};

// Mount collection
export const mountCollection = async ({ collectionUid, collectionPathname, brunoConfig }) => {
  console.log('[LocalStorage] mountCollection:', { collectionUid });
  return ipcRenderer.invoke('renderer:mount-collection', { collectionUid, collectionPathname, brunoConfig });
};

// New request file operations
export const newRequestFile = async (fullName, item) => {
  console.log('[LocalStorage] newRequestFile:', { fullName });
  return ipcRenderer.invoke('renderer:new-request', fullName, item);
};

// gRPC operations
export const loadMethodsReflection = async ({ request, collection, environment, runtimeVariables }) => {
  console.log('[LocalStorage] loadMethodsReflection');
  return ipcRenderer.invoke('grpc:load-methods-reflection', { request, collection, environment, runtimeVariables });
};

export const generateGrpcurl = async ({ request, collection, environment, runtimeVariables }) => {
  console.log('[LocalStorage] generateGrpcurl');
  return ipcRenderer.invoke('grpc:generate-grpcurl', { request, collection, environment, runtimeVariables });
};

// OAuth2 cache
export const clearOAuth2Cache = async (collectionUid, url, credentialsId) => {
  console.log('[LocalStorage] clearOAuth2Cache:', { collectionUid });
  return ipcRenderer.invoke('clear-oauth2-cache', collectionUid, url, credentialsId);
};

// Preferences
export const savePreferences = async (preferences) => {
  console.log('[LocalStorage] savePreferences:', preferences);
  return ipcRenderer.invoke('renderer:save-preferences', preferences);
};

// Collection import helper
export const parseCollectionImport = async (collection, format) => {
  console.log('[LocalStorage] parseCollectionImport:', { format });
  return ipcRenderer.invoke('renderer:parse-collection-import', collection, format);
};

// System operations (always local - cookies, proxy, quit flow)
export const deleteCookiesForDomain = async (domain) => {
  console.log('[LocalStorage] deleteCookiesForDomain:', { domain });
  return ipcRenderer.invoke('renderer:delete-cookies-for-domain', domain);
};

export const deleteCookie = async (domain, path, cookieKey) => {
  console.log('[LocalStorage] deleteCookie:', { domain, path, cookieKey });
  return ipcRenderer.invoke('renderer:delete-cookie', domain, path, cookieKey);
};

export const addCookie = async (domain, cookie) => {
  console.log('[LocalStorage] addCookie:', { domain });
  return ipcRenderer.invoke('renderer:add-cookie', domain, cookie);
};

export const modifyCookie = async (domain, oldCookie, cookie) => {
  console.log('[LocalStorage] modifyCookie:', { domain });
  return ipcRenderer.invoke('renderer:modify-cookie', domain, oldCookie, cookie);
};

export const getParsedCookie = async (cookieStr) => {
  console.log('[LocalStorage] getParsedCookie');
  return ipcRenderer.invoke('renderer:get-parsed-cookie', cookieStr);
};

export const createCookieString = async (cookieObj) => {
  console.log('[LocalStorage] createCookieString');
  return ipcRenderer.invoke('renderer:create-cookie-string', cookieObj);
};

export const completeQuitFlow = async () => {
  console.log('[LocalStorage] completeQuitFlow');
  return ipcRenderer.invoke('main:complete-quit-flow');
};

export const getSystemProxyVariables = async () => {
  console.log('[LocalStorage] getSystemProxyVariables');
  return ipcRenderer.invoke('renderer:get-system-proxy-variables');
};

export const refreshSystemProxy = async () => {
  console.log('[LocalStorage] refreshSystemProxy');
  return ipcRenderer.invoke('renderer:refresh-system-proxy');
};

// Auth token operations (always local - secure storage)
export const saveAuthTokens = async (tokens) => {
  console.log('[LocalStorage] saveAuthTokens');
  return ipcRenderer.invoke('auth:save-tokens', tokens);
};

export const getAuthTokens = async () => {
  console.log('[LocalStorage] getAuthTokens');
  return ipcRenderer.invoke('auth:get-tokens');
};

export const clearAuthTokens = async () => {
  console.log('[LocalStorage] clearAuthTokens');
  return ipcRenderer.invoke('auth:clear-tokens');
};

// Workspace link operations (local storage for cloud workspace links)
export const saveWorkspaceLink = async (linkData) => {
  console.log('[LocalStorage] saveWorkspaceLink:', linkData);
  return ipcRenderer.invoke('workspace:save-link', linkData);
};

export const removeWorkspaceLink = async (linkData) => {
  console.log('[LocalStorage] removeWorkspaceLink:', linkData);
  return ipcRenderer.invoke('workspace:remove-link', linkData);
};

export const getWorkspaceLinks = async () => {
  console.log('[LocalStorage] getWorkspaceLinks');
  return ipcRenderer.invoke('workspace:get-links');
};

// Workspace operations (local filesystem - not applicable to cloud mode)
export const createWorkspace = async (workspaceName, workspacePath) => {
  console.log('[LocalStorage] createWorkspace:', { workspaceName, workspacePath });
  return ipcRenderer.invoke('renderer:create-workspace', workspaceName, workspacePath);
};

export const openWorkspace = async (workspacePath) => {
  console.log('[LocalStorage] openWorkspace:', { workspacePath });
  return ipcRenderer.invoke('renderer:open-workspace', workspacePath);
};

export const openWorkspaceDialog = async () => {
  console.log('[LocalStorage] openWorkspaceDialog');
  return ipcRenderer.invoke('renderer:open-workspace-dialog');
};

export const removeCollectionFromWorkspace = async (workspaceUid, workspacePath, collectionPath, options = {}) => {
  console.log('[LocalStorage] removeCollectionFromWorkspace:', { workspaceUid, workspacePath, collectionPath, options });
  return ipcRenderer.invoke('renderer:remove-collection-from-workspace', workspaceUid, workspacePath, collectionPath, options);
};

export const loadWorkspaceApiSpecs = async (workspacePath) => {
  console.log('[LocalStorage] loadWorkspaceApiSpecs:', { workspacePath });
  return ipcRenderer.invoke('renderer:load-workspace-apispecs', workspacePath);
};

export const openApiSpecFile = async (apiSpecPath, workspacePath) => {
  console.log('[LocalStorage] openApiSpecFile:', { apiSpecPath, workspacePath });
  return ipcRenderer.invoke('renderer:open-api-spec-file', apiSpecPath, workspacePath);
};

export const getGlobalEnvironments = async (workspacePath) => {
  console.log('[LocalStorage] getGlobalEnvironments:', { workspacePath });
  return ipcRenderer.invoke('renderer:get-global-environments', workspacePath);
};

export const loadWorkspaceCollections = async (workspacePath) => {
  console.log('[LocalStorage] loadWorkspaceCollections:', { workspacePath });
  return ipcRenderer.invoke('renderer:load-workspace-collections', workspacePath);
};

export const getLastOpenedWorkspaces = async () => {
  console.log('[LocalStorage] getLastOpenedWorkspaces');
  return ipcRenderer.invoke('renderer:get-last-opened-workspaces');
};

export const startWorkspaceWatcher = async (workspacePath) => {
  console.log('[LocalStorage] startWorkspaceWatcher:', { workspacePath });
  return ipcRenderer.invoke('renderer:start-workspace-watcher', workspacePath);
};

export const saveWorkspaceDocs = async (workspacePath, docs) => {
  console.log('[LocalStorage] saveWorkspaceDocs:', { workspacePath });
  return ipcRenderer.invoke('renderer:save-workspace-docs', workspacePath, docs);
};

export const renameWorkspace = async (...args) => {
  console.log('[LocalStorage] renameWorkspace:', args);
  return ipcRenderer.invoke('renderer:rename-workspace', ...args);
};

export const closeWorkspace = async (workspacePath) => {
  console.log('[LocalStorage] closeWorkspace:', { workspacePath });
  return ipcRenderer.invoke('renderer:close-workspace', workspacePath);
};

export const loadWorkspaceEnvironments = async (workspacePath) => {
  console.log('[LocalStorage] loadWorkspaceEnvironments:', { workspacePath });
  return ipcRenderer.invoke('renderer:load-workspace-environments', workspacePath);
};

export const createWorkspaceEnvironment = async (workspacePath, environmentName) => {
  console.log('[LocalStorage] createWorkspaceEnvironment:', { workspacePath, environmentName });
  return ipcRenderer.invoke('renderer:create-workspace-environment', workspacePath, environmentName);
};

export const deleteWorkspaceEnvironment = async (workspacePath, environmentUid) => {
  console.log('[LocalStorage] deleteWorkspaceEnvironment:', { workspacePath, environmentUid });
  return ipcRenderer.invoke('renderer:delete-workspace-environment', workspacePath, environmentUid);
};

export const selectWorkspaceEnvironment = async (workspacePath, environmentUid) => {
  console.log('[LocalStorage] selectWorkspaceEnvironment:', { workspacePath, environmentUid });
  return ipcRenderer.invoke('renderer:select-workspace-environment', workspacePath, environmentUid);
};

export const importWorkspaceEnvironment = async (workspacePath, environmentData) => {
  console.log('[LocalStorage] importWorkspaceEnvironment:', { workspacePath });
  return ipcRenderer.invoke('renderer:import-workspace-environment', workspacePath, environmentData);
};

export const updateWorkspaceEnvironment = async (workspacePath, environmentUid, environmentData) => {
  console.log('[LocalStorage] updateWorkspaceEnvironment:', { workspacePath, environmentUid });
  return ipcRenderer.invoke('renderer:update-workspace-environment', workspacePath, environmentUid, environmentData);
};

export const renameWorkspaceEnvironment = async (workspacePath, environmentUid, newName) => {
  console.log('[LocalStorage] renameWorkspaceEnvironment:', { workspacePath, environmentUid, newName });
  return ipcRenderer.invoke('renderer:rename-workspace-environment', workspacePath, environmentUid, newName);
};

export const copyWorkspaceEnvironment = async (workspacePath, environmentUid, newName) => {
  console.log('[LocalStorage] copyWorkspaceEnvironment:', { workspacePath, environmentUid, newName });
  return ipcRenderer.invoke('renderer:copy-workspace-environment', workspacePath, environmentUid, newName);
};

export const exportWorkspace = async (workspacePath, workspaceName) => {
  console.log('[LocalStorage] exportWorkspace:', { workspacePath, workspaceName });
  return ipcRenderer.invoke('renderer:export-workspace', workspacePath, workspaceName);
};

export const importWorkspace = async (zipFilePath, extractLocation) => {
  console.log('[LocalStorage] importWorkspace:', { zipFilePath, extractLocation });
  return ipcRenderer.invoke('renderer:import-workspace', zipFilePath, extractLocation);
};

export const mountWorkspaceScratch = async (params) => {
  console.log('[LocalStorage] mountWorkspaceScratch:', params);
  return ipcRenderer.invoke('renderer:mount-workspace-scratch', params);
};

export const addCollectionWatcher = async (params) => {
  console.log('[LocalStorage] addCollectionWatcher:', params);
  return ipcRenderer.invoke('renderer:add-collection-watcher', params);
};

export const saveWorkspaceDotEnvVariables = async (params) => {
  console.log('[LocalStorage] saveWorkspaceDotEnvVariables:', params);
  return ipcRenderer.invoke('renderer:save-workspace-dotenv-variables', params);
};

export const saveWorkspaceDotEnvRaw = async (params) => {
  console.log('[LocalStorage] saveWorkspaceDotEnvRaw:', params);
  return ipcRenderer.invoke('renderer:save-workspace-dotenv-raw', params);
};

export const createWorkspaceDotEnvFile = async (params) => {
  console.log('[LocalStorage] createWorkspaceDotEnvFile:', params);
  return ipcRenderer.invoke('renderer:create-workspace-dotenv-file', params);
};

export const deleteWorkspaceDotEnvFile = async (params) => {
  console.log('[LocalStorage] deleteWorkspaceDotEnvFile:', params);
  return ipcRenderer.invoke('renderer:delete-workspace-dotenv-file', params);
};

export const fetchNotifications = async () => {
  console.log('[LocalStorage] fetchNotifications');
  return ipcRenderer.invoke('renderer:fetch-notifications');
};

export const createGlobalEnvironment = async (params) => {
  console.log('[LocalStorage] createGlobalEnvironment:', params);
  return ipcRenderer.invoke('renderer:create-global-environment', params);
};

export const renameGlobalEnvironment = async (params) => {
  console.log('[LocalStorage] renameGlobalEnvironment:', params);
  return ipcRenderer.invoke('renderer:rename-global-environment', params);
};

export const saveGlobalEnvironment = async (params) => {
  console.log('[LocalStorage] saveGlobalEnvironment:', params);
  return ipcRenderer.invoke('renderer:save-global-environment', params);
};

export const updateGlobalEnvironmentColor = async (params) => {
  console.log('[LocalStorage] updateGlobalEnvironmentColor:', params);
  return ipcRenderer.invoke('renderer:update-global-environment-color', params);
};

export const selectGlobalEnvironment = async (params) => {
  console.log('[LocalStorage] selectGlobalEnvironment:', params);
  return ipcRenderer.invoke('renderer:select-global-environment', params);
};

export const deleteGlobalEnvironment = async (params) => {
  console.log('[LocalStorage] deleteGlobalEnvironment:', params);
  return ipcRenderer.invoke('renderer:delete-global-environment', params);
};

export const getCollectionJson = async (collectionLocation) => {
  console.log('[LocalStorage] getCollectionJson:', { collectionLocation });
  return ipcRenderer.invoke('renderer:get-collection-json', collectionLocation);
};

export const openApiSpec = async (workspacePath) => {
  console.log('[LocalStorage] openApiSpec:', { workspacePath });
  return ipcRenderer.invoke('renderer:open-api-spec', workspacePath);
};

export const createApiSpec = async (apiSpecName, apiSpecLocation, content, workspacePath) => {
  console.log('[LocalStorage] createApiSpec:', { apiSpecName, apiSpecLocation, workspacePath });
  return ipcRenderer.invoke('renderer:create-api-spec', apiSpecName, apiSpecLocation, content, workspacePath);
};

export const saveApiSpec = async (pathname, content) => {
  console.log('[LocalStorage] saveApiSpec:', { pathname });
  return ipcRenderer.invoke('renderer:save-api-spec', pathname, content);
};

export const removeApiSpec = async (pathname, workspacePath) => {
  console.log('[LocalStorage] removeApiSpec:', { pathname, workspacePath });
  return ipcRenderer.invoke('renderer:remove-api-spec', pathname, workspacePath);
};

export const saveTransientRequest = async (params) => {
  console.log('[LocalStorage] saveTransientRequest:', params);
  return ipcRenderer.invoke('renderer:save-transient-request', params);
};

export const ensureCollectionsFolder = async (workspacePath) => {
  console.log('[LocalStorage] ensureCollectionsFolder:', { workspacePath });
  return ipcRenderer.invoke('renderer:ensure-collections-folder', workspacePath);
};

export const exportCollectionZip = async (collectionPath, collectionName) => {
  console.log('[LocalStorage] exportCollectionZip:', { collectionPath, collectionName });
  return ipcRenderer.invoke('renderer:export-collection-zip', collectionPath, collectionName);
};

export const isBrunoCollectionZip = async (filePath) => {
  console.log('[LocalStorage] isBrunoCollectionZip:', { filePath });
  return ipcRenderer.invoke('renderer:is-bruno-collection-zip', filePath);
};

export const ensureApispecFolder = async (workspacePath) => {
  console.log('[LocalStorage] ensureApispecFolder:', { workspacePath });
  return ipcRenderer.invoke('renderer:ensure-apispec-folder', workspacePath);
};

export const appReady = async () => {
  console.log('[LocalStorage] appReady');
  return ipcRenderer.invoke('renderer:ready');
};
