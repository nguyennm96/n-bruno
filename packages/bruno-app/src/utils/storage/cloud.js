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
  transformCloudEnvironmentToLocal,
  transformLocalItemToCloud,
  transformLocalExampleToCloud,
  transformCloudExampleToLocal,
  createDefaultRequest,
  createDefaultSettings
} from './transform';
import { transformError } from './errors';
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
  const workspaceId = state.workspaces?.activeWorkspaceUid;
  if (!workspaceId) {
    throw new Error('No cloud workspace selected');
  }
  return workspaceId;
};

/**
 * Update a single item inside a cached cloud collection (best-effort, never throws).
 * @param {string} collectionUid
 * @param {Function} updater — (items: Array) => Array  — returns new items array
 */
async function updateCachedCollectionItems(collectionUid, updater) {
  try {
    const { getCachedCloudCollection, cacheCloudCollection } = await import('utils/cache/indexedDB');
    const cached = await getCachedCloudCollection(collectionUid);
    if (cached) {
      cached.items = updater(cached.items || []);
      await cacheCloudCollection(cached);
    }
  } catch (_) {
    // cache update is best-effort
  }
}

/**
 * Wrapper to handle errors consistently across all cloud operations
 * Transforms cloud errors to standard format and logs them
 *
 * Usage:
 *   export const myOperation = withErrorHandler('myOperation', async (arg1, arg2) => {
 *     // ... implementation ...
 *   });
 *
 * Or use directly in try-catch:
 *   try {
 *     await someCloudOperation();
 *   } catch (error) {
 *     throw transformError(error, 'cloud');
 *   }
 */
export const withErrorHandler = (operationName, fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`❌ [CloudStorage] Error in ${operationName}:`, error);

      // Transform error to standard format
      const transformedError = transformError(error, 'cloud');

      // Re-throw transformed error
      throw transformedError;
    }
  };
};

// Export transformError for direct use
export { transformError };

/**
 * Recursively attach cloud examples to matching request items in a collection tree.
 * @param {object} collection - Local collection object with items[]
 * @param {Array} cloudExamples - Array of cloud example objects from API
 */
function attachExamplesToCollection(collection, cloudExamples) {
  // Group examples by requestUid for O(1) lookup
  const byRequestUid = {};
  for (const ex of cloudExamples) {
    if (!byRequestUid[ex.requestUid]) byRequestUid[ex.requestUid] = [];
    byRequestUid[ex.requestUid].push(ex);
  }

  function attachToItems(items) {
    for (const item of items) {
      if (item.type !== 'folder' && byRequestUid[item.uid]) {
        item.examples = byRequestUid[item.uid].map(transformCloudExampleToLocal);
      }
      if (item.items?.length) {
        attachToItems(item.items);
      }
    }
  }

  attachToItems(collection.items || []);
}

export const getCollections = async (getState) => {
  const brunoApi = getBrunoApi();
  const workspaceId = getSelectedWorkspace(getState);

  console.log(`☁️  [CloudStorage] Fetching collections for workspace: ${workspaceId}`);

  // Fetch collections tree from cloud
  const cloudCollections = await brunoApi.collections.getCollectionsTreeByWorkspace(workspaceId);

  // Transform cloud collections to match local format using transformation layer
  const transformedCollections = await Promise.all(cloudCollections.map(async (collection) => {
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

    // Fetch and attach examples to request items
    try {
      const cloudExamples = await brunoApi.examples.listForCollection(collection.uid);
      if (cloudExamples && cloudExamples.length > 0) {
        attachExamplesToCollection(transformed, cloudExamples);
      }
    } catch (e) {
      console.warn(`⚠️  [CloudStorage] Failed to fetch examples for collection ${collection.uid}:`, e);
    }

    return transformed;
  }));

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
    pathname: collection.uid
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
    pathname: updated.uid
  };
};

