import path from 'path';
import { storage } from 'utils/storage';
import {
  createWorkspace,
  removeWorkspace,
  setActiveWorkspace,
  updateWorkspace,
  addCollectionToWorkspace,
  removeCollectionFromWorkspace,
  updateWorkspaceLoadingState,
  setWorkspaceScratchCollection,
  setWorkspaceDotEnvVariables,
  setWorkspaceMembers,
  setWorkspacePendingInvites,
  setMembersLoading
} from '../workspaces';
import { showHomePage } from '../app';
import { createCollection, openCollection, openMultipleCollections, openScratchCollectionEvent } from '../collections/actions';
import { removeCollection, addTransientDirectory, updateCollectionMountStatus, toggleCollection, toggleCollectionItem } from '../collections';
import { updateGlobalEnvironments } from '../global-environments';
import { addTab, focusTab, resetTabs } from '../tabs';
import { normalizePath } from 'utils/common/path';
import toast from 'react-hot-toast';
import { apiSpecAddFileEvent } from '../apiSpec';

const transformCollection = async (collection, type) => {
  switch (type) {
    case 'bruno': {
      const { processBrunoCollection } = await import('utils/importers/bruno-collection');
      return processBrunoCollection(collection);
    }
    case 'postman': {
      const { postmanToBruno } = await import('utils/importers/postman-collection');
      return postmanToBruno(collection);
    }
    case 'insomnia': {
      const { convertInsomniaToBruno } = await import('utils/importers/insomnia-collection');
      return convertInsomniaToBruno(collection);
    }
    case 'openapi': {
      const { convertOpenapiToBruno } = await import('utils/importers/openapi-collection');
      return convertOpenapiToBruno(collection);
    }
    case 'opencollection': {
      const { processOpenCollection } = await import('utils/importers/opencollection');
      return processOpenCollection(collection);
    }
    case 'wsdl': {
      const { wsdlToBruno } = await import('@usebruno/converters');
      return wsdlToBruno(collection);
    }
    default:
      throw new Error(`Unsupported collection type: ${type}`);
  }
};

export const createWorkspaceAction = (workspaceName, workspaceFolderName, workspaceLocation) => {
  return async (dispatch) => {
    try {
      const result = await storage.createWorkspace(
        workspaceName,
        workspaceFolderName,
        workspaceLocation);

      const { workspaceConfig, workspaceUid, workspacePath } = result;

      dispatch(createWorkspace({
        uid: workspaceUid,
        name: workspaceName,
        pathname: workspacePath || null,
        isCloud: workspaceConfig?.isCloud || false,
        ...workspaceConfig
      }));

      await dispatch(switchWorkspace(workspaceUid));

      return result;
    } catch (error) {
      throw error;
    }
  };
};

// File-based workspace opening is no longer supported. Workspaces are IDB-only.
// Use createWorkspaceAction to create a new workspace instead.

export const removeCollectionFromWorkspaceAction = (workspaceUid, collectionPath) => {
  return async (dispatch, getState) => {
    try {
      const workspacesState = getState().workspaces;
      const collectionsState = getState().collections;
      const workspace = workspacesState.workspaces.find((w) => w.uid === workspaceUid);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const normalizedCollectionPath = normalizePath(collectionPath);

      // Match by uid or pathname (pathname === uid for cloud/IDB collections)
      const collection = collectionsState.collections.find(
        (c) => c.uid === collectionPath || normalizePath(c.pathname) === normalizedCollectionPath
      );

      if (storage.isCloudMode()) {
        // Cloud: delete from the server
        if (collection) {
          await storage.deleteCollection(collection.uid);
        }
      } else {
        // Local IDB: delete cascade from IndexedDB
        await storage.removeCollectionFromWorkspace(
          workspaceUid,
          workspace.pathname,
          collectionPath
        );
      }

      // Update Redux — remove from collections list and workspace
      if (collection) {
        dispatch(removeCollection({ collectionUid: collection.uid }));
      }

      dispatch(removeCollectionFromWorkspace({
        workspaceUid,
        collectionLocation: collectionPath
      }));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

const loadWorkspaceCollectionsForSwitch = async (dispatch, workspace) => {
  // Clear stale collections from previous workspace before loading new ones
  dispatch({ type: 'collections/clearAllCollections' });

  // IDB mode: load collections directly from IndexedDB
  if (!storage.isCloudMode()) {
    try {
      const { loadWorkspaceCollectionsFromIdb } = await import('utils/idb/collectionTree');
      const { createCollection: _createCollection } = await import('../collections');
      const collections = await loadWorkspaceCollectionsFromIdb(workspace.uid);

      for (const collection of collections) {
        dispatch(_createCollection(collection));
        dispatch(addCollectionToWorkspace({
          workspaceUid: workspace.uid,
          collection: { uid: collection.uid, name: collection.name, path: collection.uid }
        }));
      }

      dispatch(updateWorkspaceLoadingState({ workspaceUid: workspace.uid, loadingState: 'loaded' }));
    } catch (error) {
      console.error('[IDB] Failed to load workspace collections:', error);
      dispatch(updateWorkspaceLoadingState({ workspaceUid: workspace.uid, loadingState: 'error' }));
    }
    return;
  }

  // Legacy filesystem mode (kept for backward compat)
  const openCollectionsFunction = (collectionPaths, workspacePath) => {
    return dispatch(openMultipleCollections(collectionPaths, { workspacePath }));
  };

  try {
    await dispatch(loadWorkspaceCollections(workspace.uid));
    const updatedWorkspace = await dispatch((_, getState) => getState().workspaces.workspaces.find((w) => w.uid === workspace.uid));

    if (updatedWorkspace?.collections?.length > 0) {
      const alreadyOpenCollections = await dispatch((_, getState) =>
        getState().collections.collections.map((c) => normalizePath(c.pathname))
      );

      const collectionPaths = updatedWorkspace.collections
        .map((wc) => wc.path)
        .filter((p) => p && !alreadyOpenCollections.includes(normalizePath(p)));

      const uniqueCollectionPaths = [...new Map(
        collectionPaths.map((p) => [normalizePath(p), p])
      ).values()];

      if (uniqueCollectionPaths.length > 0) {
        await openCollectionsFunction(uniqueCollectionPaths, updatedWorkspace.pathname);
      }
    }

    // Load API specs for this workspace
    await dispatch(loadWorkspaceApiSpecs(workspace.uid));
  } catch (error) {
    console.error('Failed to load workspace collections:', error);
  }
};

export const loadWorkspaceApiSpecs = (workspaceUid) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        return;
      }

      const apiSpecs = await storage.loadWorkspaceApiSpecs(workspaceUid);

      dispatch(updateWorkspace({
        uid: workspaceUid,
        apiSpecs: apiSpecs
      }));

      const allApiSpecs = getState().apiSpec.apiSpecs;
      const alreadyOpenApiSpecUids = allApiSpecs.map((a) => a.uid);

      for (const apiSpec of apiSpecs) {
        if (apiSpec.uid && !alreadyOpenApiSpecUids.includes(apiSpec.uid)) {
          dispatch(apiSpecAddFileEvent({ data: apiSpec }));
        }
      }
    } catch (error) {
      console.error('Error loading workspace API specs:', error);
    }
  };
};

