/**
 * Cloud Storage Implementation
 *
 * Handles data operations using Bruno API for cloud storage.
 * This is used when the user IS authenticated (cloud mode).
 *
 * All cloud responses are transformed to match local schema structure
 * using the transformation layer.
 */

import { addDepth, collapseAllItemsInCollection } from 'utils/collections';
import {
  transformCloudCollectionToLocal,
  transformCloudItemToLocal,
  transformLocalItemToCloud,
  createDefaultRequest,
  createDefaultSettings
} from './transform';
import * as LocalStorage from './local';

const getBrunoApi = () => {
  const brunoApi = window.__BRUNO_API__;
  if (!brunoApi) {
    throw new Error('Bruno API client not initialized');
  }
  return brunoApi;
};

const getSelectedWorkspace = (getState) => {
  const state = getState();
  const workspaceId = state.cloudWorkspaces?.selectedWorkspaceId;
  if (!workspaceId) {
    throw new Error('No cloud workspace selected');
  }
  return workspaceId;
};

export const getCollections = async (getState) => {
  const brunoApi = getBrunoApi();
  const workspaceId = getSelectedWorkspace(getState);

  console.log(`☁️  [CloudStorage] Fetching collections for workspace: ${workspaceId}`);

  // Fetch collections tree from cloud
  const cloudCollections = await brunoApi.collections.getCollectionsTreeByWorkspace(workspaceId);

  // Transform cloud collections to match local format using transformation layer
  const transformedCollections = cloudCollections.map((collection) => {
    // First apply schema transformation
    const transformed = transformCloudCollectionToLocal(collection);

    // Then add UI-specific fields (same as local collections)
    transformed.settingsSelectedTab = 'overview';
    transformed.folderLevelSettingsSelectedTab = {};
    transformed.allTags = [];
    transformed.isLoading = false;
    transformed.importedAt = new Date().getTime();
    transformed.lastAction = null;
    transformed.format = collection.bruno_config?.opencollection ? 'yml' : collection.bruno_config?.format || 'bru';

    // Add depth and collapse state to items (same as local collections)
    collapseAllItemsInCollection(transformed);
    addDepth(transformed.items);

    return transformed;
  });

  console.log(`✅ [CloudStorage] Fetched ${transformedCollections.length} collections`);

  return transformedCollections;
};

export const createCollection = async (name, options = {}, getState) => {
  const brunoApi = getBrunoApi();
  const workspaceId = getSelectedWorkspace(getState);

  console.log(`☁️  [CloudStorage] Creating collection "${name}" in workspace: ${workspaceId}`);

  const collection = await brunoApi.collections.createCollection(workspaceId, {
    name: name || 'New Collection',
    description: options.description || null
  });

  console.log(`✅ [CloudStorage] Collection created:`, collection);

  // Return collection with cloud flag
  return {
    ...collection,
    isCloud: true,
    pathname: `cloud://${collection.id}`
  };
};

export const updateCollection = async (collectionUid, data, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating collection: ${collectionUid}`, data);

  const updated = await brunoApi.collections.updateCollection(collectionUid, data);

  console.log(`✅ [CloudStorage] Collection updated`);

  return {
    ...updated,
    isCloud: true,
    pathname: `cloud://${updated.id}`
  };
};

export const deleteCollection = async (collectionUid, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Deleting collection: ${collectionUid}`);

  await brunoApi.collections.deleteCollection(collectionUid);

  console.log(`✅ [CloudStorage] Collection deleted`);
};

export const removeCollection = async (pathname, collectionUid, workspaceId) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] removeCollection:`, { pathname, collectionUid, workspaceId });

  // In cloud mode, remove collection from workspace
  // pathname is 'cloud://collectionId' format
  const collectionId = pathname.replace('cloud://', '');

  // If workspaceId is not 'default', remove from that workspace
  if (workspaceId !== 'default') {
    await brunoApi.workspaces.removeCollectionFromWorkspace(workspaceId, collectionId);
  }

  console.log(`✅ [CloudStorage] Collection removed from workspace`);
};