export const deleteCollection = async (collectionUid, getState) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Deleting collection: ${collectionUid}`);

  await brunoApi.collections.deleteCollection(collectionUid);

  console.log(`✅ [CloudStorage] Collection deleted`);
};

export const removeCollection = async (pathname, collectionUid, workspaceId) => {
  console.log(`☁️  [CloudStorage] removeCollection:`, { pathname, collectionUid, workspaceId });
  // In cloud mode, workspace/collection membership is managed server-side.
  // The collection is removed from the workspace when deleted via deleteCollection.
  // No explicit workspace-membership removal endpoint exists in the API.
  console.log(`✅ [CloudStorage] Collection removed from workspace`);
};

export const cloneCollection = async (collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid, getState) => {
  const brunoApi = getBrunoApi();
  const state = getState();

  console.log(`☁️  [CloudStorage] Cloning collection: ${collectionUid || previousPath}`);

  // Find source collection by uid or pathname
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

  const sourceCollectionId = sourceCollection.pathname;

  // Use the server's clone endpoint which deep-copies all items
  const clonedCollection = await brunoApi.collections.cloneCollection(sourceCollectionId, {
    name: collectionName
  });

  console.log(`✅ [CloudStorage] Collection cloned: ${clonedCollection.uid}`);

  // Fetch items and environments for the cloned collection so caller can mount it into Redux
  let items = [];
  let environments = [];
  try {
    const tree = await brunoApi.collections.getCollectionsTreeByWorkspace(sourceCollection.workspaceUid || clonedCollection.workspaceUid);
    const clonedTree = tree.find((c) => c.uid === clonedCollection.uid);
    if (clonedTree) {
      items = (clonedTree.items || []).map((item) => transformCloudItemToLocal(item, clonedCollection.uid));
    }
  } catch (e) {
    console.warn('⚠️  [CloudStorage] cloneCollection: could not fetch cloned items', e?.message);
  }
  try {
    const rawEnvs = await brunoApi.environments.listCollectionEnvironments(clonedCollection.uid);
    environments = rawEnvs.map(transformCloudEnvironmentToLocal);
  } catch (e) {
    console.warn('⚠️  [CloudStorage] cloneCollection: could not fetch environments', e?.message);
  }

  return {
    ...clonedCollection,
    items,
    environments,
    isCloud: true,
    pathname: clonedCollection.uid
  };
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
    pathname: updated.uid
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
    parentUid: parentFolderId,
    seq: sortOrder
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
    parentUid: parentFolderId,
    seq: sortOrder,
    request: createDefaultRequest(method, url),
    settings: createDefaultSettings()
  };

  const request = await brunoApi.collections.createRequest(collectionUid, requestPayload);

  console.log(`✅ [CloudStorage] Request created with ID: ${request.uid}`);

  // Transform response to match local schema
  return transformCloudItemToLocal({ ...request, item_subtype: type }, collectionUid);
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
 * @param {object} options - Additional options
 * @param {Array} options.previousExamples - Previous examples array for diffing
 */
export const saveRequest = async (itemUid, itemData, format, options = {}) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Saving request: ${itemUid}`);

  const flatData = transformLocalItemToCloud(itemData);
  const updated = await brunoApi.collections.updateItem(itemUid, flatData);

  console.log(`✅ [CloudStorage] Request saved`);

  // Sync examples to cloud
  const newExamples = itemData.examples || [];
  const prevExamples = options.previousExamples || [];

  if (newExamples.length > 0 || prevExamples.length > 0) {
    await syncExamplesToCloud(brunoApi, itemUid, prevExamples, newExamples);
  }

  // Update IDB cache
  const collectionUid = itemData.collectionUid || itemData.collection_id;
  if (collectionUid) {
    updateCachedCollectionItems(collectionUid, (items) =>
      items.map((i) => (i.uid === itemUid ? { ...i, ...itemData } : i))
    );
  }

  return updated;
};

