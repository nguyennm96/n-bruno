import { configureStore } from '@reduxjs/toolkit';
import tasksMiddleware from './middlewares/tasks/middleware';
import debugMiddleware from './middlewares/debug/middleware';
import globalLoadingMiddleware from './middlewares/globalLoading/middleware';
import syncQueueMiddleware from './middlewares/syncQueue/middleware';
import appReducer from './slices/app';
import collectionsReducer from './slices/collections';
import tabsReducer from './slices/tabs';
import notificationsReducer from './slices/notifications';
import globalEnvironmentsReducer from './slices/global-environments';
import logsReducer from './slices/logs';
import performanceReducer from './slices/performance';
import workspacesReducer from './slices/workspaces';
import apiSpecReducer from './slices/apiSpec';
import authReducer from './slices/auth';
import syncStatusReducer from './slices/syncStatus';
import globalLoadingReducer from './slices/globalLoading';
import networkReducer from './slices/network';
import syncQueueReducer from './slices/syncQueue';
import { draftDetectMiddleware } from './middlewares/draft/middleware';
import { autosaveMiddleware } from './middlewares/autosave/middleware';
import { sessionPersistMiddleware } from './middlewares/sessionPersist/middleware';
import { storage } from 'utils/storage';

const isDevEnv = () => {
  return import.meta.env.MODE === 'development';
};

let middleware = [
  tasksMiddleware.middleware,
  draftDetectMiddleware,
  autosaveMiddleware,
  sessionPersistMiddleware,
  globalLoadingMiddleware.middleware,
  syncQueueMiddleware.middleware
];
if (isDevEnv()) {
  middleware = [...middleware, debugMiddleware.middleware];
}

export const store = configureStore({
  reducer: {
    app: appReducer,
    collections: collectionsReducer,
    tabs: tabsReducer,
    notifications: notificationsReducer,
    globalEnvironments: globalEnvironmentsReducer,
    logs: logsReducer,
    performance: performanceReducer,
    workspaces: workspacesReducer,
    apiSpec: apiSpecReducer,
    auth: authReducer,
    syncStatus: syncStatusReducer,
    globalLoading: globalLoadingReducer,
    network: networkReducer,
    syncQueue: syncQueueReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware)
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZE STORAGE LAYER
// ═══════════════════════════════════════════════════════════════════════════

// Inject Redux getState into storage manager for auth detection
storage.setGetState(() => store.getState());

// Make store globally accessible (for storage and debugging)
if (typeof window !== 'undefined') {
  window.__REDUX_STORE__ = store;
  console.log('✅ Redux store initialized and exposed globally');
  console.log(`📦 Storage mode: ${storage.getMode()}`);
}

export default store;