export const cloneCollection = async (collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid, getState) => {
  const brunoApi = getBrunoApi();
  const workspaceId = getSelectedWorkspace(getState);
  const state = getState();

  console.log(`☁️  [CloudStorage] Cloning collection: ${collectionUid || collectionName}`);

  // Get the original collection
  const collections = state.collections.collections;
  let sourceCollection = null;

  if (collectionUid) {
    sourceCollection = collections.find((c) => c.uid === collectionUid);
  } else if (previousPath) {
    sourceCollection = collections.find((c) => c.pathname === previousPath);
  }

  if (!sourceCollection) {
    throw new Error('Source collection not found');
  }

  // Clone collection by creating a new one
  // TODO: Copy all items recursively (needs backend support)
  const clonedCollection = await brunoApi.collections.createCollection(workspaceId, {
    name: collectionName,
    description: sourceCollection.description || ''
  });

  console.log(`✅ [CloudStorage] Collection cloned (items not copied - needs backend support)`);

  return clonedCollection;
};

export const importCollection = async (collection, collectionLocation, options, getState) => {
  const brunoApi = getBrunoApi();
  const workspaceId = getSelectedWorkspace(getState);
  const isMultiple = Array.isArray(collection);
  const DEFAULT_COLLECTION_FORMAT = options?.format || 'bru';

  console.log(`☁️  [CloudStorage] Importing collection(s) to cloud`);

  // Parse the collection(s) using LocalStorage (delegates to IPC)
  const result = await LocalStorage.parseCollectionImport(collection, DEFAULT_COLLECTION_FORMAT);
  const parsedCollections = result.success.items;

  // Create each collection in the cloud workspace
  const importedCollections = [];
  for (const parsedCollection of parsedCollections) {
    // Create collection via cloud API
    // TODO: Import all items recursively (needs backend support for bulk import)
    const createdCollection = await brunoApi.collections.createCollection(workspaceId, {
      name: parsedCollection.name,
      description: parsedCollection.description || ''
    });
    importedCollections.push(createdCollection);
  }

  console.log(`✅ [CloudStorage] Collections imported (items not copied - needs backend support)`);

  return isMultiple ? importedCollections : importedCollections[0];
};

export const renameCollection = async (collectionUid, newName, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming collection ${collectionUid} to "${newName}"`);

  const updated = await brunoApi.collections.updateCollection(collectionUid, { name: newName });

  console.log(`✅ [CloudStorage] Collection renamed`);

  return {
    ...updated,
    isCloud: true,
    pathname: `cloud://${updated.id}`
  };
};

export const createFolder = async (collectionUid, folderName, parentFolderId = null, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Creating folder "${folderName}" in collection: ${collectionUid}`);

  // Get current items to determine sort order
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);
  const sortOrder = collection?.items?.length || 0;

  const folder = await brunoApi.collections.createFolder(collectionUid, {
    name: folderName,
    parent_item_id: parentFolderId,
    sort_order: sortOrder
  });

  console.log(`✅ [CloudStorage] Folder created`);

  return folder;
};

export const createRequest = async (collectionUid, requestData, getState) => {
  const brunoApi = getBrunoApi();

  const { name, type = 'http-request', method = 'GET', url = '', parentFolderId = null } = requestData;

  console.log(`☁️  [CloudStorage] Creating ${method} request "${name}" in collection: ${collectionUid}`);

  // Get current items to determine sort order
  const state = getState();
  const collection = state.collections.collections.find((c) => c.uid === collectionUid);
  const sortOrder = collection?.items?.length || 0;

  // Create request with nested structure matching local schema
  const requestPayload = {
    name,
    type: 'request',
    parent_item_id: parentFolderId,
    sort_order: sortOrder,
    request: createDefaultRequest(method, url), // Use transformation helper
    settings: createDefaultSettings(),
    filename: `${name.toLowerCase().replace(/\s+/g, '-')}.bru`
  };

  const request = await brunoApi.collections.createItem(collectionUid, requestPayload);

  console.log(`✅ [CloudStorage] Request created with nested structure`);

  // Transform response to match local schema
  return transformCloudItemToLocal(request, collectionUid);
};

export const updateRequest = async (itemUid, data, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating request: ${itemUid}`);

  const updated = await brunoApi.collections.updateItem(itemUid, data);

  console.log(`✅ [CloudStorage] Request updated`);

  return updated;
};