/**
 * Sync local examples array to cloud by computing a diff against current cloud state.
 * Creates new, updates changed, and deletes removed examples.
 */
async function syncExamplesToCloud(brunoApi, itemUid, _prevExamples, nextExamples) {
  // Fetch current cloud examples to compute accurate diff
  let cloudExamples = [];
  try {
    cloudExamples = await brunoApi.examples.list(itemUid);
  } catch (_) {
    // If fetch fails, assume empty (will create all)
  }

  const cloudMap = new Map((cloudExamples || []).map((e) => [e.uid, e]));
  const nextMap = new Map((nextExamples || []).map((e) => [e.uid, e]));

  const creates = [];
  const updates = [];
  const deletes = [];

  for (const [uid, example] of nextMap) {
    if (!cloudMap.has(uid)) {
      creates.push(example);
    } else {
      updates.push(example);
    }
  }

  for (const [uid] of cloudMap) {
    if (!nextMap.has(uid)) {
      deletes.push(uid);
    }
  }

  await Promise.allSettled([
    ...creates.map((ex) => brunoApi.examples.create(itemUid, transformLocalExampleToCloud(ex))),
    ...updates.map((ex) => brunoApi.examples.update(ex.uid, transformLocalExampleToCloud(ex))),
    ...deletes.map((uid) => brunoApi.examples.delete(uid))
  ]);

  if (creates.length || updates.length || deletes.length) {
    console.log(`✅ [CloudStorage] Examples synced: +${creates.length} ~${updates.length} -${deletes.length}`);
  }
}

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

  // Update IDB cache
  if (collectionUid) {
    updateCachedCollectionItems(collectionUid, (items) => items.filter((i) => i.uid !== itemUid));
  }
};

export const moveItem = async (params, getState) => {
  const brunoApi = getBrunoApi();
  const { itemUid, targetParentItemId } = params;

  console.log(`☁️  [CloudStorage] Moving item: ${itemUid}`);

  await brunoApi.collections.updateItem(itemUid, {
    parentUid: targetParentItemId || null
  });

  console.log(`✅ [CloudStorage] Item moved`);
};