/**
 * Background refresh of a cloud workspace from the API.
 * Fetches fresh collection data, updates Redux and IDB cache.
 */
async function refreshCloudWorkspace(workspaceUid, dispatch, getState, _createCollection) {
  const brunoApi = window.__BRUNO_API__;
  if (!brunoApi) return;

  try {
    const { transformCloudItemToLocal, transformCloudEnvironmentToLocal, transformCloudExampleToLocal } = await import('utils/storage/transform');
    const { cacheCloudCollection, clearCloudCollectionCache } = await import('utils/cache/indexedDB');
    const { removeCollection } = await import('../collections');

    const collections = await brunoApi.collections.getCollectionsTreeByWorkspace(workspaceUid);

    // Clear stale cache for this workspace before writing fresh data
    await clearCloudCollectionCache(workspaceUid).catch(() => {});

    // Get current Redux collections for this workspace to detect removals
    const currentCollectionUids = new Set(
      getState().collections.collections
        .filter((c) => c.workspaceId === workspaceUid)
        .map((c) => c.uid)
    );

    const freshUids = new Set();
    for (const collection of collections) {
      const items = (collection.items || []).map((item) => transformCloudItemToLocal(item, collection.uid));
      let environments = [];
      try {
        const rawEnvs = await brunoApi.environments.listCollectionEnvironments(collection.uid);
        environments = rawEnvs.map(transformCloudEnvironmentToLocal);
      } catch {}

      // Fetch examples and attach to request items
      try {
        const cloudExamples = await brunoApi.examples.listForCollection(collection.uid);
        if (cloudExamples && cloudExamples.length > 0) {
          const byRequestUid = {};
          for (const ex of cloudExamples) {
            if (!byRequestUid[ex.requestUid]) byRequestUid[ex.requestUid] = [];
            byRequestUid[ex.requestUid].push(ex);
          }
          const attachExamples = (itemList) => {
            for (const item of itemList) {
              if (item.type !== 'folder' && byRequestUid[item.uid]) {
                item.examples = byRequestUid[item.uid].map(transformCloudExampleToLocal);
              }
              if (item.items?.length) attachExamples(item.items);
            }
          };
          attachExamples(items);
        }
      } catch {}

      const collectionData = {
        uid: collection.uid,
        name: collection.name,
        pathname: collection.uid,
        items,
        environments,
        version: '1',
        isCloud: true,
        workspaceId: workspaceUid,
        brunoConfig: collection.bruno_config || {},
        root: collection.root || {},
        runtimeVariables: {},
        mountStatus: 'unmounted'
      };

      freshUids.add(collection.uid);

      // Replace in Redux (remove stale + add fresh)
      if (currentCollectionUids.has(collection.uid)) {
        dispatch(removeCollection(collection.uid));
      }
      dispatch(_createCollection(collectionData));
      dispatch(addCollectionToWorkspace({
        workspaceUid,
        collection: { uid: collection.uid, name: collection.name, path: collection.uid }
      }));

      // Update IDB cache
      await cacheCloudCollection(collectionData).catch(() => {});
    }

    // Remove collections that no longer exist on server
    for (const uid of currentCollectionUids) {
      if (!freshUids.has(uid)) {
        dispatch(removeCollection(uid));
      }
    }

    console.log(`✅ [CloudSync] Refreshed ${collections.length} collections for workspace ${workspaceUid}`);
    // Record full refresh time so incremental pull can start from here
    const refreshTime = new Date().toISOString();
    try { localStorage.setItem(`lastSyncedAt_${workspaceUid}`, refreshTime); } catch (_) {}
    // Update Redux sync state
    import('providers/ReduxStore/slices/cloudSync').then(({ setSyncComplete }) => {
      dispatch(setSyncComplete(refreshTime));
    });

    // If the active tab is still the workspace overview (Phase-1 had no cache),
    // attempt session tab restore now that we have fresh collections.
    const stateAfterRefresh = getState();
    const activeTabs = stateAfterRefresh.tabs?.tabs || [];
    const hasOnlyOverview = activeTabs.length === 1 && activeTabs[0].type === 'workspaceOverview';
    if (hasOnlyOverview) {
      try {
        const userId = stateAfterRefresh.auth?.user?.id;
        const { getAppState } = await import('utils/workspaceCache');
        const savedState = getAppState(userId);
        if (savedState?.activeWorkspaceUid === workspaceUid && savedState.tabs?.length > 0) {
          const allCollections = stateAfterRefresh.collections.collections;
          const { findItemInCollection } = await import('utils/collections');
          const { addTab, focusTab } = await import('../tabs');
          let restoredCount = 0;
          for (const tab of savedState.tabs) {
            const col = allCollections.find((c) => c.uid === tab.collectionUid);
            if (!col) continue;
            const isSpecialTab = ['workspaceOverview', 'workspaceEnvironments', 'collectionOverview', 'collectionEnvironments', 'preferences'].includes(tab.type);
            if (!isSpecialTab && !findItemInCollection(col, tab.uid)) continue;
            dispatch(addTab({ uid: tab.uid, collectionUid: tab.collectionUid, type: tab.type, requestPaneTab: tab.requestPaneTab }));
            restoredCount++;
          }
          if (restoredCount > 0 && savedState.activeTabUid) {
            dispatch(focusTab({ uid: savedState.activeTabUid }));
          }
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('⚠️  [CloudSync] Background refresh failed:', e?.message);
  }
}

// ── Incremental pull using /changes endpoint ──────────────────────────────────

function getLastSyncedAt(workspaceUid) {
  try {
    return localStorage.getItem(`lastSyncedAt_${workspaceUid}`) || null;
  } catch (_) { return null; }
}

function setLastSyncedAt(workspaceUid, serverTime) {
  try {
    localStorage.setItem(`lastSyncedAt_${workspaceUid}`, serverTime);
  } catch (_) {}
}

async function pullWorkspaceChanges(workspaceUid, dispatch, getState, _createCollection) {
  const brunoApi = window.__BRUNO_API__;
  if (!brunoApi?.sync) return;

  const lastSyncedAt = getLastSyncedAt(workspaceUid);
  // If no lastSyncedAt, refreshCloudWorkspace already handles full load
  if (!lastSyncedAt) return;

  try {
    const { transformCloudItemToLocal, transformCloudEnvironmentToLocal } = await import('utils/storage/transform');
    const { cacheCloudCollection, getCachedCloudCollection } = await import('utils/cache/indexedDB');
    const { removeCollection } = await import('../collections');

    const changes = await brunoApi.sync.getChanges(workspaceUid, lastSyncedAt);

    // Apply updated collections
    for (const col of changes.collections || []) {
      const colUid = col.uid;
      const existingCached = await getCachedCloudCollection(colUid).catch(() => null);
      if (existingCached) {
        // Update metadata
        const updated = { ...existingCached, name: col.name, description: col.description };
        await cacheCloudCollection(updated).catch(() => {});
        const currentState = getState();
        const reduxCol = currentState.collections.collections.find((c) => c.uid === colUid);
        if (reduxCol) {
          dispatch(_createCollection({ ...reduxCol, name: col.name }));
        }
      }
    }

    // Apply updated items
    if ((changes.items || []).length > 0) {
      const itemsByCollection = {};
      for (const item of changes.items) {
        const cUid = item.collectionUid;
        if (!itemsByCollection[cUid]) itemsByCollection[cUid] = [];
        itemsByCollection[cUid].push(item);
      }
      for (const [cUid, updatedItems] of Object.entries(itemsByCollection)) {
        const existingCached = await getCachedCloudCollection(cUid).catch(() => null);
        if (existingCached) {
          for (const serverItem of updatedItems) {
            const localItem = transformCloudItemToLocal(serverItem, cUid);
            const idx = existingCached.items.findIndex((i) => i.uid === serverItem.uid);
            if (idx >= 0) {
              existingCached.items[idx] = { ...existingCached.items[idx], ...localItem };
            } else {
              existingCached.items.push(localItem);
            }
          }
          await cacheCloudCollection(existingCached).catch(() => {});
        }
      }
    }

    // Apply updated environments (collection-scoped + workspace-level global)
    if ((changes.environments || []).length > 0) {
      const globalEnvUpdates = [];
      for (const env of changes.environments) {
        const cUid = env.collectionUid;
        if (cUid) {
          // Collection-scoped environment → update IDB cache
          const existingCached = await getCachedCloudCollection(cUid).catch(() => null);
          if (existingCached) {
            const localEnv = transformCloudEnvironmentToLocal(env);
            const idx = existingCached.environments.findIndex((e) => e.uid === env.uid);
            if (idx >= 0) {
              existingCached.environments[idx] = localEnv;
            } else {
              existingCached.environments.push(localEnv);
            }
            await cacheCloudCollection(existingCached).catch(() => {});
          }
        } else if (env.workspaceUid === workspaceUid) {
          // Workspace-level (global) environment
          globalEnvUpdates.push(transformCloudEnvironmentToLocal(env));
        }
      }

      // Apply global environment updates to Redux
      if (globalEnvUpdates.length > 0) {
        const { updateGlobalEnvironments } = await import('../global-environments');
        const state = getState();
        const currentGlobal = state.globalEnvironments?.globalEnvironments || [];
        let updatedGlobal = [...currentGlobal];
        for (const env of globalEnvUpdates) {
          const idx = updatedGlobal.findIndex((e) => e.uid === env.uid);
          if (idx >= 0) {
            updatedGlobal[idx] = env;
          } else {
            updatedGlobal.push(env);
          }
        }
        dispatch(updateGlobalEnvironments({
          globalEnvironments: updatedGlobal,
          activeGlobalEnvironmentUid: state.globalEnvironments?.activeGlobalEnvironmentUid || null
        }));
      }
    }

    // Apply deletions
    for (const del of changes.deletions || []) {
      if (del.resource_type === 'collection') {
        dispatch(removeCollection(del.uid));
        const { clearCloudCollectionCache } = await import('utils/cache/indexedDB');
        await clearCloudCollectionCache(del.uid).catch(() => {});
      } else if (del.resource_type === 'item') {
        // Find and remove from cached collection
        const currentState = getState();
        for (const col of currentState.collections.collections) {
          const existingCached = await getCachedCloudCollection(col.uid).catch(() => null);
          if (existingCached) {
            const had = existingCached.items.some((i) => i.uid === del.uid);
            if (had) {
              existingCached.items = existingCached.items.filter((i) => i.uid !== del.uid);
              await cacheCloudCollection(existingCached).catch(() => {});
              break;
            }
          }
        }
      } else if (del.resource_type === 'environment') {
        // Try collection envs first
        let handled = false;
        const currentState = getState();
        for (const col of currentState.collections.collections) {
          const existingCached = await getCachedCloudCollection(col.uid).catch(() => null);
          if (existingCached && existingCached.environments.some((e) => e.uid === del.uid)) {
            existingCached.environments = existingCached.environments.filter((e) => e.uid !== del.uid);
            await cacheCloudCollection(existingCached).catch(() => {});
            handled = true;
            break;
          }
        }
        // If not found in collections, try global environments
        if (!handled) {
          const { updateGlobalEnvironments } = await import('../global-environments');
          const state = getState();
          const currentGlobal = state.globalEnvironments?.globalEnvironments || [];
          if (currentGlobal.some((e) => e.uid === del.uid)) {
            dispatch(updateGlobalEnvironments({
              globalEnvironments: currentGlobal.filter((e) => e.uid !== del.uid),
              activeGlobalEnvironmentUid: state.globalEnvironments?.activeGlobalEnvironmentUid || null
            }));
          }
        }
      }
    }

    setLastSyncedAt(workspaceUid, changes.serverTime);
    console.log(`✅ [CloudSync] Incremental pull complete. serverTime=${changes.serverTime}`);
  } catch (e) {
    console.warn('⚠️  [CloudSync] Incremental pull failed:', e?.message);
  }
}

// ── Real-time WS event handler ─────────────────────────────────────────────────

async function applyRemoteWsEvent(wsEvent, dispatch, getState, _createCollection) {
  try {
    const { transformCloudItemToLocal, transformCloudEnvironmentToLocal } = await import('utils/storage/transform');
    const { cacheCloudCollection, getCachedCloudCollection } = await import('utils/cache/indexedDB');
    const { removeCollection } = await import('../collections');

    const { type, payload } = wsEvent.event || {};
    if (!type || !payload) return;
    const { action, data } = payload;

    // ── Race condition guard: skip update if item has an open dirty tab ──────
    const isItemDirty = (itemUid) => {
      const state = getState();
      const openTabUids = new Set((state.tabs?.tabs || []).map((t) => t.uid));
      if (!openTabUids.has(itemUid)) return false;
      // Check if any collection has a draft for this item
      for (const col of state.collections?.collections || []) {
        const findDraft = (items) => {
          for (const item of items || []) {
            if (item.uid === itemUid && item.draft) return true;
            if (item.items && findDraft(item.items)) return true;
          }
          return false;
        };
        if (findDraft(col.items)) return true;
      }
      return false;
    };

    if (type === 'ItemChanged') {
      const cUid = data?.collectionUid;
      if (!cUid) return;

      // Skip if user has unsaved changes for this item
      if (action !== 'deleted' && isItemDirty(data.uid)) {
        console.log(`⏭️  [CloudSync] Skipping ItemChanged for dirty tab: ${data.uid}`);
        return;
      }

      const cached = await getCachedCloudCollection(cUid).catch(() => null);
      if (!cached) return;

      if (action === 'deleted') {
        cached.items = cached.items.filter((i) => i.uid !== data.uid);
      } else {
        const localItem = transformCloudItemToLocal(data, cUid);
        const idx = cached.items.findIndex((i) => i.uid === data.uid);
        if (idx >= 0) {
          cached.items[idx] = { ...cached.items[idx], ...localItem };
        } else {
          cached.items.push(localItem);
        }
      }
      await cacheCloudCollection(cached).catch(() => {});
    } else if (type === 'EnvironmentChanged') {
      const cUid = data?.collectionUid;
      if (cUid) {
        // Collection-scoped environment
        const cached = await getCachedCloudCollection(cUid).catch(() => null);
        if (!cached) return;

        if (action === 'deleted') {
          cached.environments = cached.environments.filter((e) => e.uid !== data.uid);
        } else {
          const localEnv = transformCloudEnvironmentToLocal(data);
          const idx = cached.environments.findIndex((e) => e.uid === data.uid);
          if (idx >= 0) {
            cached.environments[idx] = localEnv;
          } else {
            cached.environments.push(localEnv);
          }
        }
        await cacheCloudCollection(cached).catch(() => {});
      } else if (data?.workspaceUid) {
        // Workspace-level (global) environment — update Redux globalEnvironments
        const { updateGlobalEnvironments } = await import('../global-environments');
        const state = getState();
        const currentGlobal = state.globalEnvironments?.globalEnvironments || [];
        if (action === 'deleted') {
          dispatch(updateGlobalEnvironments({
            globalEnvironments: currentGlobal.filter((e) => e.uid !== data.uid),
            activeGlobalEnvironmentUid: state.globalEnvironments?.activeGlobalEnvironmentUid || null
          }));
        } else {
          const localEnv = transformCloudEnvironmentToLocal(data);
          const idx = currentGlobal.findIndex((e) => e.uid === data.uid);
          const updated = idx >= 0
            ? currentGlobal.map((e, i) => (i === idx ? localEnv : e))
            : [...currentGlobal, localEnv];
          dispatch(updateGlobalEnvironments({
            globalEnvironments: updated,
            activeGlobalEnvironmentUid: state.globalEnvironments?.activeGlobalEnvironmentUid || null
          }));
        }
      }
    } else if (type === 'CollectionChanged') {
      if (action === 'deleted') {
        dispatch(removeCollection(data.uid));
        const { clearCloudCollectionCache } = await import('utils/cache/indexedDB');
        await clearCloudCollectionCache(data.uid).catch(() => {});
      }
    }

    console.log(`🔄 [CloudSync] Applied WS event: ${type} ${action}`);
  } catch (e) {
    console.warn('⚠️  [CloudSync] WS event apply failed:', e?.message);
  }
}

export const switchWorkspace = (workspaceUid) => {
  return async (dispatch, getState) => {
    dispatch(resetTabs());
    dispatch(setActiveWorkspace(workspaceUid));

    const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return;
    }

    // Cloud workspaces don't use local filesystem — skip scratch collection and local collection loading
    if (workspace.isCloud) {
      console.log(`☁️  [switchWorkspace] Cloud workspace "${workspace.name}" — loading cloud data`);

      // Clear collections belonging to other workspaces from Redux
      dispatch({ type: 'collections/clearAllCollections' });

      // Load global environments for this workspace
      try {
        const result = await storage.getGlobalEnvironments({ workspaceUid: workspaceUid });
        dispatch(updateGlobalEnvironments({
          globalEnvironments: result?.globalEnvironments || [],
          activeGlobalEnvironmentUid: result?.activeGlobalEnvironmentUid || null
        }));
      } catch (e) {
        dispatch(updateGlobalEnvironments({ globalEnvironments: [], activeGlobalEnvironmentUid: null }));
      }

      const { createCollection: _createCollection } = await import('../collections');

      // ── Phase 1: Serve from IDB cache immediately (instant UI) ──────────────
      try {
        const { loadCachedCloudCollections } = await import('utils/cache/indexedDB');
        const cachedCollections = await loadCachedCloudCollections(workspaceUid);
        for (const col of cachedCollections) {
          dispatch(_createCollection(col));
          dispatch(addCollectionToWorkspace({
            workspaceUid,
            collection: { uid: col.uid, name: col.name, path: col.uid }
          }));
        }
        if (cachedCollections.length > 0) {
          console.log(`⚡ [switchWorkspace] Loaded ${cachedCollections.length} collections from cache`);
        }
      } catch (e) {
        console.warn('[switchWorkspace] Failed to load from cache:', e?.message);
      }

      // Restore cloud drafts for this workspace
      try {
        const { getAllDrafts } = await import('utils/storage/cloudDrafts');
        const { newItem: _newItem } = await import('../collections');
        const drafts = getAllDrafts();
        for (const draft of drafts) {
          if (draft.collectionUid) {
            const state = getState();
            const collExists = state.collections.collections.find((c) => c.uid === draft.collectionUid);
            if (collExists) {
              dispatch(_newItem({ collectionUid: draft.collectionUid, currentItemUid: null, item: draft }));
            }
          }
        }
      } catch {}

      // Restore tabs from cloud session (workspaceCache localStorage)
      const userId = getState().auth?.user?.id;
      try {
        const { getAppState } = await import('utils/workspaceCache');
        const savedState = getAppState(userId);
        if (savedState?.activeWorkspaceUid === workspaceUid && savedState.tabs?.length > 0) {
          const state = getState();
          const allCollections = state.collections.collections;
          const { findItemInCollection } = await import('utils/collections');
          let restoredCount = 0;
          for (const tab of savedState.tabs) {
            const col = allCollections.find((c) => c.uid === tab.collectionUid);
            if (!col) continue;
            const isSpecialTab = ['workspaceOverview', 'workspaceEnvironments', 'collectionOverview', 'collectionEnvironments', 'preferences'].includes(tab.type);
            if (!isSpecialTab) {
              const item = findItemInCollection(col, tab.uid);
              if (!item) continue;
            }
            dispatch(addTab({ uid: tab.uid, collectionUid: tab.collectionUid, type: tab.type, requestPaneTab: tab.requestPaneTab }));
            restoredCount++;
          }
          if (restoredCount > 0 && savedState.activeTabUid) {
            dispatch(focusTab({ uid: savedState.activeTabUid }));
            console.log(`✅ [Cloud RestoreTabs] Restored ${restoredCount} tabs`);
          } else if (restoredCount === 0) {
            const overviewTabUid = `${workspaceUid}-overview`;
            dispatch(addTab({ uid: overviewTabUid, collectionUid: workspaceUid, type: 'workspaceOverview' }));
            dispatch(focusTab({ uid: overviewTabUid }));
          }
        } else {
          const overviewTabUid = `${workspaceUid}-overview`;
          dispatch(addTab({ uid: overviewTabUid, collectionUid: workspaceUid, type: 'workspaceOverview' }));
          dispatch(focusTab({ uid: overviewTabUid }));
        }
      } catch {
        const overviewTabUid = `${workspaceUid}-overview`;
        dispatch(addTab({ uid: overviewTabUid, collectionUid: workspaceUid, type: 'workspaceOverview' }));
        dispatch(focusTab({ uid: overviewTabUid }));
      }

      // ── Phase 2: Background refresh from API ────────────────────────────────
      refreshCloudWorkspace(workspaceUid, dispatch, getState, _createCollection).catch(() => {});

      // ── Phase 3: Wire WebSocket for real-time sync ───────────────────────────
      const brunoApi = window.__BRUNO_API__;
      if (brunoApi?.ws) {
        const token = getState().auth?.token;
        const serverUrl = window.__BRUNO_SERVER_URL__ || 'http://localhost:9999';
        if (token && !brunoApi.ws.isConnected) {
          brunoApi.ws.connect(serverUrl, token);
        }
        brunoApi.ws.subscribe(workspaceUid);

        // Handle incoming real-time events
        brunoApi.ws.off('*', brunoApi._syncHandler);
        brunoApi._syncHandler = async (event) => {
          if (event.type === '__connected__') {
            const { setWsConnected } = await import('providers/ReduxStore/slices/cloudSync');
            dispatch(setWsConnected(true));
          } else if (event.type === '__disconnected__') {
            const { setWsConnected } = await import('providers/ReduxStore/slices/cloudSync');
            dispatch(setWsConnected(false));
          } else if (event.workspace_id === workspaceUid) {
            applyRemoteWsEvent(event, dispatch, getState, _createCollection).catch(() => {});
          }
        };
        brunoApi.ws.on('*', brunoApi._syncHandler);
        brunoApi.ws.on('__connected__', brunoApi._syncHandler);
        brunoApi.ws.on('__disconnected__', brunoApi._syncHandler);

        // On reconnect: catch up missed events via incremental pull
        brunoApi.ws.off('__connected__', brunoApi._reconnectHandler);
        brunoApi._reconnectHandler = () => {
          pullWorkspaceChanges(workspaceUid, dispatch, getState, _createCollection).catch(() => {});
          // Flush any queued offline changes
          import('../syncQueue').then(({ processSyncQueue }) => {
            dispatch(processSyncQueue());
          }).catch(() => {});
        };
        brunoApi.ws.on('__connected__', brunoApi._reconnectHandler);

        // Set initial connection state
        import('providers/ReduxStore/slices/cloudSync').then(({ setWsConnected }) => {
          dispatch(setWsConnected(brunoApi.ws.isConnected));
        });
      }

      return;
    }

    try {
      const result = await storage.getGlobalEnvironments(
        {
          workspaceUid,
          workspacePath: workspace.pathname
        });

      const globalEnvironments = result?.globalEnvironments || [];
      const activeGlobalEnvironmentUid = result?.activeGlobalEnvironmentUid || null;

      dispatch(updateGlobalEnvironments({ globalEnvironments, activeGlobalEnvironmentUid }));
    } catch (error) {
      dispatch(updateGlobalEnvironments({ globalEnvironments: [], activeGlobalEnvironmentUid: null }));
    }

    await loadWorkspaceCollectionsForSwitch(dispatch, workspace);

    // Restore session tabs from IDB (local mode only, stable UIDs)
    if (!storage.isCloudMode()) {
      try {
        const { getUiState } = await import('utils/idb/localStore');
        const { findItemInCollection } = await import('utils/collections/index');
        const savedState = await getUiState(`session_${workspaceUid}`);
        const state = getState();

        if (savedState) {
          // 1. Restore expanded collection / folder state
          const expandedSet = new Set(savedState.expandedCollections || []);
          for (const col of state.collections.collections) {
            const shouldBeExpanded = expandedSet.has(col.uid);
            const isCurrentlyCollapsed = !!col.collapsed;
            if (shouldBeExpanded && isCurrentlyCollapsed) {
              dispatch(toggleCollection(col.uid));
            } else if (!shouldBeExpanded && !isCurrentlyCollapsed) {
              dispatch(toggleCollection(col.uid));
            }
          }
          if (savedState.expandedFolders) {
            for (const [colUid, folderUids] of Object.entries(savedState.expandedFolders)) {
              for (const folderUid of folderUids) {
                dispatch(toggleCollectionItem({ collectionUid: colUid, itemUid: folderUid }));
              }
            }
          }

          // 2. Restore regular collection tabs (request, folder, etc.)
          let restoredCollectionActiveUid = null;
          if (savedState.tabs?.length > 0) {
            for (const tab of savedState.tabs) {
              const collection = state.collections.collections.find((c) => c.uid === tab.collectionUid);
              if (!collection) continue;

              const SPECIAL_TAB_TYPES = new Set([
                'variables', 'collection-runner', 'environment-settings',
                'collection-settings', 'preferences', 'response-example'
              ]);
              if (!SPECIAL_TAB_TYPES.has(tab.type)) {
                const itemExists = findItemInCollection(collection, tab.uid);
                if (!itemExists) continue;
              }

              // For response-example tabs, validate that the parent item and example still exist
              if (tab.type === 'response-example') {
                const parentItem = findItemInCollection(collection, tab.itemUid);
                const exampleExists = parentItem?.examples?.find((ex) => ex.uid === tab.uid);
                if (!parentItem || !exampleExists) continue;
              }

              dispatch(addTab({
                uid: tab.uid,
                collectionUid: tab.collectionUid,
                type: tab.type,
                requestPaneTab: tab.requestPaneTab,
                preview: false,
                ...(tab.itemUid ? { itemUid: tab.itemUid } : {}),
                ...(tab.exampleUid ? { exampleUid: tab.exampleUid } : {})
              }));

              if (tab.uid === savedState.activeTabUid) {
                restoredCollectionActiveUid = tab.uid;
              }
            }
          }

          // 3. Restore workspace-level tabs using workspaceUid directly
          // Use savedState.workspaceTabs if it was explicitly saved (even if empty = user closed all),
          // fallback to defaults only when session data is from an old format that didn't save workspaceTabs
          const workspaceTabs = savedState.workspaceTabs !== undefined
            ? savedState.workspaceTabs
            : [{ type: 'workspaceOverview' }, { type: 'workspaceEnvironments' }];

          for (const wt of workspaceTabs) {
            const uid = `${workspaceUid}-${wt.type}`;
            dispatch(addTab({ uid, collectionUid: workspaceUid, type: wt.type, requestPaneTab: wt.requestPaneTab, preview: false }));
          }

          if (restoredCollectionActiveUid) {
            dispatch(focusTab({ uid: restoredCollectionActiveUid }));
          } else if (savedState.activeWorkspaceTabType) {
            dispatch(focusTab({ uid: `${workspaceUid}-${savedState.activeWorkspaceTabType}` }));
          } else if (workspaceTabs.length > 0) {
            dispatch(focusTab({ uid: `${workspaceUid}-${workspaceTabs[0].type}` }));
          } else {
            dispatch(focusTab({ uid: `${workspaceUid}-workspaceOverview` }));
          }
        } else {
          // No saved state — open default workspace tabs
          const overviewTabUid = `${workspaceUid}-workspaceOverview`;
          const environmentsTabUid = `${workspaceUid}-workspaceEnvironments`;
          dispatch(addTab({ uid: overviewTabUid, collectionUid: workspaceUid, type: 'workspaceOverview' }));
          dispatch(addTab({ uid: environmentsTabUid, collectionUid: workspaceUid, type: 'workspaceEnvironments' }));
          dispatch(focusTab({ uid: overviewTabUid }));
        }
      } catch (e) {
        console.warn('[Session Restore] Failed to restore session:', e);
        const overviewTabUid = `${workspaceUid}-workspaceOverview`;
        dispatch(addTab({ uid: overviewTabUid, collectionUid: workspaceUid, type: 'workspaceOverview' }));
        dispatch(focusTab({ uid: overviewTabUid }));
      }
    }
  };
};

export const loadWorkspaceCollections = (workspaceUid, force = false) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const hasProcessedCollections = workspace.collections
        && workspace.collections.length > 0
        && workspace.collections.some((c) => c.uid || (c.path && path.isAbsolute(c.path)));

      if (!force && hasProcessedCollections) {
        return workspace.collections;
      }

      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'loading' }));

      let collections = [];

      // Cloud mode: collections come from the server, no IDB lookup needed.
      // Local/IDB mode: load collections from IDB indexed by workspace.uid.
      const storageKey = storage.isCloudMode() ? null : workspace.uid;
      if (!storageKey) {
        collections = [];
      } else {
        const rawCollections = await storage.loadWorkspaceCollections(storageKey);

        // Store workspace collection metadata with `path` field (required by sidebar filter).
        // In IDB mode, pathname === uid; full collection data lives in state.collections.collections.
        collections = rawCollections.map((collection) => ({
          uid: collection.uid,
          name: collection.name,
          path: collection.uid
        }));
      }

      dispatch(updateWorkspace({
        uid: workspaceUid,
        collections
      }));

      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'loaded' }));

      return collections;
    } catch (error) {
      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'error' }));
      throw error;
    }
  };
};