/**
 * Save request to cloud (for compatibility with saveRequest action)
 * @param {string} itemUid - Item UID (pathname in local mode, but uid in cloud)
 * @param {object} itemData - Request data
 * @param {string} format - Collection format (ignored in cloud mode)
 */
export const saveRequest = async (itemUid, itemData, format) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Saving request: ${itemUid}`);

  // Transform the nested request structure to flat format for API
  const flatData = transformLocalItemToCloud(itemData);

  const updated = await brunoApi.collections.updateItem(itemUid, flatData);

  console.log(`✅ [CloudStorage] Request saved`);

  return updated;
};

export const updateItem = async (itemUid, collectionUid, data, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating item: ${itemUid}`);

  const updated = await brunoApi.collections.updateItem(itemUid, data);

  console.log(`✅ [CloudStorage] Item updated`);

  return updated;
};

export const deleteItem = async (itemUid, collectionUid, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Deleting item: ${itemUid}`);

  await brunoApi.collections.deleteItem(itemUid);

  console.log(`✅ [CloudStorage] Item deleted`);
};

export const moveItem = async (params, getState) => {
  const brunoApi = getBrunoApi();
  const { itemUid, targetParentItemId } = params;

  console.log(`☁️  [CloudStorage] Moving item: ${itemUid}`);

  await brunoApi.collections.updateItem(itemUid, {
    parent_item_id: targetParentItemId || null
  });

  console.log(`✅ [CloudStorage] Item moved`);
};

export const renameItemName = async (itemUid, newName, collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming item display name: ${itemUid}`);

  const result = await brunoApi.collections.updateItem(itemUid, { name: newName });

  console.log(`✅ [CloudStorage] Item display name renamed`);

  return result;
};

export const renameItemFilename = async (itemUid, newPath, newName, newFilename, collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming item filename: ${itemUid}`);

  // In cloud mode, we update both name and any filename-related fields
  const result = await brunoApi.collections.updateItem(itemUid, {
    name: newName,
    filename: newFilename
  });

  console.log(`✅ [CloudStorage] Item filename renamed`);

  return result;
};

export const newRequest = async (itemUid, itemData, format) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Creating new request`);

  // Transform nested structure to flat for API
  const flatData = transformLocalItemToCloud(itemData);

  const result = await brunoApi.collections.createRequest(flatData);

  console.log(`✅ [CloudStorage] Request created`);

  return result;
};

export const cloneFolder = async (sourceItem, targetPath, collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Cloning folder: ${sourceItem.uid}`);

  // Recursively clone folder and all its contents
  const cloneFolderRecursive = async (item, parentId) => {
    const folderData = {
      name: item.name,
      type: 'folder',
      parent_item_id: parentId,
      collection_id: collectionUid
    };

    const newFolder = await brunoApi.collections.createFolder(folderData);

    // Clone all children
    if (item.items?.length) {
      for (const child of item.items) {
        if (child.type === 'folder') {
          await cloneFolderRecursive(child, newFolder.id);
        } else {
          const childData = transformLocalItemToCloud(child);
          childData.parent_item_id = newFolder.id;
          await brunoApi.collections.createRequest(childData);
        }
      }
    }

    return newFolder;
  };

  const result = await cloneFolderRecursive(sourceItem, null);

  console.log(`✅ [CloudStorage] Folder cloned`);

  return result;
};

export const resequenceItems = async (itemsToResequence, collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Resequencing items: ${itemsToResequence.length}`);

  // Update sequence for each item
  const promises = itemsToResequence.map((item) => {
    return brunoApi.collections.updateItem(item.uid, { seq: item.seq });
  });

  await Promise.all(promises);

  console.log(`✅ [CloudStorage] Items resequenced`);
};