export const renameItemName = async (itemUid, newName, collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming item display name: ${itemUid}`);

  const result = await brunoApi.collections.updateItem(itemUid, { name: newName });

  console.log(`✅ [CloudStorage] Item display name renamed`);

  // Update IDB cache
  if (collectionUid) {
    updateCachedCollectionItems(collectionUid, (items) =>
      items.map((i) => (i.uid === itemUid ? { ...i, name: newName } : i))
    );
  }

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

  const flatData = transformLocalItemToCloud(itemData);
  const collectionUid = itemData.collectionUid || itemData.collection_id || itemData.collection || flatData.collectionUid || flatData.collection_id || flatData.collection;
  if (!collectionUid) {
    throw new Error('Missing collectionUid when creating request');
  }
  const result = await brunoApi.collections.createRequest(collectionUid, flatData);
  console.log(`✅ [CloudStorage] Request created`);

  const localItem = transformCloudItemToLocal({ ...result, item_subtype: itemData.type }, collectionUid);

  // Update IDB cache
  updateCachedCollectionItems(collectionUid, (items) => [...items, localItem]);

  return localItem;
};

export const cloneFolder = async (sourceItem, targetPath, collectionUid) => {
  const brunoApi = getBrunoApi();
  const collectionId = collectionUid;

  console.log(`☁️  [CloudStorage] Cloning folder: ${sourceItem.uid} into collection: ${collectionId}`);

  const cloneFolderRecursive = async (item, parentId) => {
    const newFolder = await brunoApi.collections.createFolder(collectionId, {
      name: item.name,
      parentUid: parentId
    });

    const clonedChildren = [];
    if (item.items?.length) {
      for (const child of item.items) {
        if (child.type === 'folder') {
          const clonedChild = await cloneFolderRecursive(child, newFolder.uid);
          clonedChildren.push(clonedChild);
        } else {
          const childData = transformLocalItemToCloud(child);
          childData.parentUid = newFolder.uid;
          const createdChild = await brunoApi.collections.createRequest(collectionId, childData);
          clonedChildren.push(transformCloudItemToLocal({ ...createdChild, item_subtype: child.type }, collectionId));
        }
      }
    }

    return transformCloudItemToLocal({ ...newFolder, items: clonedChildren }, collectionId);
  };

  const result = await cloneFolderRecursive(sourceItem, null);

  console.log(`✅ [CloudStorage] Folder cloned: ${result.uid}`);

  return result;
};

export const resequenceItems = async (itemsToResequence, collectionPathname) => {
  const brunoApi = getBrunoApi();
  const collectionId = collectionPathname;

  console.log(`☁️  [CloudStorage] Resequencing ${itemsToResequence.length} items in collection: ${collectionId}`);

  await brunoApi.collections.resequenceItems(collectionId, {
    items: itemsToResequence.map((item) => ({
      uid: item.uid,
      seq: item.seq
    }))
  });

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
      parentUid: sourceItem.parentUid,
      seq: sourceItem.seq || 0
    });
  } else {
    return await brunoApi.collections.createRequest(collectionUid, {
      name: newName,
      method: sourceItem.request?.method || 'GET',
      url: sourceItem.request?.url || '',
      parentUid: sourceItem.parentUid,
      seq: sourceItem.seq || 0
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

export const renameEnvironment = async (pathname, oldName, newName, envUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Renaming environment: ${oldName} -> ${newName}`);

  let envId = envUid;
  if (!envId) {
    const collectionId = pathname;
    const environments = await brunoApi.environments.listCollectionEnvironments(collectionId);
    const env = environments.find((e) => e.name === oldName);
    if (!env) throw new Error(`Environment '${oldName}' not found`);
    envId = env.uid;
  }

  await brunoApi.environments.updateEnvironment(envId, { name: newName });

  console.log(`✅ [CloudStorage] Environment renamed`);
};

export const saveEnvironment = async (pathname, environmentData) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Saving environment: ${environmentData.name}`);

  // environmentData.uid is the server ID in cloud mode (set during transform)
  const { uid: envId, variables, color, name } = environmentData;
  await brunoApi.environments.updateEnvironment(envId, { name, variables, color });

  console.log(`✅ [CloudStorage] Environment saved`);
};

export const updateEnvironmentColor = async (pathname, environmentName, color, envUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Updating environment color: ${environmentName}`);

  let envId = envUid;
  if (!envId) {
    const collectionId = pathname;
    const environments = await brunoApi.environments.listCollectionEnvironments(collectionId);
    const env = environments.find((e) => e.name === environmentName);
    if (!env) throw new Error(`Environment '${environmentName}' not found`);
    envId = env.uid;
  }

  await brunoApi.environments.updateEnvironment(envId, { color });

  console.log(`✅ [CloudStorage] Environment color updated`);
};

export const saveCollectionRoot = async (collectionPathname, collectionRootData, brunoConfig) => {
  const brunoApi = getBrunoApi();
  const collectionId = collectionPathname;

  console.log(`☁️  [CloudStorage] Saving collection root: ${collectionId}`);

  await brunoApi.collections.updateCollection(collectionId, {
    root: collectionRootData,
    bruno_config: brunoConfig
  });

  console.log(`✅ [CloudStorage] Collection root saved`);
};

export const updateBrunoConfig = async (brunoConfig, collectionPathname, collectionRoot) => {
  const brunoApi = getBrunoApi();
  const collectionId = collectionPathname;

  console.log(`☁️  [CloudStorage] Updating bruno config: ${collectionId}`);

  await brunoApi.collections.updateCollection(collectionId, {
    bruno_config: brunoConfig,
    root: collectionRoot
  });

  console.log(`✅ [CloudStorage] Bruno config updated`);
};

