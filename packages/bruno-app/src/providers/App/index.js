import React, { useEffect } from 'react';
import { get } from 'lodash';
import { useDispatch, useSelector } from 'react-redux';
import { refreshScreenWidth, updatePreferences } from 'providers/ReduxStore/slices/app';
import { loadSavedAuth, selectIsAuthInitializing } from 'providers/ReduxStore/slices/auth';
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

  // Load preferences from IDB in local mode (replaces main:load-preferences IPC)
  useEffect(() => {
    const isAuthenticated = store.getState().auth?.isAuthenticated;
    if (!isAuthenticated) {
      import('utils/idb/localStore').then(({ getPreferences }) =>
        getPreferences().then((prefs) => {
          if (prefs) dispatch(updatePreferences(prefs));
        })
      ).catch(() => {});
    }
  }, []);

  // Bootstrap IDB workspaces in local mode.
  // Electron sends main:workspace-opened for its known workspaces (default).
  // Any workspace created via the app UI is only in IDB — we need to add those to Redux too.
  // We wait briefly to let the Electron workspace-opened events arrive first, then add any IDB-only workspaces.
  useEffect(() => {
    const isAuthenticated = store.getState().auth?.isAuthenticated;
    if (isAuthenticated) return;

    const timer = setTimeout(async () => {
      try {
        const { loadWorkspacesFromIdb } = await import('utils/idb/collectionTree');
        const { createWorkspace: createWorkspaceSlice } = await import('providers/ReduxStore/slices/workspaces');
        const { switchWorkspace, loadWorkspaceCollections } = await import('providers/ReduxStore/slices/workspaces/actions');
        const { getUiState } = await import('utils/idb/localStore');

        const idbWorkspaces = await loadWorkspacesFromIdb();
        const currentState = store.getState();
        const reduxWorkspaceUids = new Set(currentState.workspaces.workspaces.map((w) => w.uid));

        // Add any IDB workspaces not already in Redux (i.e. user-created, not Electron default)
        for (const ws of idbWorkspaces) {
          if (!reduxWorkspaceUids.has(ws.uid)) {
            store.dispatch(createWorkspaceSlice({ uid: ws.uid, name: ws.name, pathname: null }));
            await store.dispatch(loadWorkspaceCollections(ws.uid));
          }
        }

        // Restore the last active workspace (if saved and different from current)
        const savedActiveUid = await getUiState('active_workspace');
        const finalState = store.getState();
        const allUids = new Set(finalState.workspaces.workspaces.map((w) => w.uid));
        if (savedActiveUid && allUids.has(savedActiveUid)) {
          const currentActive = finalState.workspaces.activeWorkspaceUid;
          if (currentActive !== savedActiveUid) {
            store.dispatch(switchWorkspace(savedActiveUid));
          }
        }
      } catch (e) {
        console.warn('[IDB Bootstrap] Failed:', e?.message);
      }
    }, 800); // Wait for Electron workspace-opened events to settle

    return () => clearTimeout(timer);
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