export const cloneItem = async (itemUid, collectionUid, newName, getState) => {
  const brunoApi = getBrunoApi();
  const state = getState();

  console.log(`☁️  [CloudStorage] Cloning item: ${itemUid}`);

  // Get the source collection
  const collections = state.collections.collections;
  let sourceCollection = collections.find((c) => c.uid === collectionUid);

  if (!sourceCollection) {
    throw new Error('Source collection not found');
  }

  // Find the item to clone (recursive search would be needed for nested items)
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

  const sourceItem = findItem(sourceCollection.items, itemUid);
  if (!sourceItem) {
    throw new Error('Source item not found');
  }

  // Clone based on item type
  if (sourceItem.type === 'folder') {
    return await brunoApi.collections.createFolder(collectionUid, {
      name: newName,
      parent_item_id: sourceItem.parent_item_id,
      sort_order: sourceItem.seq || 0
    });
  } else {
    return await brunoApi.collections.createRequest(collectionUid, {
      name: newName,
      method: sourceItem.request?.method || 'GET',
      url: sourceItem.request?.url || '',
      parent_item_id: sourceItem.parent_item_id,
      sort_order: sourceItem.seq || 0
    });
  }
};

export const updateEnvironment = async (environmentUid, data, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating environment: ${environmentUid}`);

  const updated = await brunoApi.environments.updateEnvironment(environmentUid, data);

  console.log(`✅ [CloudStorage] Environment updated`);

  return updated;
};

export const renameEnvironment = async (collectionUid, oldName, newName) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming environment: ${oldName} -> ${newName}`);

  // Find environment by old name and update
  const environments = await brunoApi.collections.getEnvironments(collectionUid);
  const env = environments.find((e) => e.name === oldName);

  if (!env) {
    throw new Error('Environment not found');
  }

  await brunoApi.collections.updateEnvironment(env.id, { name: newName });

  console.log(`✅ [CloudStorage] Environment renamed`);
};

export const saveEnvironment = async (collectionUid, environmentData) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Saving environment: ${environmentData.name}`);

  // Check if environment exists
  const environments = await brunoApi.collections.getEnvironments(collectionUid);
  const existingEnv = environments.find((e) => e.name === environmentData.name);

  if (existingEnv) {
    await brunoApi.collections.updateEnvironment(existingEnv.id, environmentData);
  } else {
    await brunoApi.collections.createEnvironment({ ...environmentData, collection_id: collectionUid });
  }

  console.log(`✅ [CloudStorage] Environment saved`);
};

export const updateEnvironmentColor = async (collectionUid, environmentName, color) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating environment color: ${environmentName}`);

  const environments = await brunoApi.collections.getEnvironments(collectionUid);
  const env = environments.find((e) => e.name === environmentName);

  if (!env) {
    throw new Error('Environment not found');
  }

  await brunoApi.collections.updateEnvironment(env.id, { color });

  console.log(`✅ [CloudStorage] Environment color updated`);
};

export const saveCollectionRoot = async (collectionUid, collectionRootData, brunoConfig) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Saving collection root: ${collectionUid}`);

  await brunoApi.collections.updateCollection(collectionUid, collectionRootData);

  console.log(`✅ [CloudStorage] Collection root saved`);
};

export const updateBrunoConfig = async (brunoConfig, collectionUid, collectionRoot) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating bruno config: ${collectionUid}`);

  await brunoApi.collections.updateCollection(collectionUid, { brunoConfig });

  console.log(`✅ [CloudStorage] Bruno config updated`);
};

export const openCollection = async (options) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Opening collection from cloud`);

  // In cloud mode, collections are already loaded
  // This is a no-op or returns current collections
  const collections = await brunoApi.collections.getCollections();

  console.log(`✅ [CloudStorage] Collections loaded`);

  return { success: true, collections };
};

export const importCollectionZip = async (zipFilePath, collectionLocation) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Importing collection from zip to cloud`);

  // Cloud mode: upload zip to server for processing
  const result = await brunoApi.collections.importFromZip(zipFilePath);

  console.log(`✅ [CloudStorage] Collection imported from zip`);

  return result.collectionPath || result.id;
};