export const removeWorkspaceAction = (workspaceUid) => {
  return (dispatch) => {
    dispatch(removeWorkspace(workspaceUid));
  };
};

export const loadLastOpenedWorkspaces = () => {
  return async (dispatch, getState) => {
    try {
      const workspaces = await storage.getLastOpenedWorkspaces();
      const currentWorkspaces = getState().workspaces.workspaces;
      const validWorkspaceUids = new Set(workspaces.map((w) => w.uid));

      for (const currentWorkspace of currentWorkspaces) {
        if (currentWorkspace.type !== 'default' && !validWorkspaceUids.has(currentWorkspace.uid)) {
          dispatch(removeWorkspace(currentWorkspace.uid));
        }
      }

      for (const workspace of workspaces) {
        const existingWorkspace = currentWorkspaces.find((w) => w.uid === workspace.uid);

        if (!existingWorkspace) {
          dispatch(createWorkspace(workspace));
        }
      }

      return workspaces;
    } catch (error) {
      throw error;
    }
  };
};

export const saveWorkspaceDocs = (workspaceUid, docs) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.saveWorkspaceDocs(workspace.uid, docs || '');

      dispatch(updateWorkspace({
        uid: workspaceUid,
        docs: docs
      }));

      return docs;
    } catch (error) {
      throw error;
    }
  };
};

