import React, { useEffect } from 'react';
import { get } from 'lodash';
import { useDispatch, useSelector } from 'react-redux';
import { refreshScreenWidth } from 'providers/ReduxStore/slices/app';
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