export const addCollectionToWorkspace = async (workspaceUid, workspaceCollection) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Adding collection to workspace: ${workspaceUid}`);

  // In cloud mode, workspaces might be handled differently
  // This could be a no-op or a workspace API call
  await brunoApi.workspaces?.addCollection(workspaceUid, workspaceCollection.path);

  console.log(`✅ [CloudStorage] Collection added to workspace`);
};

export const getCollectionSecurityConfig = async (collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Getting security config: ${collectionUid}`);

  const config = await brunoApi.collections.getSecurityConfig(collectionUid);

  console.log(`✅ [CloudStorage] Security config retrieved`);

  return config;
};

export const getCollectionWorkspaces = async (collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Getting workspaces for collection: ${collectionUid}`);

  const workspaces = await brunoApi.workspaces?.getByCollection(collectionUid) || [];

  console.log(`✅ [CloudStorage] Workspaces retrieved`);

  return workspaces;
};

export const setCollectionWorkspace = async (collectionUid, workspacePathname) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] setCollectionWorkspace:`, { collectionUid, workspacePathname });

  // In cloud mode, associate collection with workspace
  // workspacePathname might be a uid in cloud mode
  await brunoApi.workspaces.addCollectionToWorkspace(workspacePathname, collectionUid);

  console.log(`✅ [CloudStorage] Collection associated with workspace`);
};

export const openMultipleCollections = async (collectionPaths, options = {}) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] openMultipleCollections:`, { count: collectionPaths.length });

  // In cloud mode, collectionPaths are collection IDs
  const collections = [];
  for (const collectionId of collectionPaths) {
    const collection = await brunoApi.collections.getCollection(collectionId);
    collections.push(collection);
  }

  console.log(`✅ [CloudStorage] ${collections.length} collections opened`);
  return collections;
};

export const deleteTransientRequests = async (filePaths, tempDir) => {
  console.log(`☁️  [CloudStorage] deleteTransientRequests - N/A in cloud mode`);
  // Transient requests are handled differently in cloud mode
  return { success: [], errors: [] };
};

export const clearUserCollections = async (userId) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] clearUserCollections:`, { userId });

  // Clear all collections for the user
  await brunoApi.collections.clearAllCollections();

  console.log(`✅ [CloudStorage] User collections cleared`);
  return true;
};

// UI/System operations (not applicable in cloud mode, but provide stubs)
export const updateUiStateSnapshot = async (data) => {
  console.log(`☁️  [CloudStorage] updateUiStateSnapshot - N/A in cloud mode`);
  return Promise.resolve();
};

export const browseDirectory = async () => {
  console.log(`☁️  [CloudStorage] browseDirectory - N/A in cloud mode`);
  throw new Error('browseDirectory is not available in cloud mode');
};

export const browseFiles = async (filters, properties) => {
  console.log(`☁️  [CloudStorage] browseFiles - N/A in cloud mode`);
  throw new Error('browseFiles is not available in cloud mode');
};

export const showInFolder = async (collectionPath) => {
  console.log(`☁️  [CloudStorage] showInFolder - N/A in cloud mode`);
  // In cloud mode, could open collection in web interface
  return Promise.resolve();
};

// Load request operations (cloud mode uses different approach)
export const loadRequestViaWorker = async ({ collectionUid, pathname }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] loadRequestViaWorker:`, { collectionUid, pathname });

  // In cloud mode, load request from API
  const request = await brunoApi.requests.getRequest(collectionUid, pathname);
  return request;
};

export const loadRequest = async ({ collectionUid, pathname }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] loadRequest:`, { collectionUid, pathname });

  const request = await brunoApi.requests.getRequest(collectionUid, pathname);
  return request;
};

export const loadLargeRequest = async ({ collectionUid, pathname }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] loadLargeRequest:`, { collectionUid, pathname });

  // For cloud mode, same as regular load (no file size distinction)
  const request = await brunoApi.requests.getRequest(collectionUid, pathname);
  return request;
};

// Save and folder operations
export const saveMultipleRequests = async (itemsToSave) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveMultipleRequests:`, { count: itemsToSave.length });

  // Save multiple requests in batch
  const results = [];
  for (const item of itemsToSave) {
    const saved = await brunoApi.requests.saveRequest(item);
    results.push(saved);
  }

  return { success: { items: results } };
};