// ── Global (Workspace-Level) Environment Operations ──────────────────────────

export const getGlobalEnvironments = async ({ workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] getGlobalEnvironments:`, { workspaceUid });

  const envs = await brunoApi.environments.listEnvironments(workspaceUid);
  const globalEnvironments = envs.map((e) => ({
    uid: e.uid,
    name: e.name,
    variables: e.variables || [],
    color: e.color || null
  }));

  return { globalEnvironments, activeGlobalEnvironmentUid: null };
};

export const createGlobalEnvironment = async ({ name, uid, variables, color, workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] createGlobalEnvironment:`, { name, workspaceUid });

  const env = await brunoApi.environments.createEnvironment(workspaceUid, {
    name,
    variables: variables || [],
    color: color || null
  });

  // Return with the server-assigned ID so Redux uses it as uid
  return { uid: env.uid, name: env.name, variables: env.variables || [], color: env.color || null };
};

export const renameGlobalEnvironment = async ({ name, environmentUid, workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] renameGlobalEnvironment:`, { environmentUid, name });

  await brunoApi.environments.updateEnvironment(environmentUid, { name });
  return { uid: environmentUid };
};

export const saveGlobalEnvironment = async ({ environmentUid, variables, workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveGlobalEnvironment:`, { environmentUid });

  await brunoApi.environments.updateEnvironment(environmentUid, { variables });
};

export const updateGlobalEnvironmentColor = async ({ environmentUid, color, workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] updateGlobalEnvironmentColor:`, { environmentUid, color });

  await brunoApi.environments.updateEnvironment(environmentUid, { color });
};

export const selectGlobalEnvironment = async ({ environmentUid, workspaceUid }) => {
  // Selection is UI-only state in cloud mode; no server persistence needed
  console.log(`☁️  [CloudStorage] selectGlobalEnvironment (UI only):`, { environmentUid });
};

export const deleteGlobalEnvironment = async ({ environmentUid, workspaceUid }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] deleteGlobalEnvironment:`, { environmentUid });

  await brunoApi.environments.deleteEnvironment(environmentUid);
};

export const openCollection = async (options) => {
  console.log(`☁️  [CloudStorage] openCollection - no-op in cloud mode (collections loaded at workspace open)`);
  // In cloud mode, collections are fully loaded into Redux when a workspace is opened.
  // There is no per-collection "open from file" step needed.
  return { success: true, collections: [] };
};

export const importCollectionZip = async (zipFilePath, collectionLocation) => {
  throw new Error('ZIP import is not supported in cloud mode. Please use Postman or Insomnia format instead.');
};

export const addCollectionToWorkspace = async (workspaceUid, workspaceCollection) => {
  console.log(`☁️  [CloudStorage] addCollectionToWorkspace - no-op in cloud mode (membership managed at creation)`);
  // In cloud mode, collections are associated with their workspace at creation time.
  // There is no separate "add to workspace" endpoint in the API.
};

export const getCollectionSecurityConfig = async (collectionUid) => {
  const brunoApi = getBrunoApi();

  console.log(`☁️  [CloudStorage] Getting security config: ${collectionUid}`);

  const config = await brunoApi.collections.getSecurityConfig(collectionUid);

  console.log(`✅ [CloudStorage] Security config retrieved`);

  return config;
};

export const getCollectionWorkspaces = async (collectionUid) => {
  console.log(`☁️  [CloudStorage] getCollectionWorkspaces - not available via cloud API`);
  // The cloud API does not expose a reverse lookup of workspace by collection.
  // Collections belong to one workspace; callers should use the active workspace.
  return [];
};