export const createCollectionInWorkspace = (collectionName, workspaceUid) => {
  return async (dispatch, getState) => {
    const currentWorkspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
    if (!currentWorkspace) {
      throw new Error('Workspace not found');
    }

    // Collection will be created in default location based on userId
    return await dispatch(createCollection(collectionName, {
      workspaceId: currentWorkspace.pathname
    }));
  };
};

const handleWorkspaceAction = async (action, workspaceUid, ...args) => {
  try {
    await action(workspaceUid, ...args);
    return true;
  } catch (error) {
    const actionName = action.name.replace('renderer:', '').replace('-', ' ');
    toast.error(error.message || `Failed to ${actionName} workspace`);
    throw error;
  }
};

export const renameWorkspaceAction = (workspaceUid, newName) => {
  return async (dispatch, getState) => {
    try {
      const { workspaces } = getState().workspaces;
      const workspace = workspaces.find((w) => w.uid === workspaceUid);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.renameWorkspace(workspaceUid, newName);

      dispatch(updateWorkspace({
        uid: workspaceUid,
        name: newName
      }));
    } catch (error) {
      throw error;
    }
  };
};

export const closeWorkspaceAction = (workspaceUid) => {
  return async (dispatch, getState) => {
    try {
      const { workspaces } = getState().workspaces;
      const workspace = workspaces.find((w) => w.uid === workspaceUid);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (workspace.isCloud) {
        await storage.deleteCloudWorkspace(workspaceUid);
      } else {
        await storage.closeWorkspace(workspaceUid);
      }
      dispatch(removeWorkspace(workspaceUid));
    } catch (error) {
      toast.error(error.message || 'Failed to close workspace');
      throw error;
    }
  };
};