export const saveFolderRoot = async (folderData) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveFolderRoot:`, { folderData });

  // Update folder metadata in cloud
  const updated = await brunoApi.folders.updateFolder(folderData);
  return updated;
};

export const runCollectionFolder = async (collectionUid, folderUid, itemsToRun, options) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] runCollectionFolder:`, { collectionUid, folderUid });

  // Cloud mode: use API to run collection folder
  const result = await brunoApi.runner.runCollectionFolder(collectionUid, folderUid, itemsToRun, options);
  return result;
};

// Environment operations
export const createEnvironment = async (pathname, name, variables, color) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] createEnvironment:`, { pathname, name });

  const collectionId = pathname.replace('cloud://', '');
  const environment = await brunoApi.environments.createEnvironment(collectionId, {
    name,
    variables,
    color
  });

  return environment;
};

export const deleteEnvironment = async (pathname, name) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] deleteEnvironment:`, { pathname, name });

  const collectionId = pathname.replace('cloud://', '');
  await brunoApi.environments.deleteEnvironment(collectionId, name);

  return { success: true };
};

// Variable operations
export const updateVariableInFile = async (pathname, variable, scopeType, collectionRoot, format) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] updateVariableInFile:`, { pathname });

  // Update variable in cloud environment
  const updated = await brunoApi.variables.updateVariable(pathname, variable, scopeType);
  return updated;
};

// Bruno config operations
export const updateBrunoConfigStorage = async (brunoConfig, pathname, collectionRoot) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] updateBrunoConfigStorage:`, { pathname });

  const collectionId = pathname.replace('cloud://', '');
  const updated = await brunoApi.collections.updateBrunoConfig(collectionId, brunoConfig);

  return updated;
};

// Workspace operations
export const reorderWorkspaceCollections = async (workspacePathname, collectionPaths) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] reorderWorkspaceCollections:`, { count: collectionPaths.length });

  // Reorder collections in cloud workspace
  const result = await brunoApi.workspaces.reorderCollections(workspacePathname, collectionPaths);
  return result;
};

export const saveCollectionSecurityConfig = async (pathname, securityConfig) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveCollectionSecurityConfig:`, { pathname });

  const collectionId = pathname.replace('cloud://', '');
  const updated = await brunoApi.collections.updateSecurityConfig(collectionId, securityConfig);

  return updated;
};

// OAuth2 operations
export const fetchOAuth2Credentials = async ({ itemUid, request, collection }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] fetchOAuth2Credentials:`, { itemUid });

  // Cloud mode: fetch OAuth2 credentials via API
  const credentials = await brunoApi.auth.fetchOAuth2Credentials({ itemUid, request, collection });
  return credentials;
};

export const refreshOAuth2Credentials = async ({ itemUid, request, collection }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] refreshOAuth2Credentials:`, { itemUid });

  const credentials = await brunoApi.auth.refreshOAuth2Credentials({ itemUid, request, collection });
  return credentials;
};

export const isOAuth2AuthorizationInProgress = async () => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] isOAuth2AuthorizationInProgress`);

  const inProgress = await brunoApi.auth.isOAuth2InProgress();
  return inProgress;
};

export const cancelOAuth2Authorization = async () => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] cancelOAuth2Authorization`);

  await brunoApi.auth.cancelOAuth2Authorization();
  return { success: true };
};

// Dotenv operations
export const saveDotenvVariables = async (pathname, variables, filename) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveDotenvVariables:`, { pathname, filename });

  const collectionId = pathname.replace('cloud://', '');
  const result = await brunoApi.dotenv.saveVariables(collectionId, variables, filename);

  return result;
};

export const saveDotenvRaw = async (pathname, content, filename) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveDotenvRaw:`, { pathname, filename });

  const collectionId = pathname.replace('cloud://', '');
  const result = await brunoApi.dotenv.saveRaw(collectionId, content, filename);

  return result;
};