export const setCollectionWorkspace = async (collectionUid, workspacePathname) => {
  console.log(`☁️  [CloudStorage] setCollectionWorkspace - no-op in cloud mode (membership managed at creation)`);
  // In cloud mode, a collection's workspace is fixed at creation time.
  // There is no separate "move to workspace" endpoint in the API.
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
  console.log(`☁️  [CloudStorage] clearUserCollections - no-op in cloud mode (collections are server-managed)`);
  // In cloud mode, collections live on the server and are not bulk-deleted client-side.
  // Each collection must be individually deleted via deleteCollection if needed.
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

// Load request operations (cloud mode: items are pre-loaded into Redux on workspace open)
export const loadRequestViaWorker = async ({ collectionUid, pathname }) => {
  console.log(`☁️  [CloudStorage] loadRequestViaWorker - no-op in cloud mode (items pre-loaded in Redux):`, { collectionUid, pathname });
  // In cloud mode, all collection items are fetched and stored in Redux when the workspace
  // is opened. There is no per-request "load from file" step.
  return null;
};

export const loadRequest = async ({ collectionUid, pathname }) => {
  console.log(`☁️  [CloudStorage] loadRequest - no-op in cloud mode (items pre-loaded in Redux):`, { collectionUid, pathname });
  return null;
};

export const loadLargeRequest = async ({ collectionUid, pathname }) => {
  console.log(`☁️  [CloudStorage] loadLargeRequest - no-op in cloud mode (items pre-loaded in Redux):`, { collectionUid, pathname });
  return null;
};

// Save and folder operations
export const saveMultipleRequests = async (itemsToSave) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveMultipleRequests:`, { count: itemsToSave.length });

  const results = [];
  for (const item of itemsToSave) {
    const saved = await brunoApi.collections.updateItem(item.uid, transformLocalItemToCloud(item));
    results.push(saved);
  }

  return { success: { items: results } };
};

export const saveFolderRoot = async (folderData) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveFolderRoot:`, { folderData });

  const folderUid = folderData.folderPathname;
  const root = folderData.root || {};

  // Sync folder docs and any root-level settings via updateItem
  const updated = await brunoApi.collections.updateItem(folderUid, {
    docs: root.docs ?? null,
    // Preserve headers/auth/script/vars/tests from root.request if present
    ...(root.request ? { request: root.request } : {})
  });
  return updated;
};

export const runCollectionFolder = async (collectionUid, folderUid, itemsToRun, options) => {
  console.log(`☁️  [CloudStorage] runCollectionFolder:`, { collectionUid, folderUid });
  // Running collections is handled by the local Electron network stack (IPC), not the cloud API.
  // This function should not be reached — the runner dispatches via the main process directly.
  throw new Error('runCollectionFolder is not available via cloud storage; use the Electron IPC runner instead.');
};

// Environment operations
export const createEnvironment = async (pathname, name, variables, color) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] createEnvironment:`, { pathname, name });

  const collectionId = pathname;
  const environment = await brunoApi.environments.createCollectionEnvironment(collectionId, {
    name,
    variables: variables || [],
    color: color || null
  });

  // Return transformed env so actions.js can update Redux directly (no file watcher in cloud mode)
  return transformCloudEnvironmentToLocal(environment);
};

export const deleteEnvironment = async (pathname, name, envUid) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] deleteEnvironment:`, { pathname, name });

  let envId = envUid;
  if (!envId) {
    const collectionId = pathname;
    const environments = await brunoApi.environments.listCollectionEnvironments(collectionId);
    const env = environments.find((e) => e.name === name);
    if (!env) throw new Error(`Environment '${name}' not found`);
    envId = env.uid;
  }

  await brunoApi.environments.deleteEnvironment(envId);
};

// Variable operations
export const updateVariableInFile = async (pathname, variable, scopeType, collectionRoot, format) => {
  // Runtime variables (request/folder/collection scope) are session-only in cloud mode —
  // they are kept in Redux memory and don't need to be persisted to the server.
  console.log(`☁️  [CloudStorage] updateVariableInFile (no-op in cloud, session-only):`, { pathname, scopeType });
};