export const importCollectionInWorkspace = (collection, workspaceUid, collectionLocation, type) => {
  return async (dispatch, getState) => {
    const currentWorkspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!currentWorkspace) {
      throw new Error('Workspace not found');
    }

    // Cloud mode: import into cloud workspace (no filesystem paths)
    if (currentWorkspace.isCloud) {
      const brunoApi = window.__BRUNO_API__;

      // For Postman/Insomnia, call server import endpoints directly with raw JSON
      if ((type === 'postman' || type === 'insomnia') && brunoApi?.import) {
        let importResult;
        if (type === 'postman') {
          importResult = await brunoApi.import.importPostman(workspaceUid, collection);
        } else {
          importResult = await brunoApi.import.importInsomnia(workspaceUid, collection);
        }
        if (importResult?.collectionUid) {
          const { transformCloudItemToLocal, transformCloudEnvironmentToLocal } = await import('utils/storage/transform');
          const { cacheCloudCollection } = await import('utils/cache/indexedDB');

          // Fetch full collection tree (items + environments) from server
          const tree = await brunoApi.collections.getCollectionsTreeByWorkspace(workspaceUid).catch(() => []);
          const serverCol = tree.find((c) => c.uid === importResult.collectionUid);

          const items = (serverCol?.items || []).map((item) => transformCloudItemToLocal(item, importResult.collectionUid));
          let environments = [];
          try {
            const rawEnvs = await brunoApi.environments.listCollectionEnvironments(importResult.collectionUid);
            environments = rawEnvs.map(transformCloudEnvironmentToLocal);
          } catch {}

          const collectionData = {
            uid: importResult.collectionUid,
            name: importResult.collectionName,
            pathname: importResult.collectionUid,
            items,
            environments,
            version: '1',
            isCloud: true,
            workspaceId: workspaceUid,
            brunoConfig: serverCol?.bruno_config || {},
            root: serverCol?.root || {},
            runtimeVariables: {},
            mountStatus: 'unmounted'
          };

          const { createCollection: _createCol } = await import('../collections');
          dispatch(_createCol(collectionData));
          dispatch(addCollectionToWorkspace({
            workspaceUid,
            collection: {
              uid: importResult.collectionUid,
              name: importResult.collectionName,
              path: importResult.collectionUid
            }
          }));

          // Cache to IDB
          await cacheCloudCollection(collectionData).catch(() => {});
        }
        return importResult;
      }

      // For other formats (bruno, openapi, etc.) fall back to local transform + cloud create
      const transformedCollection = await transformCollection(collection, type);
      const result = await storage.importCollection(transformedCollection, null, {});
      if (result) {
        const collectionUid = result.uid || result.id;
        const collectionName = result.name || transformedCollection.name;
        dispatch(createCollection(collectionName, { workspaceUid, collectionUid, isCloud: true }));
        dispatch(addCollectionToWorkspace({
          workspaceUid,
          collection: { uid: collectionUid, name: collectionName, path: collectionUid }
        }));
      }
      return result;
    }

    const location = collectionLocation || path.join(currentWorkspace.pathname, 'collections');
    const transformedCollection = await transformCollection(collection, type);
    const collectionPath = await storage.importCollection(transformedCollection, location);

    const workspaceCollection = {
      name: transformedCollection.name,
      path: collectionPath
    };

    await storage.addCollectionToWorkspace(currentWorkspace.pathname, workspaceCollection);

    return collectionPath;
  };
};