export const createDotenvFile = async (pathname, filename) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] createDotenvFile:`, { pathname, filename });

  const collectionId = pathname.replace('cloud://', '');
  const result = await brunoApi.dotenv.createFile(collectionId, filename);

  return result;
};

export const deleteDotenvFile = async (pathname, filename) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] deleteDotenvFile:`, { pathname, filename });

  const collectionId = pathname.replace('cloud://', '');
  const result = await brunoApi.dotenv.deleteFile(collectionId, filename);

  return result;
};

// Git operations
export const cloneGitRepository = async (data) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] cloneGitRepository`);

  // Cloud mode: clone Git repository
  const result = await brunoApi.git.cloneRepository(data);
  return result;
};

export const scanForBrunoFiles = async (dir) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] scanForBrunoFiles:`, { dir });

  // Cloud mode: scan for Bruno files
  const files = await brunoApi.git.scanForBrunoFiles(dir);
  return files;
};

// Mount collection
export const mountCollection = async ({ collectionUid, collectionPathname, brunoConfig }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] mountCollection:`, { collectionUid });

  // Cloud mode: mount collection
  const result = await brunoApi.collections.mount({ collectionUid, collectionPathname, brunoConfig });
  return result;
};

// New request file operations
export const newRequestFile = async (fullName, item) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] newRequestFile:`, { fullName });

  // Create new request in cloud
  const request = await brunoApi.requests.createRequest(item);
  return request;
};

// Preferences
export const savePreferences = async (preferences) => {
  console.log(`☁️  [CloudStorage] savePreferences: delegating to LocalStorage`);
  // Preferences are user settings, always stored locally even in cloud mode
  // Delegate to LocalStorage instead of calling IPC directly
  return LocalStorage.savePreferences(preferences);
};

// gRPC operations
export const loadMethodsReflection = async ({ request, collection, environment, runtimeVariables }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] loadMethodsReflection`);

  // Load gRPC methods via reflection
  const methods = await brunoApi.grpc.loadMethodsReflection({ request, collection, environment, runtimeVariables });
  return methods;
};

export const generateGrpcurl = async ({ request, collection, environment, runtimeVariables }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] generateGrpcurl`);

  // Generate grpcurl command
  const command = await brunoApi.grpc.generateGrpcurl({ request, collection, environment, runtimeVariables });
  return command;
};