// Bruno config operations
export const updateBrunoConfigStorage = async (brunoConfig, pathname, collectionRoot) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] updateBrunoConfigStorage:`, { pathname });

  const collectionId = pathname;
  await brunoApi.collections.updateCollection(collectionId, {
    bruno_config: brunoConfig,
    root: collectionRoot
  });
};

// Workspace operations
export const reorderWorkspaceCollections = async (workspacePathname, collectionPaths) => {
  console.log(`☁️  [CloudStorage] reorderWorkspaceCollections - not yet implemented in cloud API`);
  // Collection reordering within a workspace is not yet supported by the backend API.
  // This is a no-op until a resequence endpoint is available.
  return null;
};

export const saveCollectionSecurityConfig = async (pathname, securityConfig) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveCollectionSecurityConfig:`, { pathname });

  const collectionId = pathname;
  const updated = await brunoApi.collections.updateSecurityConfig(collectionId, securityConfig);

  return updated;
};

// OAuth2 operations
export const fetchOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log(`☁️  [CloudStorage] fetchOAuth2Credentials:`, { itemUid });
  // OAuth2 flows are executed locally by the Electron main process via IPC.
  // The cloud API does not handle OAuth2 credential fetching.
  throw new Error('OAuth2 credential fetching is not available via cloud storage; it is handled by the Electron IPC layer.');
};

export const refreshOAuth2Credentials = async ({ itemUid, request, collection }) => {
  console.log(`☁️  [CloudStorage] refreshOAuth2Credentials:`, { itemUid });
  throw new Error('OAuth2 credential refreshing is not available via cloud storage; it is handled by the Electron IPC layer.');
};

export const isOAuth2AuthorizationInProgress = async () => {
  console.log(`☁️  [CloudStorage] isOAuth2AuthorizationInProgress`);
  // OAuth2 state is tracked in the Electron main process, not in the cloud API.
  return false;
};

export const cancelOAuth2Authorization = async () => {
  console.log(`☁️  [CloudStorage] cancelOAuth2Authorization`);
  // OAuth2 flows are managed by the Electron main process via IPC.
  return { success: true };
};

// Dotenv operations
export const saveDotenvVariables = async (pathname, variables, filename) => {
  console.log(`☁️  [CloudStorage] saveDotenvVariables - no-op in cloud mode (dotenv is local filesystem only)`);
  // .env files are local filesystem artifacts and are not synced to the cloud.
  return null;
};

export const saveDotenvRaw = async (pathname, content, filename) => {
  console.log(`☁️  [CloudStorage] saveDotenvRaw - no-op in cloud mode (dotenv is local filesystem only)`);
  return null;
};

export const createDotenvFile = async (pathname, filename) => {
  console.log(`☁️  [CloudStorage] createDotenvFile - no-op in cloud mode (dotenv is local filesystem only)`);
  return null;
};

export const deleteDotenvFile = async (pathname, filename) => {
  console.log(`☁️  [CloudStorage] deleteDotenvFile - no-op in cloud mode (dotenv is local filesystem only)`);
  return null;
};

export const scanForBrunoFiles = async (dir) => {
  throw new Error('Scanning for Bruno files is not available in cloud mode. This operation requires local filesystem access.');
};

// Mount collection
export const mountCollection = async ({ collectionUid }) => {
  console.log(`☁️  [CloudStorage] mountCollection:`, { collectionUid });
  // Cloud collections don't need filesystem mounting — no-op
  return collectionUid;
};