export const loadWorkspaceEnvironments = (workspaceUid) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const environments = await storage.loadWorkspaceEnvironments(workspaceUid);

      dispatch(updateWorkspace({
        uid: workspaceUid,
        environments: environments
      }));

      return environments;
    } catch (error) {
      throw error;
    }
  };
};

export const createWorkspaceEnvironment = (workspaceUid, environmentName) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const environment = await storage.createWorkspaceEnvironment(workspaceUid, environmentName);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return environment;
    } catch (error) {
      throw error;
    }
  };
};

export const deleteWorkspaceEnvironment = (workspaceUid, environmentUid) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.deleteWorkspaceEnvironment(workspaceUid, environmentUid);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

export const selectWorkspaceEnvironment = (workspaceUid, environmentUid) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.selectWorkspaceEnvironment(workspaceUid, environmentUid);

      dispatch(updateWorkspace({
        uid: workspaceUid,
        activeEnvironmentUid: environmentUid
      }));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

export const importWorkspaceEnvironment = (workspaceUid, environmentData) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const environment = await storage.importWorkspaceEnvironment(workspaceUid, environmentData);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return environment;
    } catch (error) {
      throw error;
    }
  };
};

export const updateWorkspaceEnvironment = (workspaceUid, environmentUid, environmentData) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.updateWorkspaceEnvironment(workspaceUid, environmentUid, environmentData);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

