import React, { useEffect } from 'react';
import { get } from 'lodash';
import { useDispatch, useSelector } from 'react-redux';
import { refreshScreenWidth } from 'providers/ReduxStore/slices/app';
import { loadSavedAuth } from 'providers/ReduxStore/slices/auth';
import { setupNetworkListeners } from 'providers/ReduxStore/slices/network';
import { initializeBrunoCloudApi } from 'services/brunoApi';
import { store } from 'providers/ReduxStore';
import ConfirmAppClose from './ConfirmAppClose';
import GlobalLoadingBar from 'components/GlobalLoadingBar';
import useIpcEvents from './useIpcEvents';
import useTelemetry from './useTelemetry';
import useParsedFileCacheIpc from './useParsedFileCacheIpc';
import StyledWrapper from './StyledWrapper';
import { version } from '../../../package.json';

export const AppContext = React.createContext();

export const AppProvider = (props) => {
  useTelemetry({ version });
  useIpcEvents();
  useParsedFileCacheIpc();
  const dispatch = useDispatch();

  // Initialize Bruno Cloud API on app startup
  useEffect(() => {
    console.log('Initializing Bruno Cloud...');

    try {
      // Initialize API client
      initializeBrunoCloudApi(store);

      // Setup network status listeners
      const cleanupNetworkListeners = setupNetworkListeners(dispatch);

      // Load saved auth tokens if they exist
      dispatch(loadSavedAuth());

      // Cleanup on unmount
      return () => {
        cleanupNetworkListeners();
      };
    } catch (error) {
      console.error('Failed to initialize Bruno Cloud:', error);
    }
  }, []);

  useEffect(() => {
    dispatch(refreshScreenWidth());
  }, []);

  // Bootstrap IDB workspaces. All workspace data lives in IndexedDB.
  // On first launch with no workspaces, a default one is created automatically.
  useEffect(() => {
    // Wait for auth initialization to complete before deciding whether to bootstrap local workspaces.
    // If the user is authenticated (cloud mode), skip IDB bootstrap entirely —
    // initializeCloudData handles workspace loading.
    // We use a store subscription so we react to the async auth result instead of
    // reading isAuthenticated synchronously (which is always false at mount time).
    let unsubscribe = null;
    let bootstrapRan = false;

    const runIdbBootstrap = async () => {
      if (bootstrapRan) return;
      bootstrapRan = true;

      try {
        const { loadWorkspacesFromIdb } = await import('utils/idb/collectionTree');
        const { createWorkspace: createWorkspaceSlice } = await import('providers/ReduxStore/slices/workspaces');
        const { switchWorkspace } = await import('providers/ReduxStore/slices/workspaces/actions');
        const { getUiState, idbPut, STORES } = await import('utils/idb/localStore');

        const idbWorkspaces = await loadWorkspacesFromIdb();
        const currentState = store.getState();
        const reduxWorkspaceUids = new Set(currentState.workspaces.workspaces.map((w) => w.uid));

        // Register any IDB workspaces not already in Redux.
        for (const ws of idbWorkspaces) {
          if (!reduxWorkspaceUids.has(ws.uid)) {
            store.dispatch(createWorkspaceSlice({ uid: ws.uid, name: ws.name, pathname: null }));
          }
        }

        const finalState = store.getState();
        const allUids = new Set(finalState.workspaces.workspaces.map((w) => w.uid));

        // If no workspaces exist, create a default one
        if (allUids.size === 0) {
          const { nanoid } = await import('nanoid');
          const defaultUid = nanoid();
          const now = Date.now();
          await idbPut(STORES.WORKSPACES, { uid: defaultUid, name: 'My Workspace', createdAt: now, updatedAt: now });
          store.dispatch(createWorkspaceSlice({ uid: defaultUid, name: 'My Workspace', pathname: null }));
          store.dispatch(switchWorkspace(defaultUid));
          return;
        }

        // Switch to the last active workspace (or first available), always ensuring
        // switchWorkspace is called so collections are fully loaded into Redux.
        const savedActiveUid = await getUiState('active_workspace');
        const targetUid = (savedActiveUid && allUids.has(savedActiveUid))
          ? savedActiveUid
          : finalState.workspaces.workspaces[0]?.uid;

        if (targetUid) {
          store.dispatch(switchWorkspace(targetUid));
        }
      } catch (e) {
        console.warn('[IDB Bootstrap] Failed:', e?.message);
      }
    };

    // Subscribe to store changes and wait for auth initialization to settle
    unsubscribe = store.subscribe(() => {
      const authState = store.getState().auth;
      if (authState?.isInitializing) return; // Still loading tokens

      // Auth check is done — unsubscribe immediately to avoid repeated runs
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      if (authState?.isAuthenticated) {
        // Cloud mode: initializeCloudData handles workspace loading, skip IDB bootstrap
        return;
      }

      // Local mode: bootstrap IDB workspaces
      setTimeout(runIdbBootstrap, 0);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const platform = get(navigator, 'platform', '').toLowerCase();

    if (!platform) {
      return;
    }

    if (platform.includes('mac')) {
      document.body.classList.add('os-mac');
      return;
    }

    if (platform.includes('win')) {
      document.body.classList.add('os-windows');
      return;
    }

    if (platform.includes('linux')) {
      document.body.classList.add('os-linux');
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      dispatch(refreshScreenWidth());
    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AppContext.Provider {...props} value={{ version }}>
      <StyledWrapper>
        <GlobalLoadingBar />
        <ConfirmAppClose />
        {props.children}
      </StyledWrapper>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppProvider;