// OAuth2 cache
export const clearOAuth2Cache = async (collectionUid, url, credentialsId) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] clearOAuth2Cache:`, { collectionUid });

  // Clear OAuth2 cache
  await brunoApi.auth.clearOAuth2Cache(collectionUid, url, credentialsId);
  return { success: true };
};

// System operations (always delegate to local - no cloud equivalent)
export const deleteCookiesForDomain = async (domain) => {
  console.log(`☁️  [CloudStorage] deleteCookiesForDomain: delegating to LocalStorage`);
  return LocalStorage.deleteCookiesForDomain(domain);
};

export const deleteCookie = async (domain, path, cookieKey) => {
  console.log(`☁️  [CloudStorage] deleteCookie: delegating to LocalStorage`);
  return LocalStorage.deleteCookie(domain, path, cookieKey);
};

export const addCookie = async (domain, cookie) => {
  console.log(`☁️  [CloudStorage] addCookie: delegating to LocalStorage`);
  return LocalStorage.addCookie(domain, cookie);
};

export const modifyCookie = async (domain, oldCookie, cookie) => {
  console.log(`☁️  [CloudStorage] modifyCookie: delegating to LocalStorage`);
  return LocalStorage.modifyCookie(domain, oldCookie, cookie);
};

export const getParsedCookie = async (cookieStr) => {
  console.log(`☁️  [CloudStorage] getParsedCookie: delegating to LocalStorage`);
  return LocalStorage.getParsedCookie(cookieStr);
};

export const createCookieString = async (cookieObj) => {
  console.log(`☁️  [CloudStorage] createCookieString: delegating to LocalStorage`);
  return LocalStorage.createCookieString(cookieObj);
};

export const completeQuitFlow = async () => {
  console.log(`☁️  [CloudStorage] completeQuitFlow: delegating to LocalStorage`);
  return LocalStorage.completeQuitFlow();
};

export const getSystemProxyVariables = async () => {
  console.log(`☁️  [CloudStorage] getSystemProxyVariables: delegating to LocalStorage`);
  return LocalStorage.getSystemProxyVariables();
};

export const refreshSystemProxy = async () => {
  console.log(`☁️  [CloudStorage] refreshSystemProxy: delegating to LocalStorage`);
  return LocalStorage.refreshSystemProxy();
};

// Auth token operations (always delegate to local - secure storage)
export const saveAuthTokens = async (tokens) => {
  console.log(`☁️  [CloudStorage] saveAuthTokens: delegating to LocalStorage`);
  return LocalStorage.saveAuthTokens(tokens);
};

export const getAuthTokens = async () => {
  console.log(`☁️  [CloudStorage] getAuthTokens: delegating to LocalStorage`);
  return LocalStorage.getAuthTokens();
};

export const clearAuthTokens = async () => {
  console.log(`☁️  [CloudStorage] clearAuthTokens: delegating to LocalStorage`);
  return LocalStorage.clearAuthTokens();
};

// Workspace link operations (always delegate to local)
export const saveWorkspaceLink = async (linkData) => {
  console.log(`☁️  [CloudStorage] saveWorkspaceLink: delegating to LocalStorage`);
  return LocalStorage.saveWorkspaceLink(linkData);
};

export const removeWorkspaceLink = async (linkData) => {
  console.log(`☁️  [CloudStorage] removeWorkspaceLink: delegating to LocalStorage`);
  return LocalStorage.removeWorkspaceLink(linkData);
};

export const getWorkspaceLinks = async () => {
  console.log(`☁️  [CloudStorage] getWorkspaceLinks: delegating to LocalStorage`);
  return LocalStorage.getWorkspaceLinks();
};

// Workspace operations (local filesystem only - not applicable to cloud)
export const createWorkspace = async (workspaceName, workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const openWorkspace = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const openWorkspaceDialog = async () => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const removeCollectionFromWorkspace = async (workspaceUid, workspacePath, collectionPath, options = {}) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const loadWorkspaceApiSpecs = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const openApiSpecFile = async (apiSpecPath, workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const getGlobalEnvironments = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const loadWorkspaceCollections = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const getLastOpenedWorkspaces = async () => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const startWorkspaceWatcher = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveWorkspaceDocs = async (workspacePath, docs) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const renameWorkspace = async (...args) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const closeWorkspace = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const loadWorkspaceEnvironments = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const createWorkspaceEnvironment = async (workspacePath, environmentName) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const deleteWorkspaceEnvironment = async (workspacePath, environmentUid) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const selectWorkspaceEnvironment = async (workspacePath, environmentUid) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const importWorkspaceEnvironment = async (workspacePath, environmentData) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const updateWorkspaceEnvironment = async (workspacePath, environmentUid, environmentData) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const renameWorkspaceEnvironment = async (workspacePath, environmentUid, newName) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const copyWorkspaceEnvironment = async (workspacePath, environmentUid, newName) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const exportWorkspace = async (workspacePath, workspaceName) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const importWorkspace = async (zipFilePath, extractLocation) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const mountWorkspaceScratch = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const addCollectionWatcher = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveWorkspaceDotEnvVariables = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveWorkspaceDotEnvRaw = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const createWorkspaceDotEnvFile = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const deleteWorkspaceDotEnvFile = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const fetchNotifications = async () => {
  // Delegate to LocalStorage for system notification fetching
  return LocalStorage.fetchNotifications();
};

export const createGlobalEnvironment = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const renameGlobalEnvironment = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveGlobalEnvironment = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const updateGlobalEnvironmentColor = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const selectGlobalEnvironment = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const deleteGlobalEnvironment = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const getCollectionJson = async (collectionLocation) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const openApiSpec = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const createApiSpec = async (apiSpecName, apiSpecLocation, content, workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveApiSpec = async (pathname, content) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const removeApiSpec = async (pathname, workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const saveTransientRequest = async (params) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const ensureCollectionsFolder = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const exportCollectionZip = async (collectionPath, collectionName) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const isBrunoCollectionZip = async (filePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const ensureApispecFolder = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const appReady = async () => {
  // App ready signal - always local
  return LocalStorage.appReady();
};
