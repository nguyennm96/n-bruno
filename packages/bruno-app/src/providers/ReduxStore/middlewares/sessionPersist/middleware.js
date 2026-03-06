/**
 * Session Persist Middleware
 *
 * Saves the current tabs state + collection/folder expanded state to IndexedDB
 * (ui_state store) whenever tabs change or collections are toggled.
 * This enables session restore on next app start — since UIDs are stable in IDB mode,
 * the tabs will point to the same requests after a restart.
 *
 * Only active in local (IDB) mode. Cloud mode uses workspaceCache.js (localStorage).
 */

import { setUiState } from 'utils/idb/localStore';

// Debounce writes to avoid hammering IDB on rapid tab changes
let saveTimer = null;

const TRACKED_ACTIONS = new Set([
  'tabs/addTab',
  'tabs/focusTab',
  'tabs/closeTab',
  'tabs/closeTabs',
  'tabs/closeAllTabs',
  'tabs/reorderTabs',
  'collections/toggleCollection',
  'collections/toggleCollectionItem'
]);

/**
 * Collect which collection and folder UIDs are currently expanded.
 */
const getExpandedState = (collections) => {
  const expandedCollections = [];
  const expandedFolders = {};

  const traverseItems = (items, collectionUid) => {
    for (const item of items) {
      if (item.type === 'folder' && !item.collapsed) {
        if (!expandedFolders[collectionUid]) expandedFolders[collectionUid] = [];
        expandedFolders[collectionUid].push(item.uid);
        traverseItems(item.items || [], collectionUid);
      }
    }
  };

  for (const c of collections) {
    if (!c.collapsed) {
      expandedCollections.push(c.uid);
      traverseItems(c.items || [], c.uid);
    }
  }

  return { expandedCollections, expandedFolders };
};

export const sessionPersistMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  // Persist active workspace UID on every workspace switch (local mode)
  if (action.type === 'workspaces/setActiveWorkspace') {
    const state = store.getState();
    if (!state.auth?.isAuthenticated && action.payload) {
      setUiState('active_workspace', action.payload).catch(() => {});
    }
    return result;
  }

  if (!TRACKED_ACTIONS.has(action.type)) {
    return result;
  }

  const state = store.getState();
  const isAuthenticated = state.auth?.isAuthenticated;
  const workspaceUid = state.workspaces?.activeWorkspaceUid;
  if (!workspaceUid) return result;

  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const currentState = store.getState();
    const { tabs, activeTabUid } = currentState.tabs;

    const WORKSPACE_TAB_TYPES = new Set(['workspaceOverview', 'workspaceEnvironments']);

    // Regular collection tabs (stable collectionUid — safe to restore by uid)
    const collectionTabs = tabs
      .filter((t) => !WORKSPACE_TAB_TYPES.has(t.type))
      .map((t) => ({
        uid: t.uid,
        collectionUid: t.collectionUid,
        type: t.type,
        requestPaneTab: t.requestPaneTab,
        ...(t.itemUid ? { itemUid: t.itemUid } : {}),
        ...(t.exampleUid ? { exampleUid: t.exampleUid } : {})
      }));

    // Workspace-level tabs (keyed by workspaceUid — stable across sessions)
    const workspaceTabs = tabs
      .filter((t) => WORKSPACE_TAB_TYPES.has(t.type))
      .map((t) => ({
        type: t.type,
        requestPaneTab: t.requestPaneTab
      }));

    if (isAuthenticated) {
      // Cloud mode: save to localStorage via workspaceCache
      const userId = currentState.auth?.user?.id;
      if (userId) {
        import('utils/workspaceCache').then(({ saveAppState }) => {
          saveAppState(userId, { tabs: collectionTabs, activeTabUid, activeWorkspaceUid: workspaceUid });
        }).catch(() => {});
      }
    } else {
      // Local mode: save tabs + workspace tabs + expanded state to IDB
      const { expandedCollections, expandedFolders } = getExpandedState(currentState.collections?.collections || []);
      // Mark whether active tab was a workspace-level tab
      const activeTab = tabs.find((t) => t.uid === activeTabUid);
      const activeIsWorkspaceTab = activeTab && WORKSPACE_TAB_TYPES.has(activeTab.type);
      const sessionData = {
        tabs: collectionTabs,
        workspaceTabs,
        activeTabUid: activeIsWorkspaceTab ? null : activeTabUid,
        activeWorkspaceTabType: activeIsWorkspaceTab ? activeTab.type : null,
        expandedCollections,
        expandedFolders
      };
      setUiState(`session_${workspaceUid}`, sessionData).catch((e) => {
        console.error('[Session Save] Failed to save session:', e);
      });
    }
  }, 500);

  return result;
};