export const renameWorkspaceEnvironment = (workspaceUid, environmentUid, newName) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await storage.renameWorkspaceEnvironment(workspaceUid, environmentUid, newName);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

export const copyWorkspaceEnvironment = (workspaceUid, environmentUid, newName) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const newEnvironment = await storage.copyWorkspaceEnvironment(workspaceUid, environmentUid, newName);

      await dispatch(loadWorkspaceEnvironments(workspaceUid));

      return newEnvironment;
    } catch (error) {
      throw error;
    }
  };
};

export const exportWorkspaceAction = (workspaceUid) => {
  return async (dispatch, getState) => {
    try {
      const { workspaces } = getState().workspaces;
      const workspace = workspaces.find((w) => w.uid === workspaceUid);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      if (!workspace.pathname) {
        return { success: false, error: 'Export is not available for IDB-only workspaces' };
      }

      const result = await storage.exportWorkspace(workspace.pathname, workspace.name);

      if (result.canceled) {
        return { canceled: true };
      }

      return result;
    } catch (error) {
      throw error;
    }
  };
};

export const importWorkspaceAction = (zipFilePath, extractLocation) => {
  return async (dispatch) => {
    try {
      const result = await storage.importWorkspace(zipFilePath, extractLocation);

      if (result.success) {
        const { nanoid } = await import('nanoid');
        const { idbPut, idbPutBulk, STORES } = await import('utils/idb/localStore');
        const workspaceUid = nanoid();
        const now = Date.now();

        await idbPut(STORES.WORKSPACES, {
          uid: workspaceUid,
          name: result.workspaceName || 'Imported Workspace',
          createdAt: now,
          updatedAt: now
        });

        dispatch(createWorkspace({
          uid: workspaceUid,
          name: result.workspaceName || 'Imported Workspace',
          pathname: null
        }));

        // Import all collections parsed from the extracted ZIP
        if (result.collections && result.collections.length > 0) {
          let colSeq = 0;
          for (const col of result.collections) {
            const collectionUid = nanoid();
            await idbPut(STORES.COLLECTIONS, {
              uid: collectionUid,
              workspaceUid,
              name: col.brunoConfig?.name || 'Imported Collection',
              brunoConfig: col.brunoConfig || {},
              root: col.root || {},
              format: col.format || 'yml',
              seq: colSeq++,
              createdAt: now,
              updatedAt: now
            });

            if (col.folders.length > 0) {
              await idbPutBulk(STORES.FOLDERS, col.folders.map((f) => ({ ...f, collectionUid, createdAt: now, updatedAt: now })));
            }
            if (col.requests.length > 0) {
              await idbPutBulk(STORES.REQUESTS, col.requests.map((r) => ({ ...r, collectionUid, createdAt: now, updatedAt: now })));
            }
            if (col.environments.length > 0) {
              await idbPutBulk(STORES.ENVIRONMENTS, col.environments.map((e) => ({ ...e, collectionUid, createdAt: now, updatedAt: now })));
            }
          }
        }

        await dispatch(switchWorkspace(workspaceUid));

        return { ...result, workspaceUid };
      }

      return result;
    } catch (error) {
      throw error;
    }
  };
};

export const saveWorkspaceDotEnvVariables = (workspaceUid, variables, filename = '.env') => async (dispatch, getState) => {
  const state = getState();
  const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);
  if (!workspace) throw new Error('Workspace not found');

  const result = await storage.saveWorkspaceDotEnvVariables({ workspaceUid: workspace.uid, variables, filename });
  dispatch(setWorkspaceDotEnvVariables({ workspaceUid, variables, filename, exists: true }));
  return result;
};

