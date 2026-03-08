/**
 * Background sync polling for cloud mode.
 *
 * Polls the server every POLL_INTERVAL_MS to detect changes made by other
 * team members. Uses sync metadata (server_updated_at) stored in workspaceCache
 * to avoid unnecessary re-fetches.
 *
 * Start polling after login; stop on logout.
 */

import { getSyncMetaForCollection, updateSyncMeta } from 'utils/workspaceCache';

const POLL_INTERVAL_MS = 30_000;

let pollTimer = null;

/**
 * Compare server collections against local sync metadata.
 * Re-fetch and update Redux for any collection that changed on the server.
 */
async function syncCollections(userId, dispatch, getState) {
  const brunoApi = window.__BRUNO_API__;
  if (!brunoApi) return;

  const state = getState();
  const activeWorkspace = state.workspaces?.workspaces?.find(
    (w) => w.uid === state.workspaces?.activeWorkspaceUid
  );
  if (!activeWorkspace?.isCloud) return;

  try {
    const workspaceId = activeWorkspace.uid;
    const serverCollections = await brunoApi.collections.listCollections(workspaceId);

    for (const serverCol of serverCollections) {
      const colId = serverCol.uid;
      const meta = getSyncMetaForCollection(userId, colId);

      const serverUpdatedAt = serverCol.updated_at;
      const cachedUpdatedAt = meta?.server_updated_at;

      if (!cachedUpdatedAt || serverUpdatedAt > cachedUpdatedAt) {
        // Server has a newer version — fetch full collection and update Redux
        try {
          const { _addCollectionToWorkspace, _createCollection } = await import(
            'providers/ReduxStore/slices/collections'
          );
          const { transformCloudCollectionToLocal, transformCloudItemToLocal } = await import(
            'utils/storage/cloud'
          );

          const fullCollection = await brunoApi.collections.getCollection(colId);
          const items = await brunoApi.collections.getItems(colId);
          const environments = await brunoApi.environments.listCollectionEnvironments(colId);

          const localItems = (items || []).map((item) =>
            transformCloudItemToLocal(item, colId)
          );
          const collectionData = {
            ...transformCloudCollectionToLocal(fullCollection),
            items: localItems,
            environments: environments || [],
            root: fullCollection.root || {}
          };

          // Remove stale collection and re-add with fresh data
          const { removeCollection } = await import('providers/ReduxStore/slices/collections');
          dispatch(removeCollection(colId));
          dispatch(_createCollection(collectionData));
          dispatch(_addCollectionToWorkspace({ workspaceUid: workspaceId, collectionUid: colId }));

          updateSyncMeta(userId, colId, { server_updated_at: serverUpdatedAt });
          console.log(`🔄 [CloudSync] Updated collection ${colId} from server`);
        } catch (err) {
          console.warn(`[CloudSync] Failed to sync collection ${colId}:`, err?.message);
        }
      }
    }
  } catch (err) {
    console.warn('[CloudSync] Poll failed:', err?.message);
  }
}

/**
 * Start background sync polling.
 * @param {string} userId
 * @param {Function} dispatch  Redux dispatch
 * @param {Function} getState  Redux getState
 */
export function startSyncPolling(userId, dispatch, getState) {
  stopSyncPolling();
  pollTimer = setInterval(() => {
    syncCollections(userId, dispatch, getState);
  }, POLL_INTERVAL_MS);
  console.log('🔄 [CloudSync] Polling started');
}

/**
 * Stop background sync polling (call on logout).
 */
export function stopSyncPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('🔄 [CloudSync] Polling stopped');
  }
}