// New request file operations
export const newRequestFile = async (fullName, item) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] newRequestFile:`, { fullName });

  const flatData = transformLocalItemToCloud(item);
  const collectionUid = item.collectionUid || item.collection_id || flatData.collection_id;
  if (!collectionUid) {
    throw new Error('Missing collectionUid when creating request file');
  }

  const request = await brunoApi.collections.createRequest(collectionUid, flatData);
  return transformCloudItemToLocal({ ...request, item_subtype: item.type }, collectionUid);
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
  console.log(`☁️  [CloudStorage] loadMethodsReflection`);
  // gRPC reflection is executed by the Electron main process via IPC.
  // The cloud API does not expose a gRPC reflection proxy.
  throw new Error('gRPC method reflection is not available via cloud storage; it is handled by the Electron IPC layer.');
};

export const generateGrpcurl = async ({ request, collection, environment, runtimeVariables }) => {
  console.log(`☁️  [CloudStorage] generateGrpcurl`);
  throw new Error('grpcurl generation is not available via cloud storage; it is handled by the Electron IPC layer.');
};

// OAuth2 cache
export const clearOAuth2Cache = async (collectionUid, url, credentialsId) => {
  console.log(`☁️  [CloudStorage] clearOAuth2Cache:`, { collectionUid });
  // OAuth2 cache is managed by the Electron main process via IPC, not the cloud API.
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

export const saveUserCache = async (user) => {
  console.log(`☁️  [CloudStorage] saveUserCache: delegating to LocalStorage`);
  return LocalStorage.saveUserCache(user);
};

export const getUserCache = async () => {
  console.log(`☁️  [CloudStorage] getUserCache: delegating to LocalStorage`);
  return LocalStorage.getUserCache();
};

export const clearUserCache = async () => {
  console.log(`☁️  [CloudStorage] clearUserCache: delegating to LocalStorage`);
  return LocalStorage.clearUserCache();
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
export const createWorkspace = async (workspaceName, _workspaceFolderName, _workspaceLocation) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] createWorkspace: "${workspaceName}"`);
  const workspace = await brunoApi.workspaces.create({ name: workspaceName });
  return {
    workspaceUid: workspace.uid,
    workspacePath: null,
    workspaceConfig: { name: workspace.name, isCloud: true }
  };
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

export const renameWorkspace = async (workspaceUid, newName) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] renameWorkspace: ${workspaceUid} → "${newName}"`);
  await brunoApi.workspaces.update(workspaceUid, { name: newName });
};

export const closeWorkspace = async (workspaceUid) => {
  // Cloud workspaces don't need a local close operation; deletion is handled separately
  console.log(`☁️  [CloudStorage] closeWorkspace (no-op): ${workspaceUid}`);
};

export const deleteCloudWorkspace = async (workspaceUid) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] deleteWorkspace: ${workspaceUid}`);
  await brunoApi.workspaces.delete(workspaceUid);
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

export const saveTransientRequest = async ({ sourcePathname, targetDirname, targetFilename, request }) => {
  const brunoApi = getBrunoApi();
  console.log(`☁️  [CloudStorage] saveTransientRequest: creating request on server`, { targetDirname });

  // targetDirname is the collection uid or folder uid
  const collectionId = targetDirname;

  const flatData = transformLocalItemToCloud({ ...request, collectionUid: collectionId });
  const createdItem = await brunoApi.collections.createRequest(collectionId, flatData);

  console.log(`✅ [CloudStorage] saveTransientRequest: request created`, { uid: createdItem.uid });

  // Remove draft from localStorage
  const { removeDraft } = await import('./cloudDrafts');
  const draftUid = sourcePathname;
  if (draftUid) removeDraft(draftUid);

  return transformCloudItemToLocal({ ...createdItem, item_subtype: request.type }, collectionId);
};

export const ensureCollectionsFolder = async (workspacePath) => {
  throw new Error('Local workspace operations are not available in cloud mode');
};

export const exportCollectionZip = async (collectionPath, collectionName) => {
  const brunoApi = getBrunoApi();
  const collectionId = collectionPath;
  console.log(`☁️  [CloudStorage] exportCollection: ${collectionId}`);

  const blob = await brunoApi.collections.exportCollection(collectionId, 'postman');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${collectionName || 'collection'}.postman_collection.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true };
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