export const saveWorkspaceDotEnvRaw = (workspaceUid, content, filename = '.env') => async (dispatch, getState) => {
  const state = getState();
  const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);
  if (!workspace) throw new Error('Workspace not found');

  const result = await storage.saveWorkspaceDotEnvRaw({ workspaceUid: workspace.uid, content, filename });
  if (result) {
    dispatch(setWorkspaceDotEnvVariables({ workspaceUid, variables: result.variables || [], filename, exists: true }));
  }
  return result;
};

export const createWorkspaceDotEnvFile = (workspaceUid, filename = '.env') => async (dispatch, getState) => {
  const state = getState();
  const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);
  if (!workspace) throw new Error('Workspace not found');

  const result = await storage.createWorkspaceDotEnvFile({ workspaceUid: workspace.uid, filename });
  dispatch(setWorkspaceDotEnvVariables({ workspaceUid, variables: [], filename, exists: true }));
  return result;
};

export const deleteWorkspaceDotEnvFile = (workspaceUid, filename = '.env') => async (dispatch, getState) => {
  const state = getState();
  const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);
  if (!workspace) throw new Error('Workspace not found');

  const result = await storage.deleteWorkspaceDotEnvFile({ workspaceUid: workspace.uid, filename });
  dispatch(setWorkspaceDotEnvVariables({ workspaceUid, variables: [], filename, exists: false }));
  return result;
};

// Scratch Collection Actions

/**
 * Get the scratch collection for a workspace
 */
export const getScratchCollection = (workspaceUid) => {
  return (dispatch, getState) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);
    if (!workspace?.scratchCollectionUid) {
      return null;
    }
    return state.collections.collections.find((c) => c.uid === workspace.scratchCollectionUid);
  };
};

/**
 * Mount scratch collection for a workspace
 */
export const mountScratchCollection = (workspaceUid) => {
  return async (dispatch, getState) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return null;
    }

    if (workspace.scratchCollectionUid) {
      const existingCollection = state.collections.collections.find(
        (c) => c.uid === workspace.scratchCollectionUid
      );
      if (existingCollection) {
        return existingCollection;
      }
    }

    try {
      const result = await storage.mountWorkspaceScratch({
        workspaceUid,
        workspacePath: workspace.pathname || 'default'
      });

      const brunoConfig = {
        opencollection: '1.0.0',
        name: 'Scratch',
        type: 'collection',
        ignore: ['node_modules', '.git']
      };

      // IDB mode: result = { uid, idbMode: true } — no temp dir, no watcher
      if (result?.idbMode) {
        const scratchCollectionUid = result.uid;
        // Set scratchCollectionUid on workspace FIRST so sidebar filter can exclude it immediately
        dispatch(setWorkspaceScratchCollection({ workspaceUid, scratchCollectionUid, scratchTempDirectory: null }));
        await dispatch(openScratchCollectionEvent(scratchCollectionUid, scratchCollectionUid, brunoConfig));
        dispatch(updateCollectionMountStatus({ collectionUid: scratchCollectionUid, mountStatus: 'mounted' }));
        return { uid: scratchCollectionUid, pathname: scratchCollectionUid };
      }

      // File-based mode: result = tempDirectoryPath string
      const tempDirectoryPath = result;
      const { generateUidBasedOnHash } = await import('utils/common');
      const scratchCollectionUid = generateUidBasedOnHash(tempDirectoryPath);

      await storage.addCollectionWatcher({
        collectionPath: tempDirectoryPath,
        collectionUid: scratchCollectionUid,
        brunoConfig
      });

      await dispatch(openScratchCollectionEvent(scratchCollectionUid, tempDirectoryPath, brunoConfig));

      dispatch(setWorkspaceScratchCollection({
        workspaceUid,
        scratchCollectionUid,
        scratchTempDirectory: tempDirectoryPath
      }));

      dispatch(addTransientDirectory({
        collectionUid: scratchCollectionUid,
        pathname: tempDirectoryPath
      }));

      dispatch(updateCollectionMountStatus({ collectionUid: scratchCollectionUid, mountStatus: 'mounted' }));

      return { uid: scratchCollectionUid, pathname: tempDirectoryPath };
    } catch (error) {
      console.error('Error mounting scratch collection:', error);
      if (workspace.scratchCollectionUid) {
        dispatch(updateCollectionMountStatus({ collectionUid: workspace.scratchCollectionUid, mountStatus: 'unmounted' }));
      }
      return null;
    }
  };
};

// ─── Member Management Actions ────────────────────────────────────────────────

export const fetchWorkspaceMembersAction = (workspaceUid) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) return;

    try {
      dispatch(setMembersLoading({ workspaceUid, loading: true }));
      const [members, invites] = await Promise.all([
        brunoApi.workspaces.getMembers(workspaceUid),
        brunoApi.workspaces.listPendingInvites(workspaceUid).catch(() => [])
      ]);
      dispatch(setWorkspaceMembers({ workspaceUid, members }));
      dispatch(setWorkspacePendingInvites({ workspaceUid, invites }));
    } catch (error) {
      console.error('[fetchWorkspaceMembers]', error);
    } finally {
      dispatch(setMembersLoading({ workspaceUid, loading: false }));
    }
  };
};

export const inviteMemberAction = (workspaceUid, email, role) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    const result = await brunoApi.workspaces.addMember(workspaceUid, { email, role });
    await dispatch(fetchWorkspaceMembersAction(workspaceUid));
    return result;
  };
};

export const removeMemberAction = (workspaceUid, userId) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    await brunoApi.workspaces.removeMember(workspaceUid, userId);
    await dispatch(fetchWorkspaceMembersAction(workspaceUid));
  };
};

export const updateMemberRoleAction = (workspaceUid, userId, role) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    await brunoApi.workspaces.updateMemberRole(workspaceUid, userId, { role });
    await dispatch(fetchWorkspaceMembersAction(workspaceUid));
  };
};

export const cancelInviteAction = (workspaceUid, inviteId) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    await brunoApi.workspaces.cancelInvite(workspaceUid, inviteId);
    await dispatch(fetchWorkspaceMembersAction(workspaceUid));
  };
};

export const leaveWorkspaceAction = (workspaceUid) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    await brunoApi.workspaces.leaveWorkspace(workspaceUid);
    dispatch(removeWorkspace(workspaceUid));
  };
};

export const transferOwnershipAction = (workspaceUid, newOwnerUserId) => {
  return async (dispatch) => {
    const brunoApi = window.__BRUNO_API__;
    if (!brunoApi) throw new Error('API not initialized');

    await brunoApi.workspaces.transferOwnership(workspaceUid, newOwnerUserId);
    await dispatch(fetchWorkspaceMembersAction(workspaceUid));
  };
};
