import { collectionSchema, environmentSchema, itemSchema } from '@usebruno/schema';
import { parseQueryParams, extractPromptVariables } from '@usebruno/common/utils';
import { REQUEST_TYPES, DEFAULT_COLLECTION_FORMAT } from 'utils/common/constants';
import cloneDeep from 'lodash/cloneDeep';
import filter from 'lodash/filter';
import find from 'lodash/find';
import get from 'lodash/get';
import set from 'lodash/set';
import trim from 'lodash/trim';
import path, { normalizePath } from 'utils/common/path';
import { insertTaskIntoQueue, toggleSidebarCollapse } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';
import IpcErrorModal from 'components/Errors/IpcErrorModal/index';
import { storage } from 'utils/storage';
import {
  findCollectionByUid,
  findEnvironmentInCollection,
  findItemInCollection,
  findParentItemInCollection,
  isItemAFolder,
  refreshUidsInItem,
  isItemARequest,
  getAllVariables,
  transformRequestToSaveToFilesystem,
  transformCollectionRootToSave,
  flattenItems
} from 'utils/collections';
import { uuid, waitForNextTick } from 'utils/common';
import { cancelNetworkRequest, connectWS, sendGrpcRequest, sendNetworkRequest, sendWsRequest } from 'utils/network/index';
import brunoClipboard from 'utils/bruno-clipboard';

import {
  collectionAddEnvFileEvent as _collectionAddEnvFileEvent,
  createCollection as _createCollection,
  removeCollection as _removeCollection,
  selectEnvironment as _selectEnvironment,
  sortCollections as _sortCollections,
  updateCollectionMountStatus,
  moveCollection,
  workspaceEnvUpdateEvent,
  requestCancelled,
  resetRunResults,
  responseReceived,
  updateLastAction,
  setCollectionSecurityConfig,
  collectionAddOauth2CredentialsByUrl,
  collectionClearOauth2CredentialsByUrlAndCredentialsId,
  initRunRequestEvent,
  updateRunnerConfiguration as _updateRunnerConfiguration,
  updateActiveConnections,
  saveRequest as _saveRequest,
  saveEnvironment as _saveEnvironment,
  updateEnvironmentColor as _updateEnvironmentColor,
  saveCollectionDraft,
  saveFolderDraft,
  addVar,
  updateVar,
  addFolderVar,
  updateFolderVar,
  addCollectionVar,
  updateCollectionVar,
  addTransientDirectory,
  addSaveTransientRequestModal,
  updatePathParam
} from './index';

import { each } from 'lodash';
import { closeAllCollectionTabs, closeTabs as _closeTabs, focusTab, updateResponsePaneScrollPosition } from 'providers/ReduxStore/slices/tabs';
import { removeCollectionFromWorkspace } from 'providers/ReduxStore/slices/workspaces';
import { resolveRequestFilename } from 'utils/common/platform';
import { interpolateUrl, parsePathParams, splitOnFirst } from 'utils/url/index';
import { sendCollectionOauth2Request as _sendCollectionOauth2Request } from 'utils/network/index';
import {
  getGlobalEnvironmentVariables,
  findCollectionByPathname,
  findEnvironmentInCollectionByName,
  getReorderedItemsInTargetDirectory,
  resetSequencesInFolder,
  getReorderedItemsInSourceDirectory,
  calculateDraggedItemNewPathname,
  transformFolderRootToSave,
  getTreePathFromCollectionToItem,
  mergeHeaders
} from 'utils/collections/index';
import { sanitizeName } from 'utils/common/regex';
import { buildPersistedEnvVariables } from 'utils/environments';
import { safeParseJSON, safeStringifyJSON } from 'utils/common/index';
import { resolveInheritedAuth } from 'utils/auth';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { updateSettingsSelectedTab } from './index';
import { saveGlobalEnvironment } from 'providers/ReduxStore/slices/global-environments';
import { getTabToFocusForCurrentWorkspace } from 'providers/ReduxStore/slices/workspaces/getTabToFocusForCurrentWorkspace';

// generate a unique names
const generateUniqueName = (originalName, existingItems, isFolder) => {
  // Extract base name by removing any existing " (number)" suffix
  const baseName = originalName.replace(/\s*\(\d+\)$/, '');
  const baseFilename = sanitizeName(baseName);

  // Get normalized filenames for items of the same type
  const existingFilenames = existingItems
    .filter((item) => isFolder ? item.type === 'folder' : item.type !== 'folder')
    .map((item) => {
      let filename = trim(item.filename);
      // For requests, remove file extension (.bru, .yml, .yaml)
      return isFolder ? filename : filename.replace(/\.(bru|yml|yaml)$/, '');
    });

  // Check if base name conflicts with existing items
  if (!existingFilenames.includes(baseFilename)) {
    return { newName: baseName, newFilename: baseFilename };
  }

  // Find highest counter among conflicting names
  const counters = existingFilenames
    .filter((filename) => filename === baseFilename || filename.startsWith(`${baseFilename} (`))
    .map((filename) => {
      if (filename === baseFilename) return 0;
      const match = filename.match(/\((\d+)\)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

  const nextCounter = Math.max(0, ...counters) + 1;
  return {
    newName: `${baseName} (${nextCounter})`,
    newFilename: `${baseFilename} (${nextCounter})`
  };
};

export const renameCollection = (newName, collectionUid) => async (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  // Use unified storage layer
  console.log('Using unified storage layer for renameCollection');
  return storage.renameCollection(collectionUid, newName);
};

export const saveRequest = (itemUid, collectionUid, silent = false) => (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const tempDirectory = state.collections.tempDirectories?.[collectionUid];
  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);
    const item = findItemInCollection(collectionCopy, itemUid);
    if (!item) {
      return reject(new Error('Not able to locate item'));
    }

    const isTransient = tempDirectory && item.pathname.startsWith(tempDirectory);
    if (isTransient) {
      dispatch(addSaveTransientRequestModal({ item, collection }));
      return reject();
    }

    const itemToSave = transformRequestToSaveToFilesystem(item);

    // Use unified storage layer
    console.log('Using unified storage layer for saveRequest');
    itemSchema
      .validate(itemToSave)
      .then(() => storage.saveRequest(item.pathname, itemToSave, collection.format))
      .then(() => {
        if (!silent) {
          toast.success('Request saved successfully');
        }
        dispatch(
          _saveRequest({
            itemUid,
            collectionUid
          })
        );
      })
      .then(resolve)
      .catch((err) => {
        toast.error(err.message || 'Failed to save request!');
        reject(err);
      });
  });
};

export const saveMultipleRequests = (items) => (dispatch, getState) => {
  const state = getState();
  const { collections } = state.collections;

  return new Promise((resolve, reject) => {
    const itemsToSave = [];
    each(items, (item) => {
      const collection = findCollectionByUid(collections, item.collectionUid);
      if (collection) {
        const itemToSave = transformRequestToSaveToFilesystem(item);
        const itemIsValid = itemSchema.validateSync(itemToSave);
        if (itemIsValid) {
          itemsToSave.push({
            item: itemToSave,
            pathname: item.pathname,
            format: collection.format
          });
        }
      }
    });

    console.log('Using unified storage layer for saveMultipleRequests');
    storage
      .saveMultipleRequests(itemsToSave)
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save requests!');
        reject(err);
      });
  });
};

export const saveCollectionRoot = (collectionUid) => (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);

    // Transform collection root (uses draft if exists)
    const collectionRootToSave = transformCollectionRootToSave(collectionCopy);

    console.log('Using unified storage layer for saveCollectionRoot');
    storage
      .saveCollectionRoot(collectionCopy.pathname, collectionRootToSave, collectionCopy.brunoConfig)
      .then(() => {
        toast.success('Collection Settings saved successfully');
        dispatch(saveCollectionDraft({ collectionUid }));
      })
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save collection settings!');
        reject(err);
      });
  });
};

export const saveFolderRoot = (collectionUid, folderUid, silent = false) => (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const folder = findItemInCollection(collection, folderUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    if (!folder) {
      return reject(new Error('Folder not found'));
    }

    // Use draft if it exists, otherwise use root
    const folderRootToSave = transformFolderRootToSave(folder);

    const folderData = {
      name: folder.name,
      folderPathname: folder.pathname,
      collectionPathname: collection.pathname,
      root: folderRootToSave
    };

    console.log('Using unified storage layer for saveFolderRoot');
    storage
      .saveFolderRoot(folderData)
      .then(() => {
        if (!silent) {
          toast.success('Folder Settings saved successfully');
        }
        // If there was a draft, save it to root and clear the draft
        if (folder.draft) {
          dispatch(saveFolderDraft({ collectionUid, folderUid }));
        }
      })
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save folder settings!');
        reject(err);
      });
  });
};

export const saveMultipleCollections = (collectionDrafts) => (dispatch, getState) => {
  const state = getState();
  const { collections } = state.collections;

  return new Promise((resolve, reject) => {
    const savePromises = [];

    each(collectionDrafts, (collectionDraft) => {
      const collection = findCollectionByUid(collections, collectionDraft.collectionUid);
      if (collection) {
        const collectionCopy = cloneDeep(collection);
        const collectionRootToSave = transformCollectionRootToSave(collectionCopy);

        let savePromises = [];

        // Use unified storage layer
        console.log('Using unified storage layer for saveCollectionRoot');
        savePromises.push(storage.saveCollectionRoot(collectionCopy.pathname, collectionRootToSave, collectionCopy.brunoConfig));

        if (collectionCopy.draft?.brunoConfig) {
          console.log('Using unified storage layer for updateBrunoConfig');
          savePromises.push(storage.updateBrunoConfig(collectionCopy.draft.brunoConfig, collectionCopy.pathname, collectionCopy.root));
        }

        Promise.all(savePromises)
          .then(() => {
            dispatch(saveCollectionDraft({ collectionUid: collectionDraft.collectionUid }));
          })
          .catch((err) => {
            toast.error('Failed to save collection settings!');
            reject(err);
          });
      }
    });

    Promise.all(savePromises)
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save collection settings!');
        reject(err);
      });
  });
};

export const saveMultipleFolders = (folderDrafts) => (dispatch, getState) => {
  const state = getState();
  const { collections } = state.collections;

  return new Promise((resolve, reject) => {
    const savePromises = [];

    each(folderDrafts, (folderDraft) => {
      const collection = findCollectionByUid(collections, folderDraft.collectionUid);
      const folder = collection ? findItemInCollection(collection, folderDraft.folderUid) : null;

      if (collection && folder) {
        const folderRootToSave = transformFolderRootToSave(folder);
        const folderData = {
          name: folder.name,
          folderPathname: folder.pathname,
          collectionPathname: collection.pathname,
          root: folderRootToSave
        };

        console.log('Using unified storage layer for saveFolderRoot');
        const savePromise = storage
          .saveFolderRoot(folderData)
          .then(() => {
            if (folder.draft) {
              dispatch(saveFolderDraft({ collectionUid: folderDraft.collectionUid, folderUid: folderDraft.folderUid }));
            }
          });

        savePromises.push(savePromise);
      }
    });

    Promise.all(savePromises)
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save folder settings!');
        reject(err);
      });
  });
};

export const sendCollectionOauth2Request = (collectionUid, itemUid) => (dispatch, getState) => {
  const state = getState();
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    let collectionCopy = cloneDeep(collection);

    // add selected global env variables to the collection object
    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;

    const environment = findEnvironmentInCollection(collectionCopy, collection.activeEnvironmentUid);

    _sendCollectionOauth2Request(collectionCopy, environment, collectionCopy.runtimeVariables)
      .then((response) => {
        if (response?.data?.error) {
          toast.error(response?.data?.error);
        } else {
          toast.success('Request made successfully');
        }
        return response;
      })
      .then(resolve)
      .catch((err) => {
        toast.error(err.message);
      });
  });
};

export const wsConnectOnly = (item, collectionUid) => (dispatch, getState) => {
  const state = getState();
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise(async (resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    let collectionCopy = cloneDeep(collection);

    const itemCopy = cloneDeep(item);

    const requestUid = uuid();
    itemCopy.requestUid = requestUid;

    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;

    const environment = findEnvironmentInCollection(collectionCopy, collectionCopy.activeEnvironmentUid);

    connectWS(itemCopy, collectionCopy, environment, collectionCopy.runtimeVariables, { connectOnly: true })
      .then(resolve)
      .catch((err) => {
        toast.error(err.message);
      });
  });
};

/**
 * Extract prompt variables from a request, collection, and environment variables.
 * Tries to respect the hierarchy of the variables and avoid unnecessary prompts as much as possible
 *
 * @param {*} item
 * @param {*} collection
 * @returns {Promise<Object>} A promise that resolves with the prompt variables or null if no prompt variables are found
 */
const extractPromptVariablesForRequest = async (item, collection) => {
  return new Promise(async (resolve, reject) => {
    // Ensure window contains promptForVariables function
    if (typeof window === 'undefined' || typeof window.promptForVariables !== 'function') {
      console.error('Failed to initialize prompt variables: window.promptForVariables is not available. '
        + 'This may indicate an initialization issue with the app environment.');
      return resolve(null);
    }

    const prompts = [];
    const request = item.draft?.request ?? item.request ?? {};
    const allVariables = getAllVariables(collection, item);
    const clientCertConfig = get(collection, 'brunoConfig.clientCertificates.certs', []);
    const requestTreePath = getTreePathFromCollectionToItem(collection, item);
    // Get active headers from collection, folders, and request by priority order
    const headers = mergeHeaders(collection, request, requestTreePath);
    // Get request auth or inherited auth
    const resolvedAuthRequest = resolveInheritedAuth(item, collection);

    for (let clientCert of clientCertConfig) {
      const domain = interpolateUrl({ url: clientCert?.domain, variables: allVariables });

      if (domain) {
        const hostRegex = '^(https:\\/\\/|grpc:\\/\\/|grpcs:\\/\\/)?' + domain.replaceAll('.', '\\.').replaceAll('*', '.*');
        const requestUrl = interpolateUrl({ url: request.url, variables: allVariables });
        if (requestUrl.match(hostRegex)) {
          prompts.push(...extractPromptVariables(clientCert));
        }
      }
    }

    // Attempt to extract unique prompt variables from anywhere in the request and environment variables.
    prompts.push(...extractPromptVariables(allVariables));
    prompts.push(...extractPromptVariables(request.body?.[request.body.mode]));
    prompts.push(...extractPromptVariables(headers));
    prompts.push(...extractPromptVariables(request.params));
    prompts.push(...extractPromptVariables(resolvedAuthRequest.auth));
    prompts.push(...extractPromptVariables(request.url));

    // Remove duplicates
    const uniquePrompts = Array.from(new Set(prompts));

    // If no prompt variables are found, return null
    if (!uniquePrompts?.length) {
      return resolve(null);
    }

    try {
      // Prompt user for values if any prompt variables are found
      const userValues = await window.promptForVariables(uniquePrompts);
      const promptVariables = {};
      // Populate runtimeVariables with user input for prompt variables
      for (const prompt of uniquePrompts) {
        promptVariables[`?${prompt}`] = userValues[prompt] ?? '';
      }

      return resolve(promptVariables);
    } catch (error) {
      return reject(error);
    }
  });
};

export const sendRequest = (item, collectionUid) => (dispatch, getState) => {
  const state = getState();
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const itemUid = item?.uid;

  return new Promise(async (resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    let collectionCopy = cloneDeep(collection);

    const itemCopy = cloneDeep(item);

    // add selected global env variables to the collection object
    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;

    const requestUid = uuid();
    itemCopy.requestUid = requestUid;

    try {
      const promptVariables = await extractPromptVariablesForRequest(itemCopy, collectionCopy);
      collectionCopy.promptVariables = promptVariables ?? {};
    } catch (error) {
      if (error === 'cancelled') {
        return resolve(); // Resolve without error if user cancels prompt
      }
      return reject(error);
    }

    await dispatch(
      updateResponsePaneScrollPosition({
        uid: state.tabs.activeTabUid,
        scrollY: 0
      })
    );

    await dispatch(
      initRunRequestEvent({
        requestUid,
        itemUid,
        collectionUid
      })
    );

    const environment = findEnvironmentInCollection(collectionCopy, collectionCopy.activeEnvironmentUid);
    const isGrpcRequest = itemCopy.type === 'grpc-request';
    const isWsRequest = itemCopy.type === 'ws-request';
    if (isGrpcRequest) {
      sendGrpcRequest(itemCopy, collectionCopy, environment, collectionCopy.runtimeVariables)
        .then(resolve)
        .catch((err) => {
          toast.error(err.message);
        });
    } else if (isWsRequest) {
      sendWsRequest(itemCopy, collectionCopy, environment, collectionCopy.runtimeVariables)
        .then(resolve)
        .catch((err) => {
          toast.error(err.message);
        });
    } else {
      sendNetworkRequest(itemCopy, collectionCopy, environment, collectionCopy.runtimeVariables)
        .then((response) => {
          // Ensure any timestamps in the response are converted to numbers
          const serializedResponse = {
            ...response,
            timeline: response.timeline?.map((entry) => ({
              ...entry,
              timestamp: entry.timestamp instanceof Date ? entry.timestamp.getTime() : entry.timestamp
            }))
          };

          return dispatch(
            responseReceived({
              itemUid,
              collectionUid,
              response: serializedResponse
            })
          );
        })
        .then(resolve)
        .catch((err) => {
          if (err && err.message === 'Error invoking remote method \'send-http-request\': Error: Request cancelled') {
            dispatch(
              responseReceived({
                itemUid,
                collectionUid,
                response: null
              })
            );
            return;
          }

          const errorResponse = {
            status: 'Error',
            isError: true,
            error: err.message ?? 'Something went wrong',
            size: 0,
            duration: 0
          };

          dispatch(
            responseReceived({
              itemUid,
              collectionUid,
              response: errorResponse
            })
          );
        });
    }
  });
};

export const cancelRequest = (cancelTokenUid, item, collection) => (dispatch) => {
  cancelNetworkRequest(cancelTokenUid)
    .then(() => {
      dispatch(
        requestCancelled({
          itemUid: item.uid,
          collectionUid: collection.uid
        })
      );
    })
    .catch((err) => console.log(err));
};

export const cancelRunnerExecution = (cancelTokenUid) => (dispatch) => {
  cancelNetworkRequest(cancelTokenUid).catch((err) => console.log(err));
};

export const runCollectionFolder
  = (collectionUid, folderUid, recursive, delay, tags, selectedRequestUids) => (dispatch, getState) => {
    const state = getState();
    const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    return new Promise((resolve, reject) => {
      if (!collection) {
        return reject(new Error('Collection not found'));
      }

      let collectionCopy = cloneDeep(collection);

      // add selected global env variables to the collection object
      const globalEnvironmentVariables = getGlobalEnvironmentVariables({
        globalEnvironments,
        activeGlobalEnvironmentUid
      });
      collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;

      const folder = findItemInCollection(collectionCopy, folderUid);

      if (folderUid && !folder) {
        return reject(new Error('Folder not found'));
      }

      const environment = findEnvironmentInCollection(collectionCopy, collection.activeEnvironmentUid);

      dispatch(
        resetRunResults({
          collectionUid: collection.uid
        })
      );

      console.log('Using unified storage layer for runCollectionFolder');
      storage
        .runCollectionFolder(
          folder,
          collectionCopy,
          environment,
          collectionCopy.runtimeVariables,
          recursive,
          delay,
          tags,
          selectedRequestUids
        )
        .then(resolve)
        .catch((err) => {
          toast.error(get(err, 'error.message') || 'Something went wrong!');
          reject(err);
        });
    });
  };

export const newFolder = (folderName, directoryName, collectionUid, itemUid) => async (dispatch, getState) => {
  console.log('📁 [newFolder] Using unified storage layer');

  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const parentItem = itemUid ? findItemInCollection(collection, itemUid) : collection;

  if (!collection) {
    throw new Error('Collection not found');
  }

  // Check for duplicate folder names
  const parentItems = parentItem.items || collection.items || [];
  const folderWithSameNameExists = find(
    parentItems,
    (i) => i.type === 'folder' && trim(i.filename) === trim(directoryName)
  );

  if (folderWithSameNameExists) {
    throw new Error('Duplicate folder names under same parent folder are not allowed');
  }

  try {
    const result = await storage.createFolder(collectionUid, folderName, itemUid);
    return result;
  } catch (error) {
    toast.error('Failed to create a new folder!');
    throw error;
  }
};

export const renameItem
  = ({ newName, newFilename, itemUid, collectionUid }) =>
    (dispatch, getState) => {
      const state = getState();
      const collection = findCollectionByUid(state.collections.collections, collectionUid);

      return new Promise((resolve, reject) => {
        if (!collection) {
          return reject(new Error('Collection not found'));
        }

        const collectionCopy = cloneDeep(collection);
        const item = findItemInCollection(collectionCopy, itemUid);
        if (!item) {
          return reject(new Error('Unable to locate item'));
        }

        // Use unified storage layer
        console.log('Using unified storage layer for renameItem');

        const renameName = async () => {
          return storage.renameItemName(item.pathname, newName, collection.pathname).catch((err) => {
            toast.error('Failed to rename the item name');
            console.error(err);
            throw new Error('Failed to rename the item name');
          });
        };

        const renameFile = async () => {
          const dirname = path.dirname(item.pathname);
          let newPath = '';
          if (item.type === 'folder') {
            newPath = path.join(dirname, trim(newFilename));
          } else {
            const filename = resolveRequestFilename(newFilename, collection.format);
            newPath = path.join(dirname, filename);
          }

          return storage.renameItemFilename(item.pathname, newPath, newName, newFilename, collection.pathname)
            .catch((err) => {
              console.error(err);
              throw new Error('Duplicate request names are not allowed under the same folder');
            });
        };

        let renameOperation = null;
        if (newName) renameOperation = renameName;
        if (newFilename) renameOperation = renameFile;

        if (!renameOperation) {
          resolve();
        }

        renameOperation()
          .then(() => {
            toast.success('Item renamed successfully');
            resolve();
          })
          .catch((err) => reject(err));
      });
    };

export const cloneItem = (newName, newFilename, itemUid, collectionUid) => (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      throw new Error('Collection not found');
    }
    const collectionCopy = cloneDeep(collection);
    const item = findItemInCollection(collectionCopy, itemUid);
    if (!item) {
      throw new Error('Unable to locate item');
    }

    if (isItemAFolder(item)) {
      const parentFolder = findParentItemInCollection(collection, item.uid) || collection;

      const folderWithSameNameExists = find(
        parentFolder.items,
        (i) => i.type === 'folder' && trim(i?.filename) === trim(newFilename)
      );

      if (folderWithSameNameExists) {
        return reject(new Error('Duplicate folder names under same parent folder are not allowed'));
      }

      set(item, 'name', newName);
      set(item, 'filename', newFilename);
      set(item, 'root.meta.name', newName);
      set(item, 'root.meta.seq', parentFolder?.items?.length + 1);

      const collectionPath = path.join(parentFolder.pathname, newFilename);

      // Use unified storage layer
      console.log('Using unified storage layer for cloneFolder');
      storage.cloneFolder(item, collectionPath, collection.pathname).then(resolve).catch(reject);
      return;
    }

    const parentItem = findParentItemInCollection(collectionCopy, itemUid);
    const filename = resolveRequestFilename(newFilename, collection.format);
    const itemToSave = refreshUidsInItem(transformRequestToSaveToFilesystem(item));
    set(itemToSave, 'name', trim(newName));
    set(itemToSave, 'filename', trim(filename));
    if (!parentItem) {
      const reqWithSameNameExists = find(
        collection.items,
        (i) => i.type !== 'folder' && trim(i.filename) === trim(filename)
      );
      if (!reqWithSameNameExists) {
        const fullPathname = path.join(collection.pathname, filename);
        const requestItems = filter(collection.items, (i) => i.type !== 'folder');
        itemToSave.seq = requestItems ? requestItems.length + 1 : 1;

        // Use unified storage layer
        console.log('Using unified storage layer for newRequest (cloneItem - collection root)');
        itemSchema
          .validate(itemToSave)
          .then(() => storage.newRequest(fullPathname, itemToSave))
          .then(resolve)
          .catch(reject);

        dispatch(
          insertTaskIntoQueue({
            uid: uuid(),
            type: 'OPEN_REQUEST',
            collectionUid,
            itemPathname: fullPathname
          })
        );
      } else {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }
    } else {
      const reqWithSameNameExists = find(
        parentItem.items,
        (i) => i.type !== 'folder' && trim(i.filename) === trim(filename)
      );
      if (!reqWithSameNameExists) {
        const dirname = path.dirname(item.pathname);
        const fullName = path.join(dirname, filename);
        const requestItems = filter(parentItem.items, (i) => i.type !== 'folder');
        itemToSave.seq = requestItems ? requestItems.length + 1 : 1;

        // Use unified storage layer
        console.log('Using unified storage layer for newRequest (cloneItem - in folder)');
        itemSchema
          .validate(itemToSave)
          .then(() => storage.newRequest(fullName, itemToSave))
          .then(resolve)
          .catch(reject);

        dispatch(
          insertTaskIntoQueue({
            uid: uuid(),
            type: 'OPEN_REQUEST',
            collectionUid,
            itemPathname: fullName
          })
        );
      } else {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }
    }
  });
};

export const pasteItem = (targetCollectionUid, targetItemUid = null) => (dispatch, getState) => {
  const state = getState();

  const clipboardResult = brunoClipboard.read();

  if (!clipboardResult.hasData) {
    return Promise.reject(new Error('No item in clipboard'));
  }

  const targetCollection = findCollectionByUid(state.collections.collections, targetCollectionUid);

  if (!targetCollection) {
    return Promise.reject(new Error('Target collection not found'));
  }

  return new Promise(async (resolve, reject) => {
    try {
      for (const clipboardItem of clipboardResult.items) {
        const copiedItem = cloneDeep(clipboardItem);

        const targetCollectionCopy = cloneDeep(targetCollection);
        let targetItem = null;
        let targetParentPathname = targetCollection.pathname;

        // If targetItemUid is provided, we're pasting into a folder
        if (targetItemUid) {
          targetItem = findItemInCollection(targetCollectionCopy, targetItemUid);
          if (!targetItem) {
            return reject(new Error('Target folder not found'));
          }
          if (!isItemAFolder(targetItem)) {
            return reject(new Error('Target must be a folder or collection'));
          }
          targetParentPathname = targetItem.pathname;
        }

        const existingItems = targetItem ? targetItem.items : targetCollection.items;

        // Handle folder pasting
        if (isItemAFolder(copiedItem)) {
          // Generate unique name for folder
          const { newName, newFilename } = generateUniqueName(copiedItem.name, existingItems, true);

          set(copiedItem, 'name', newName);
          set(copiedItem, 'filename', newFilename);
          set(copiedItem, 'root.meta.name', newName);
          set(copiedItem, 'root.meta.seq', (existingItems?.length ?? 0) + 1);

          const fullPathname = path.join(targetParentPathname, newFilename);

          // Use unified storage layer
          console.log('Using unified storage layer for cloneFolder (pasteItem)');
          await storage.cloneFolder(copiedItem, fullPathname, targetCollection.pathname);
        } else {
          // Handle request pasting
          // Generate unique name for request
          const { newName, newFilename } = generateUniqueName(copiedItem.name, existingItems, false);

          const filename = resolveRequestFilename(newFilename, targetCollection.format);
          const itemToSave = refreshUidsInItem(transformRequestToSaveToFilesystem(copiedItem));
          set(itemToSave, 'name', trim(newName));
          set(itemToSave, 'filename', trim(filename));

          const fullPathname = path.join(targetParentPathname, filename);
          const requestItems = filter(existingItems, (i) => i.type !== 'folder');
          itemToSave.seq = requestItems ? requestItems.length + 1 : 1;

          // Use unified storage layer
          console.log('Using unified storage layer for newRequest (pasteItem)');
          await itemSchema.validate(itemToSave);
          await storage.newRequest(fullPathname, itemToSave, targetCollection.format);

          dispatch(insertTaskIntoQueue({
            uid: uuid(),
            type: 'OPEN_REQUEST',
            collectionUid: targetCollectionUid,
            itemPathname: fullPathname
          }));
        }
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteItem = (itemUid, collectionUid) => async (dispatch, getState) => {
  console.log('🗑️  [deleteItem] Using unified storage layer');

  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  if (!collection) {
    throw new Error('Collection not found');
  }

  const item = findItemInCollection(collection, itemUid);
  if (!item) {
    throw new Error('Unable to locate item');
  }

  try {
    // Use unified storage layer
    await storage.deleteItem(itemUid, collectionUid);

    // Reorder items in parent directory after deletion
    const parentDirectoryItem = findParentItemInCollection(collection, itemUid) || collection;
    if (parentDirectoryItem.items) {
      const requestAndFolderTypes = [...REQUEST_TYPES, 'folder'];
      const directoryItemsWithOnlyRequestAndFolders = parentDirectoryItem.items.filter((i) => requestAndFolderTypes.includes(i.type));
      const directoryItemsWithoutDeletedItem = directoryItemsWithOnlyRequestAndFolders.filter((i) => i.uid !== itemUid);
      const reorderedSourceItems = getReorderedItemsInSourceDirectory({
        items: directoryItemsWithoutDeletedItem
      });
      if (reorderedSourceItems?.length) {
        await dispatch(updateItemsSequences({ itemsToResequence: reorderedSourceItems, collectionUid }));
      }
    }
  } catch (error) {
    console.error('❌ [deleteItem] Failed:', error);
    throw error;
  }
};

export const sortCollections = (payload) => (dispatch) => {
  dispatch(_sortCollections(payload));
};

export const moveItem
  = ({ targetDirname, sourcePathname }) =>
    async (dispatch, getState) => {
      console.log('📦 [moveItem] Using unified storage layer');
      return storage.moveItem({ targetDirname, sourcePathname });
    };

export const handleCollectionItemDrop
  = ({ targetItem, draggedItem, dropType, collectionUid }) =>
    (dispatch, getState) => {
      const state = getState();
      const collection = findCollectionByUid(state.collections.collections, collectionUid);
      // if its withincollection set the source to current collection,
      // if its cross collection set the source to the source collection
      const sourceCollectionUid = draggedItem.sourceCollectionUid;
      const isCrossCollectionMove = sourceCollectionUid && collectionUid !== sourceCollectionUid;
      const sourceCollection = isCrossCollectionMove ? findCollectionByUid(state.collections.collections, sourceCollectionUid) : collection;
      const { uid: draggedItemUid, pathname: draggedItemPathname } = draggedItem;
      const { uid: targetItemUid, pathname: targetItemPathname } = targetItem;
      const targetItemDirectory = findParentItemInCollection(collection, targetItemUid) || collection;
      const targetItemDirectoryItems = cloneDeep(targetItemDirectory.items);
      const draggedItemDirectory = findParentItemInCollection(sourceCollection, draggedItemUid) || sourceCollection;
      const draggedItemDirectoryItems = cloneDeep(draggedItemDirectory.items);

      const handleMoveToNewLocation = async ({
        draggedItem,
        draggedItemDirectoryItems,
        targetItem,
        targetItemDirectoryItems,
        newPathname,
        dropType
      }) => {
        const { uid: targetItemUid } = targetItem;
        const { pathname: draggedItemPathname, uid: draggedItemUid } = draggedItem;

        // Determine if cloud mode or local mode
        const isCloudMode = !draggedItemPathname && draggedItemUid;

        if (isCloudMode) {
          // Cloud mode: pass itemUid and targetParentItemId
          await dispatch(moveItem({
            itemUid: draggedItemUid,
            targetParentItemId: newPathname // In cloud mode, newPathname is actually the parent uid
          }));
        } else {
          // Local mode: pass targetDirname and sourcePathname
          const newDirname = path.dirname(newPathname);
          await dispatch(moveItem({
            targetDirname: newDirname,
            sourcePathname: draggedItemPathname
          }));
        }

        // Update sequences in the source directory
        if (draggedItemDirectoryItems?.length) {
          // reorder items in the source directory
          const draggedItemDirectoryItemsWithoutDraggedItem = draggedItemDirectoryItems.filter((i) => i.uid !== draggedItemUid);
          const reorderedSourceItems = getReorderedItemsInSourceDirectory({
            items: draggedItemDirectoryItemsWithoutDraggedItem
          });
          if (reorderedSourceItems?.length) {
            await dispatch(updateItemsSequences({ itemsToResequence: reorderedSourceItems, collectionUid: sourceCollectionUid || collectionUid }));
          }
        }

        // Update sequences in the target directory (if dropping adjacent)
        if (dropType === 'adjacent') {
          const targetItemSequence = targetItemDirectoryItems.find((i) => i.uid === targetItemUid)?.seq;

          const draggedItemWithNewPathAndSequence = {
            ...draggedItem,
            pathname: newPathname,
            seq: targetItemSequence
          };

          // draggedItem is added to the targetItem's directory
          const reorderedTargetItems = getReorderedItemsInTargetDirectory({
            items: [...targetItemDirectoryItems, draggedItemWithNewPathAndSequence],
            targetItemUid,
            draggedItemUid
          });

          if (reorderedTargetItems?.length) {
            await dispatch(updateItemsSequences({ itemsToResequence: reorderedTargetItems, collectionUid }));
          }
        }
      };

      const handleReorderInSameLocation = async ({ draggedItem, targetItem, targetItemDirectoryItems }) => {
        const { uid: targetItemUid } = targetItem;
        const { uid: draggedItemUid } = draggedItem;

        // reorder items in the targetItem's directory
        const reorderedItems = getReorderedItemsInTargetDirectory({
          items: targetItemDirectoryItems,
          targetItemUid,
          draggedItemUid
        });

        if (reorderedItems?.length) {
          await dispatch(updateItemsSequences({ itemsToResequence: reorderedItems, collectionUid }));
        }
      };

      return new Promise(async (resolve, reject) => {
        try {
          const newPathname = calculateDraggedItemNewPathname({
            draggedItem,
            targetItem,
            dropType,
            collectionPathname: collection.pathname
          });
          if (!newPathname) return;
          if (targetItemPathname?.startsWith(draggedItemPathname)) return;

          // Discard operation if dragging a root item to the collection name (same location)
          const isTargetTheCollection = targetItemPathname === collection.pathname;
          const isDraggedItemAtRoot = draggedItemDirectory === sourceCollection;
          if (isTargetTheCollection && isDraggedItemAtRoot && !isCrossCollectionMove) {
            return;
          }

          if (newPathname !== draggedItemPathname) {
            await handleMoveToNewLocation({
              targetItem,
              targetItemDirectoryItems,
              draggedItem,
              draggedItemDirectoryItems,
              newPathname,
              dropType
            });
          } else {
            await handleReorderInSameLocation({ draggedItem, targetItemDirectoryItems, targetItem });
          }
          resolve();
        } catch (error) {
          console.error(error);
          toast.error(error?.message);
          reject(error);
        }
      });
    };

export const updateItemsSequences
  = ({ itemsToResequence, collectionUid }) =>
    (dispatch, getState) => {
      return new Promise((resolve, reject) => {
        const state = getState();
        const collection = findCollectionByUid(state.collections.collections, collectionUid);

        if (!collection) {
          return reject(new Error('Collection not found'));
        }

        // Use unified storage layer
        console.log('Using unified storage layer for resequenceItems');
        storage.resequenceItems(itemsToResequence, collection.pathname).then(resolve).catch(reject);
      });
    };

export const newHttpRequest = (params) => (dispatch, getState) => {
  const {
    requestName,
    filename,
    requestType,
    requestUrl,
    requestMethod,
    collectionUid,
    itemUid,
    headers,
    body,
    auth,
    settings,
    isTransient = false
  } = params;

  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    // Get temp directory if isTransient is true
    const tempDirectory = isTransient ? state.collections.tempDirectories?.[collectionUid] : null;

    const parts = splitOnFirst(requestUrl, '?');
    const queryParams = parseQueryParams(parts[1]);
    each(queryParams, (urlParam) => {
      urlParam.enabled = true;
      urlParam.type = 'query';
    });

    const pathParams = parsePathParams(requestUrl);
    each(pathParams, (pathParm) => {
      pathParams.enabled = true;
      pathParm.type = 'path';
    });

    const params = [...queryParams, ...pathParams];

    const item = {
      uid: uuid(),
      type: requestType,
      name: requestName,
      filename,
      isTransient: isTransient,
      request: {
        method: requestMethod,
        url: requestUrl,
        headers: headers ?? [],
        params,
        body: body ?? {
          mode: 'none',
          json: null,
          text: null,
          xml: null,
          sparql: null,
          multipartForm: [],
          formUrlEncoded: [],
          file: []
        },
        vars: {
          req: [],
          res: []
        },
        assertions: [],
        auth: auth ?? {
          mode: 'inherit'
        }
      },
      settings: settings ?? {
        encodeUrl: true
      }
    };

    // itemUid is null when we are creating a new request at the root level
    // For transient requests, itemUid is always null
    const resolvedFilename = resolveRequestFilename(filename, collection.format);

    if (isTransient) {
      // Transient requests are always created in temp directory
      // Check for duplicates only among other transient requests
      const allItems = flattenItems(collection.items);
      const transientRequests = filter(
        allItems,
        (i) => isItemARequest(i) && i.pathname && i.pathname.startsWith(tempDirectory)
      );
      const reqWithSameNameExists = find(transientRequests, (i) => trim(i.filename) === trim(resolvedFilename));
      const items = filter(collection.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;

      if (!reqWithSameNameExists) {
        const fullName = path.join(tempDirectory, resolvedFilename);

        // Use unified storage layer
        console.log('Using unified storage layer for newRequest (newHttpRequest - transient)');
        storage.newRequest(fullName, item)
          .then(() => {
            // task middleware will track this and open the new request in a new tab once request is created
            dispatch(
              insertTaskIntoQueue({
                uid: uuid(),
                type: 'OPEN_REQUEST',
                collectionUid,
                itemPathname: fullName,
                preview: false
              })
            );
            resolve();
          })
          .catch(reject);
      } else {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }
    } else if (!itemUid) {
      // Regular request at root level
      const reqWithSameNameExists = find(
        collection.items,
        (i) => i.type !== 'folder' && trim(i.filename) === trim(resolvedFilename)
      );
      const items = filter(collection.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;

      if (!reqWithSameNameExists) {
        const fullName = path.join(collection.pathname, resolvedFilename);

        // Use unified storage layer
        console.log('Using unified storage layer for newRequest (newHttpRequest - root)');
        storage.newRequest(fullName, item)
          .then(() => {
            // task middleware will track this and open the new request in a new tab once request is created
            dispatch(
              insertTaskIntoQueue({
                uid: uuid(),
                type: 'OPEN_REQUEST',
                collectionUid,
                itemPathname: fullName
              })
            );
            resolve();
          })
          .catch(reject);
      } else {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }
    } else {
      const currentItem = findItemInCollection(collection, itemUid);
      if (currentItem) {
        const reqWithSameNameExists = find(
          currentItem.items,
          (i) => i.type !== 'folder' && trim(i.filename) === trim(resolvedFilename)
        );
        const items = filter(currentItem.items, (i) => isItemAFolder(i) || isItemARequest(i));
        item.seq = items.length + 1;
        if (!reqWithSameNameExists) {
          const fullName = path.join(currentItem.pathname, resolvedFilename);

          // Use unified storage layer
          console.log('Using unified storage layer for newRequest (newHttpRequest - in folder)');
          storage.newRequest(fullName, item)
            .then(() => {
              // task middleware will track this and open the new request in a new tab once request is created
              dispatch(
                insertTaskIntoQueue({
                  uid: uuid(),
                  type: 'OPEN_REQUEST',
                  collectionUid,
                  itemPathname: fullName
                })
              );
              resolve();
            })
            .catch(reject);
        } else {
          return reject(new Error('Duplicate request names are not allowed under the same folder'));
        }
      }
    }
  });
};

export const newGrpcRequest = (params) => (dispatch, getState) => {
  const { requestName, filename, requestUrl, collectionUid, body, auth, headers, itemUid, isTransient = false } = params;

  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    // Get temp directory if isTransient is true
    const tempDirectory = isTransient ? state.collections.tempDirectories?.[collectionUid] : null;

    // do we need to handle query, path params for grpc requests?
    // skipping for now

    const item = {
      uid: uuid(),
      name: requestName,
      filename,
      type: 'grpc-request',
      isTransient: isTransient,
      headers: headers ?? [],
      request: {
        url: requestUrl,
        body: body ?? {
          mode: 'grpc',
          grpc: [
            {
              name: 'message 1',
              content: '{}'
            }
          ]
        },
        auth: auth ?? {
          mode: 'inherit'
        },
        vars: {
          req: [],
          res: []
        },
        script: {
          req: null,
          res: null
        },
        assertions: [],
        tests: null
      }
    };

    // itemUid is null when we are creating a new request at the root level
    // For transient requests, itemUid is always null
    const resolvedFilename = resolveRequestFilename(filename, collection.format);

    if (isTransient) {
      // Transient requests are always created in temp directory
      // Check for duplicates only among other transient requests
      const allItems = flattenItems(collection.items);
      const transientRequests = filter(
        allItems,
        (i) => isItemARequest(i) && i.pathname && i.pathname.startsWith(tempDirectory)
      );
      const reqWithSameNameExists = find(transientRequests, (i) => trim(i.filename) === trim(resolvedFilename));

      if (reqWithSameNameExists) {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }

      const items = filter(collection.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;
      const fullName = path.join(tempDirectory, resolvedFilename);

      // Use unified storage layer
      console.log('Using unified storage layer for newRequest (newGrpcRequest - transient)');
      storage.newRequest(fullName, item)
        .then(() => {
          // task middleware will track this and open the new request in a new tab once request is created
          dispatch(
            insertTaskIntoQueue({
              uid: uuid(),
              type: 'OPEN_REQUEST',
              collectionUid,
              itemPathname: fullName,
              preview: false
            })
          );
          resolve();
        })
        .catch(reject);
    } else {
      // Regular request (can be at root or in a folder)
      const parentItem = itemUid ? findItemInCollection(collection, itemUid) : collection;

      if (!parentItem) {
        return reject(new Error('Parent item not found'));
      }

      const reqWithSameNameExists = find(
        parentItem.items,
        (i) => i.type !== 'folder' && trim(i.filename) === trim(resolvedFilename)
      );

      if (reqWithSameNameExists) {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }

      const items = filter(parentItem.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;
      const fullName = path.join(parentItem.pathname, resolvedFilename);

      // Use unified storage layer
      console.log('Using unified storage layer for newRequest (newGrpcRequest - regular)');
      storage.newRequest(fullName, item)
        .then(() => {
          // task middleware will track this and open the new request in a new tab once request is created
          dispatch(
            insertTaskIntoQueue({
              uid: uuid(),
              type: 'OPEN_REQUEST',
              collectionUid,
              itemPathname: fullName
            })
          );
          resolve();
        })
        .catch(reject);
    }
  });
};

export const newWsRequest = (params) => (dispatch, getState) => {
  const { requestName, requestMethod, filename, requestUrl, collectionUid, body, auth, headers, itemUid, isTransient = false } = params;

  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    // Get temp directory if isTransient is true
    const tempDirectory = isTransient ? state.collections.tempDirectories?.[collectionUid] : null;

    const item = {
      uid: uuid(),
      name: requestName,
      filename,
      type: 'ws-request',
      isTransient: isTransient,
      headers: headers ?? [],
      request: {
        url: requestUrl,
        method: requestMethod,
        params: [],
        body: body ?? {
          mode: 'ws',
          ws: [
            {
              name: 'message 1',
              type: 'json',
              content: '{}'
            }
          ]
        },
        auth: auth ?? {
          mode: 'inherit'
        },
        vars: {
          req: [],
          res: []
        },
        script: {
          req: null,
          res: null
        },
        assertions: [],
        tests: null
      }
    };

    // itemUid is null when we are creating a new request at the root level
    // For transient requests, itemUid is always null
    const resolvedFilename = resolveRequestFilename(filename, collection.format);

    if (isTransient) {
      // Transient requests are always created in temp directory
      // Check for duplicates only among other transient requests
      const allItems = flattenItems(collection.items);
      const transientRequests = filter(
        allItems,
        (i) => isItemARequest(i) && i.pathname && i.pathname.startsWith(tempDirectory)
      );
      const reqWithSameNameExists = find(transientRequests, (i) => trim(i.filename) === trim(resolvedFilename));

      if (reqWithSameNameExists) {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }

      const items = filter(collection.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;
      const fullName = path.join(tempDirectory, resolvedFilename);

      // Use unified storage layer
      console.log('Using unified storage layer for newRequest (newWsRequest - transient)');
      storage.newRequest(fullName, item)
        .then(() => {
          // task middleware will track this and open the new request in a new tab once request is created
          dispatch(
            insertTaskIntoQueue({
              uid: uuid(),
              type: 'OPEN_REQUEST',
              collectionUid,
              itemPathname: fullName,
              preview: false
            })
          );
          resolve();
        })
        .catch(reject);
    } else {
      // Regular request (can be at root or in a folder)
      const parentItem = itemUid ? findItemInCollection(collection, itemUid) : collection;

      if (!parentItem) {
        return reject(new Error('Parent item not found'));
      }

      const reqWithSameNameExists = find(
        parentItem.items,
        (i) => i.type !== 'folder' && trim(i.filename) === trim(resolvedFilename)
      );

      if (reqWithSameNameExists) {
        return reject(new Error('Duplicate request names are not allowed under the same folder'));
      }

      const items = filter(parentItem.items, (i) => isItemAFolder(i) || isItemARequest(i));
      item.seq = items.length + 1;
      const fullName = path.join(parentItem.pathname, resolvedFilename);
      console.log('Using unified storage layer for newRequestFile');
      storage
        .newRequestFile(fullName, item)
        .then(() => {
          // task middleware will track this and open the new request in a new tab once request is created
          dispatch(
            insertTaskIntoQueue({
              uid: uuid(),
              type: 'OPEN_REQUEST',
              collectionUid,
              itemPathname: fullName
            })
          );
          resolve();
        })
        .catch(reject);
    }
  });
};

export const loadGrpcMethodsFromReflection = (item, collectionUid, url) => async (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;

  return new Promise(async (resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const itemCopy = cloneDeep(item);
    const requestItem = itemCopy.draft ? itemCopy.draft : itemCopy;
    requestItem.request.url = url;
    const collectionCopy = cloneDeep(collection);
    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;
    const environment = findEnvironmentInCollection(collectionCopy, collectionCopy.activeEnvironmentUid);
    const runtimeVariables = collectionCopy.runtimeVariables;

    try {
      const promptVariables = await extractPromptVariablesForRequest(itemCopy, collectionCopy);
      if (promptVariables) {
        collectionCopy.promptVariables = promptVariables;
      }
    } catch (error) {
      if (error === 'cancelled') {
        return resolve(); // Resolve without error if user cancels prompt
      }
      return reject(error);
    }

    console.log('Using unified storage layer for loadMethodsReflection');
    storage
      .loadMethodsReflection({
        request: requestItem,
        collection: collectionCopy,
        environment,
        runtimeVariables
      })
      .then(resolve)
      .catch(reject);
  });
};

export const generateGrpcurlCommand = (item, collectionUid) => async (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const itemCopy = cloneDeep(item);
    const collectionCopy = cloneDeep(collection);

    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    collectionCopy.globalEnvironmentVariables = globalEnvironmentVariables;
    const environment = findEnvironmentInCollection(collectionCopy, collectionCopy.activeEnvironmentUid);
    const runtimeVariables = collectionCopy.runtimeVariables;

    console.log('Using unified storage layer for generateGrpcurl');
    storage
      .generateGrpcurl({ request: itemCopy, collection: collectionCopy, environment, runtimeVariables })
      .then(resolve)
      .catch(reject);
  });
};

export const addEnvironment = (name, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for createEnvironment');
    storage
      .createEnvironment(collection.pathname, name)
      .then(
        dispatch(
          updateLastAction({
            collectionUid,
            lastAction: {
              type: 'ADD_ENVIRONMENT',
              payload: name
            }
          })
        )
      )
      .then(resolve)
      .catch(reject);
  });
};

export const importEnvironment = ({ name, variables, color, collectionUid }) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const sanitizedName = sanitizeName(name);

    console.log('Using unified storage layer for createEnvironment');
    storage
      .createEnvironment(collection.pathname, sanitizedName, variables, color)
      .then(
        dispatch(
          updateLastAction({
            collectionUid,
            lastAction: {
              type: 'ADD_ENVIRONMENT',
              payload: sanitizedName
            }
          })
        )
      )
      .then(resolve)
      .catch(reject);
  });
};

export const copyEnvironment = (name, baseEnvUid, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const baseEnv = findEnvironmentInCollection(collection, baseEnvUid);
    if (!collection) {
      return reject(new Error('Environment not found'));
    }

    const sanitizedName = sanitizeName(name);

    // strip "ephemeral" metadata
    const variablesToCopy = (baseEnv.variables || [])
      .filter((v) => !v.ephemeral)
      .map(({ ephemeral, ...rest }) => {
        return rest;
      });

    console.log('Using unified storage layer for createEnvironment');
    storage
      .createEnvironment(collection.pathname, sanitizedName, variablesToCopy)
      .then(
        dispatch(
          updateLastAction({
            collectionUid,
            lastAction: {
              type: 'ADD_ENVIRONMENT',
              payload: sanitizedName
            }
          })
        )
      )
      .then(resolve)
      .catch(reject);
  });
};

export const renameEnvironment = (newName, environmentUid, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);
    const environment = findEnvironmentInCollection(collectionCopy, environmentUid);
    if (!environment) {
      return reject(new Error('Environment not found'));
    }

    const sanitizedName = sanitizeName(newName);
    const oldName = environment.name;
    environment.name = sanitizedName;

    // Use unified storage layer
    console.log('Using unified storage layer for renameEnvironment');
    environmentSchema
      .validate(environment)
      .then(() => storage.renameEnvironment(collection.pathname, oldName, sanitizedName))
      .then(resolve)
      .catch(reject);
  });
};

export const deleteEnvironment = (environmentUid, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);

    const environment = findEnvironmentInCollection(collectionCopy, environmentUid);
    if (!environment) {
      return reject(new Error('Environment not found'));
    }

    console.log('Using unified storage layer for deleteEnvironment');
    storage
      .deleteEnvironment(collection.pathname, environment.name)
      .then(resolve)
      .catch(reject);
  });
};

export const saveEnvironment = (variables, environmentUid, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);
    const environment = findEnvironmentInCollection(collectionCopy, environmentUid);
    if (!environment) {
      return reject(new Error('Environment not found'));
    }

    /*
     Modal Save writes what the user sees:
     - Non-ephemeral vars are saved as-is (without metadata)
     - Ephemeral vars:
       - if persistedValue exists, save that (explicit persisted case)
       - otherwise save the current UI value (treat as user-authored)
     */
    const persisted = buildPersistedEnvVariables(variables, { mode: 'save' });
    environment.variables = persisted;

    const envForValidation = cloneDeep(environment);

    // Use unified storage layer
    console.log('Using unified storage layer for saveEnvironment (main)');
    environmentSchema
      .validate(environment)
      .then(() => storage.saveEnvironment(collection.pathname, envForValidation))
      .then(() => {
        // Immediately sync Redux to the saved (persisted) set so old ephemerals
        // aren’t around when the watcher event arrives.
        dispatch(_saveEnvironment({ variables: persisted, environmentUid, collectionUid }));
      })
      .then(resolve)
      .catch(reject);
  });
};

export const updateEnvironmentColor = (environmentUid, color, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);
    const environment = findEnvironmentInCollection(collectionCopy, environmentUid);
    if (!environment) {
      return reject(new Error('Environment not found'));
    }

    environment.color = color;

    // Use unified storage layer
    console.log('Using unified storage layer for updateEnvironmentColor');
    storage.updateEnvironmentColor(collection.pathname, environment.name, color)
      .then(() => {
        dispatch(_updateEnvironmentColor({ environmentUid, color, collectionUid }));
        resolve();
      })
      .catch(reject);
  });
};

/**
 * Update a variable value directly in the file without affecting draft state
 * @param {string} pathname - File path
 * @param {Object} variable - Variable object with uid, name, value, type, enabled
 * @param {string} scopeType - Type of scope ('request', 'folder', 'collection')
 * @param {string} collectionUid - Collection UID
 * @param {string} itemUid - Item/Folder UID (for request/folder)
 */
const updateVariableInFile = (pathname, variable, scopeType, collectionUid, itemUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);

    console.log('Using unified storage layer for updateVariableInFile');
    storage
      .updateVariableInFile(pathname, variable, scopeType, collectionCopy.root, collectionCopy.format)
      .then(() => {
        // Update Redux state to reflect the change
        if (scopeType === 'request') {
          dispatch({
            type: 'collections/updateRequestVarValue',
            payload: { collectionUid, itemUid, variable }
          });
        } else if (scopeType === 'folder') {
          dispatch({
            type: 'collections/updateFolderVarValue',
            payload: { collectionUid, folderUid: itemUid, variable }
          });
        } else if (scopeType === 'collection') {
          dispatch({
            type: 'collections/updateCollectionVarValue',
            payload: { collectionUid, variable }
          });
        }

        resolve();
      })
      .catch(reject);
  });
};

/**
 * Helper: Execute update action with toast notification
 * @param {Function} action - The action to dispatch
 * @param {string} successMessage - Success toast message
 * @returns {Promise}
 */
const executeVariableUpdate = (dispatch, action, successMessage) => {
  return dispatch(action)
    .then(() => {
      toast.success(successMessage);
    });
};

/**
 * Update a variable value in its detected scope (inline editing)
 * @param {string} variableName - Name of the variable to update
 * @param {string} newValue - New value for the variable
 * @param {Object} scopeInfo - Scope information from getVariableScope()
 * @param {string} collectionUid - Collection UID
 */
export const updateVariableInScope = (variableName, newValue, scopeInfo, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    if (!scopeInfo || !variableName) {
      return reject(new Error('Invalid scope information or variable name'));
    }

    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    try {
      const { type, data } = scopeInfo;

      // Handle read-only variables early
      if (type === 'process.env') {
        toast.error('Process environment variables cannot be edited');
        return reject(new Error('Process environment variables are read-only'));
      }

      if (type === 'runtime' || (collection && collection.runtimeVariables && collection.runtimeVariables[variableName])) {
        toast.error('Runtime variables are set by scripts and cannot be edited');
        return reject(new Error('Runtime variables are read-only'));
      }

      // Validate collection for non-global scopes
      if (type !== 'global' && !collection) {
        return reject(new Error('Collection not found'));
      }

      switch (type) {
        case 'environment': {
          const { environment, variable } = data;

          if (!variable) {
            return reject(new Error('Variable not found'));
          }

          const updatedVariables = environment.variables.map((v) => {
            if (v.uid === variable.uid) {
              // Clear ephemeral metadata when user manually edits the value
              const { ephemeral, persistedValue, ...rest } = v;
              return { ...rest, value: newValue };
            }
            return v;
          });

          return dispatch(saveEnvironment(updatedVariables, environment.uid, collectionUid))
            .then(() => {
              toast.success(`Variable "${variableName}" updated`);
            })
            .then(resolve)
            .catch(reject);
        }

        case 'collection': {
          const { variable } = data;

          if (variable) {
            // Update existing variable in draft
            dispatch(updateCollectionVar({
              collectionUid,
              type: 'request',
              var: { ...variable, value: newValue }
            }));
          } else {
            // Create new variable in draft with actual values
            dispatch(addCollectionVar({
              collectionUid,
              type: 'request',
              var: { name: variableName, value: newValue, enabled: true }
            }));
          }

          // Save collection root to persist the changes
          return dispatch(saveCollectionRoot(collectionUid))
            .then(resolve)
            .catch(reject);
        }

        case 'folder': {
          const { folder, variable } = data;

          if (variable) {
            // Update existing variable in draft
            dispatch(updateFolderVar({
              collectionUid,
              folderUid: folder.uid,
              type: 'request',
              var: { ...variable, value: newValue }
            }));
          } else {
            // Create new variable in draft with actual values
            dispatch(addFolderVar({
              collectionUid,
              folderUid: folder.uid,
              type: 'request',
              var: { name: variableName, value: newValue, enabled: true }
            }));
          }

          // Save folder root to persist the changes
          return dispatch(saveFolderRoot(collectionUid, folder.uid))
            .then(resolve)
            .catch(reject);
        }

        case 'request': {
          const { item, variable } = data;

          if (variable) {
            // Update existing variable in draft
            dispatch(updateVar({
              collectionUid,
              itemUid: item.uid,
              type: 'request',
              var: { ...variable, value: newValue }
            }));
          } else {
            // Create new variable in draft with actual values
            dispatch(addVar({
              collectionUid,
              itemUid: item.uid,
              type: 'request',
              var: { name: variableName, value: newValue, local: false, enabled: true }
            }));
          }

          // Save request to persist the changes
          return dispatch(saveRequest(item.uid, collectionUid, true))
            .then(resolve)
            .catch(reject);
        }

        case 'global': {
          const globalEnvironments = state.globalEnvironments?.globalEnvironments || [];
          const activeGlobalEnvUid = state.globalEnvironments?.activeGlobalEnvironmentUid;

          if (!activeGlobalEnvUid) {
            return reject(new Error('No active global environment'));
          }

          const environment = globalEnvironments.find((env) => env.uid === activeGlobalEnvUid);

          if (!environment) {
            return reject(new Error('Global environment not found'));
          }

          const variable = environment.variables.find((v) => v.name === variableName && v.enabled);

          if (!variable) {
            return reject(new Error('Variable not found'));
          }

          const updatedVariables = environment.variables.map((v) => {
            if (v.uid === variable.uid) {
              // Clear ephemeral metadata when user manually edits the value
              const { ephemeral, persistedValue, ...rest } = v;
              return { ...rest, value: newValue };
            }
            return v;
          });

          return dispatch(saveGlobalEnvironment({ variables: updatedVariables, environmentUid: activeGlobalEnvUid }))
            .then(() => {
              toast.success(`Variable "${variableName}" updated`);
            })
            .then(resolve)
            .catch(reject);
        }
        case 'pathParam': {
          const { item } = data;
          const params = item.draft ? get(item, 'draft.request.params', []) : get(item, 'request.params', []);
          const pathParam = params.find((p) => p.type === 'path' && p.name === variableName);

          if (pathParam) {
            const updatedParam = { ...pathParam, value: newValue };
            dispatch(updatePathParam({
              pathParam: updatedParam,
              itemUid: item.uid,
              collectionUid: collection.uid
            }));
          }
          return dispatch(saveRequest(item.uid, collection.uid, true))
            .then(resolve)
            .catch(reject);
        }
        default:
          return reject(new Error(`Unknown scope type: ${type}`));
      }
    } catch (error) {
      toast.error(`Failed to update variable: ${error.message}`);
      reject(error);
    }
  });
};

export const mergeAndPersistEnvironment
  = ({ persistentEnvVariables, collectionUid }) =>
    (_dispatch, getState) => {
      return new Promise((resolve, reject) => {
        const state = getState();
        const collection = findCollectionByUid(state.collections.collections, collectionUid);

        if (!collection) {
          return reject(new Error('Collection not found'));
        }

        const environmentUid = collection.activeEnvironmentUid;
        if (!environmentUid) {
          return reject(new Error('No active environment found'));
        }

        const collectionCopy = cloneDeep(collection);
        const environment = findEnvironmentInCollection(collectionCopy, environmentUid);
        if (!environment) {
          return reject(new Error('Environment not found'));
        }

        // Only proceed if there are persistent variables to save
        if (!persistentEnvVariables || Object.keys(persistentEnvVariables).length === 0) {
          return resolve();
        }

        let existingVars = environment.variables || [];

        let normalizedNewVars = Object.entries(persistentEnvVariables).map(([name, value]) => ({
          uid: uuid(),
          name,
          value,
          type: 'text',
          enabled: true,
          secret: false
        }));

        const merged = existingVars.map((v) => {
          const found = normalizedNewVars.find((nv) => nv.name === v.name);
          if (found) {
            return { ...v, value: found.value };
          }
          return v;
        });
        normalizedNewVars.forEach((nv) => {
          if (!merged.some((v) => v.name === nv.name)) {
            merged.push(nv);
          }
        });

        // Save all non-ephemeral vars and all variables that were previously persisted
        const persistedNames = new Set(Object.keys(persistentEnvVariables));

        // Add all existing non-ephemeral variables to persistedNames so they are preserved
        existingVars.forEach((v) => {
          if (!v.ephemeral) {
            persistedNames.add(v.name);
          }
        });

        const environmentToSave = cloneDeep(environment);
        environmentToSave.variables = buildPersistedEnvVariables(merged, { mode: 'merge', persistedNames });

        // Use unified storage layer
        console.log('Using unified storage layer for saveEnvironment (syncVariableFromScript)');
        environmentSchema
          .validate(environmentToSave)
          .then(() => storage.saveEnvironment(collection.pathname, environmentToSave))
          .then(resolve)
          .catch(reject);
      });
    };

export const selectEnvironment = (environmentUid, collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);

    const environmentName = environmentUid ? findEnvironmentInCollection(collectionCopy, environmentUid)?.name : null;

    if (environmentUid && !environmentName) {
      return reject(new Error('Environment not found'));
    }

    console.log('Using unified storage layer for updateUiStateSnapshot');
    storage.updateUiStateSnapshot({
      type: 'COLLECTION_ENVIRONMENT',
      data: { collectionPath: collection?.pathname, environmentName }
    });

    dispatch(_selectEnvironment({ environmentUid, collectionUid }));
    resolve();
  });
};

export const removeCollection = (collectionUid) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    // Get active workspace to determine which workspace we're removing from
    const { workspaces } = state;
    const activeWorkspace = workspaces.workspaces.find((w) => w.uid === workspaces.activeWorkspaceUid);

    let workspaceId = 'default';
    if (activeWorkspace) {
      if (activeWorkspace.pathname) {
        workspaceId = activeWorkspace.pathname;
      } else {
        workspaceId = activeWorkspace.uid;
      }
    }

    storage.removeCollection(collection.pathname, collectionUid, workspaceId)
      .then(() => {
        // Check if the collection still exists in other workspaces
        console.log('Using unified storage layer for getCollectionWorkspaces');
        return storage.getCollectionWorkspaces(collection.pathname);
      })
      .then((remainingWorkspaces) => {
        // Close tabs for this collection
        dispatch(closeAllCollectionTabs({ collectionUid }));

        // Remove collection from workspace in Redux state
        if (activeWorkspace) {
          dispatch(removeCollectionFromWorkspace({
            workspaceUid: activeWorkspace.uid,
            collectionLocation: collection.pathname
          }));
        }

        dispatch(ensureActiveTabInCurrentWorkspace());

        // Only remove from Redux if no workspaces remain
        if (!remainingWorkspaces || remainingWorkspaces.length === 0) {
          return waitForNextTick().then(() => {
            dispatch(_removeCollection({
              collectionUid: collectionUid
            }));
          });
        } else {
          // Collection still exists in other workspaces
        }
      })
      .then(resolve)
      .catch(reject);
  });
};

export const browseDirectory = () => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for browseDirectory');
    storage.browseDirectory().then(resolve).catch(reject);
  });
};

export const browseFiles = (filters, properties) => (_dispatch, _getState) => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for browseFiles');
    storage.browseFiles(filters, properties).then(resolve).catch(reject);
  });
};

export const saveCollectionSettings = (collectionUid, brunoConfig = null, silent = false) => (dispatch, getState) => {
  const state = getState();
  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    const collectionCopy = cloneDeep(collection);

    // Transform collection root (uses draft if exists)
    const collectionRootToSave = transformCollectionRootToSave(collectionCopy);

    const savePromises = [];

    // Use unified storage layer for save collection.bru file
    console.log('Using unified storage layer for saveCollectionRoot (saveCollectionSettings)');
    savePromises.push(storage.saveCollectionRoot(collectionCopy.pathname, collectionRootToSave, collectionCopy.brunoConfig));

    // Save bruno.json if brunoConfig is provided or if there's a brunoConfig draft
    const brunoConfigToSave = brunoConfig || (collectionCopy.draft && collectionCopy.draft.brunoConfig);
    if (brunoConfigToSave) {
      console.log('Using unified storage layer for updateBrunoConfig (saveCollectionSettings)');
      savePromises.push(storage.updateBrunoConfig(brunoConfigToSave, collectionCopy.pathname, collectionCopy.root));
    }

    Promise.all(savePromises)
      .then(() => {
        if (!silent) {
          toast.success('Collection Settings saved successfully');
        }
        dispatch(saveCollectionDraft({ collectionUid }));
      })
      .then(resolve)
      .catch((err) => {
        toast.error('Failed to save collection settings!');
        reject(err);
      });
  });
};

export const updateBrunoConfig = (brunoConfig, collectionUid) => (dispatch, getState) => {
  const state = getState();

  const collection = findCollectionByUid(state.collections.collections, collectionUid);

  return new Promise((resolve, reject) => {
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for updateBrunoConfigStorage');
    storage
      .updateBrunoConfigStorage(brunoConfig, collection.pathname, collection.root)
      .then(resolve)
      .catch(reject);
  });
};

/**
 * Opens a scratch collection and creates it in Redux state.
 * This is a simplified version of openCollectionEvent for scratch collections,
 * without workspace management, toasts, or sidebar toggles.
 *
 * @param {string} uid - The unique identifier for the scratch collection
 * @param {string} pathname - The filesystem path to the scratch collection
 * @param {Object} brunoConfig - The Bruno configuration object for the collection
 * @returns {Promise} Resolves when the collection is created, rejects on error
 */
export const openScratchCollectionEvent = (uid, pathname, brunoConfig) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const existingCollection = state.collections.collections.find(
      (c) => normalizePath(c.pathname) === normalizePath(pathname)
    );

    if (existingCollection) {
      resolve();
      return;
    }

    const collection = {
      version: '1',
      uid,
      name: brunoConfig.name,
      pathname,
      items: [],
      runtimeVariables: {},
      brunoConfig
    };

    console.log('Using unified storage layer for getCollectionSecurityConfig');
    storage
      .getCollectionSecurityConfig(pathname)
      .then((securityConfig) => {
        collectionSchema
          .validate(collection)
          .then(() => dispatch(_createCollection({ ...collection, securityConfig })))
          .then(resolve)
          .catch(reject);
      })
      .catch(reject);
  });
};

export const openCollectionEvent = (uid, pathname, brunoConfig) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
    const workspaceProcessEnvVariables = activeWorkspace?.processEnvVariables || {};

    const existingCollection = state.collections.collections.find(
      (c) => normalizePath(c.pathname) === normalizePath(pathname)
    );

    const isAlreadyInWorkspace = activeWorkspace?.collections?.some(
      (c) => normalizePath(c.path) === normalizePath(pathname)
    );

    if (existingCollection && isAlreadyInWorkspace) {
      toast.success('Collection is already opened');
      resolve();
      return;
    }

    if (existingCollection) {
      if (state.app.sidebarCollapsed) {
        dispatch(toggleSidebarCollapse());
      }

      if (activeWorkspace) {
        const workspaceCollection = {
          name: brunoConfig.name,
          path: pathname
        };

        console.log('Using unified storage layer for addCollectionToWorkspace');
        storage
          .addCollectionToWorkspace(activeWorkspace.pathname, workspaceCollection)
          .then(() => {
            toast.success('Collection added to workspace');
          })
          .catch((err) => {
            console.error('Failed to add collection to workspace', err);
            toast.error('Failed to add collection to workspace');
          });
      }

      dispatch(workspaceEnvUpdateEvent({ processEnvVariables: workspaceProcessEnvVariables }));

      resolve();
      return;
    }

    const collection = {
      version: '1',
      uid: uid,
      name: brunoConfig.name,
      pathname: pathname,
      items: [],
      runtimeVariables: {},
      workspaceProcessEnvVariables,
      brunoConfig: brunoConfig
    };

    console.log('Using unified storage layer for getCollectionSecurityConfig');
    storage.getCollectionSecurityConfig(pathname).then((securityConfig) => {
      collectionSchema
        .validate(collection)
        .then(() => dispatch(_createCollection({ ...collection, securityConfig })))
        .then(() => {
          const currentState = getState();
          if (currentState.app.sidebarCollapsed) {
            dispatch(toggleSidebarCollapse());
          }

          const currentWorkspace = currentState.workspaces.workspaces.find(
            (w) => w.uid === currentState.workspaces.activeWorkspaceUid
          );

          if (currentWorkspace) {
            console.log('Using unified storage layer for setCollectionWorkspace');
            storage.setCollectionWorkspace(uid, currentWorkspace.pathname);

            const alreadyInWorkspace = currentWorkspace.collections?.some(
              (c) => normalizePath(c.path) === normalizePath(pathname)
            );

            if (!alreadyInWorkspace) {
              const workspaceCollection = {
                name: brunoConfig.name,
                path: pathname
              };

              console.log('Using unified storage layer for addCollectionToWorkspace');
              storage.addCollectionToWorkspace(currentWorkspace.pathname, workspaceCollection)
                .catch((err) => {
                  console.error('Failed to add collection to workspace', err);
                  toast.error('Failed to add collection to workspace');
                });
            }
          }

          resolve();
        })
        .catch(reject);
    });
  });
};

export const createCollection = (collectionName, options = {}) => async (dispatch, getState) => {
  console.log(`📦 [createCollection] Using unified storage layer for "${collectionName || 'auto-generated'}"`);
  console.log(`📦 [createCollection] Current mode: ${storage.getMode()}`);

  try {
    const result = await storage.createCollection(collectionName, options);
    console.log('✅ [createCollection] Success:', result);
    return result;
  } catch (error) {
    console.error('❌ [createCollection] Failed:', error);
    throw error;
  }
};
export const cloneCollection = (collectionName, collectionFolderName, collectionLocation, previousPath) => async () => {
  console.log('Using unified storage layer for cloneCollection');
  return storage.cloneCollection(collectionName, collectionFolderName, collectionLocation, previousPath);
};
export const openCollection = (options = {}) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);

    if (!options.workspaceId) {
      options.workspaceId = activeWorkspace?.pathname || 'default';
    }

    // Use unified storage layer
    console.log('Using unified storage layer for openCollection');
    storage.openCollection(options)
      .then((result) => {
        resolve(result);
      })
      .catch(reject);
  });
};

export const openMultipleCollections = (collectionPaths, options = {}) => () => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for openMultipleCollections');
    storage.openMultipleCollections(collectionPaths, options)
      .then(resolve)
      .catch((err) => {
        reject();
      });
  });
};

export const collectionAddEnvFileEvent = (payload) => (dispatch, getState) => {
  const { data: environment, meta } = payload;

  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, meta.collectionUid);
    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    environmentSchema
      .validate(environment)
      .then(() =>
        dispatch(
          _collectionAddEnvFileEvent({
            environment,
            collectionUid: meta.collectionUid
          })
        )
      )
      .then(resolve)
      .catch(reject);
  });
};

export const importCollection = (collection, collectionLocation, options = {}) => (dispatch, getState) => {
  return new Promise(async (resolve, reject) => {
    try {
      const state = getState();
      const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
      const isMultiple = Array.isArray(collection);

      // Use unified storage layer
      console.log('Using unified storage layer for importCollection');
      const result = await storage.importCollection(collection, collectionLocation, options.format || DEFAULT_COLLECTION_FORMAT);
      const importedPaths = result.success.items;

      if (importedPaths.length > 0 && activeWorkspace && activeWorkspace.pathname && activeWorkspace.type !== 'default') {
        for (const importedItem of importedPaths) {
          const workspaceCollection = {
            name: importedItem.name,
            path: importedItem.path
          };
          await storage.addCollectionToWorkspace(activeWorkspace.pathname, workspaceCollection);
        }
      }

      resolve(isMultiple ? importedPaths : importedPaths[0]);
    } catch (error) {
      reject(error);
    }
  });
};

export const importCollectionFromZip = (zipFilePath, collectionLocation) => async (dispatch, getState) => {
  console.log('Using unified storage layer for importCollectionFromZip');
  const state = getState();
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);

  const collectionPath = await storage.importCollectionZip(zipFilePath, collectionLocation);

  if (activeWorkspace && activeWorkspace.pathname && activeWorkspace.type !== 'default') {
    const collectionName = path.basename(collectionPath);
    await storage.addCollectionToWorkspace(activeWorkspace.pathname, {
      name: collectionName,
      path: collectionPath
    });
  }

  return collectionPath;
};

/**
 * Updates Redux collection order and persists it to the active workspace's workspace.yml.
 */
export const moveCollectionAndPersist
  = ({ draggedItem, targetItem }) =>
    (dispatch, getState) => {
      const state = getState();
      const activeWorkspace = state.workspaces.workspaces.find(
        (w) => w.uid === state.workspaces.activeWorkspaceUid
      );
      if (!activeWorkspace?.pathname || !activeWorkspace.collections?.length) {
        return Promise.resolve();
      }

      const workspacePathSet = new Set(
        activeWorkspace.collections.map((wc) => normalizePath(wc.path))
      );
      const collectionsInWorkspace = state.collections.collections
        .filter((c) => workspacePathSet.has(normalizePath(c.pathname)));
      if (collectionsInWorkspace.length === 0) {
        return Promise.resolve();
      }

      const reordered = collectionsInWorkspace.filter((i) => i.uid !== draggedItem.uid);
      const targetIndex = reordered.findIndex((i) => i.uid === targetItem.uid);
      reordered.splice(targetIndex, 0, draggedItem);
      const collectionPaths = reordered.map((c) => c.pathname);

      console.log('Using unified storage layer for reorderWorkspaceCollections');
      return storage
        .reorderWorkspaceCollections(activeWorkspace.pathname, collectionPaths)
        .then(() => {
          dispatch(moveCollection({ draggedItem, targetItem }));
        })
        .catch((err) => {
          console.error('Failed to reorder workspace collections', err);
          return Promise.reject(err);
        });
    };

export const saveCollectionSecurityConfig = (collectionUid, securityConfig) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    console.log('Using unified storage layer for saveCollectionSecurityConfig');
    storage
      .saveCollectionSecurityConfig(collection?.pathname, securityConfig)
      .then(async () => {
        await dispatch(setCollectionSecurityConfig({ collectionUid, securityConfig }));
        resolve();
      })
      .catch(reject);
  });
};

export const hydrateCollectionWithUiStateSnapshot = (payload) => (dispatch, getState) => {
  const collectionSnapshotData = payload;
  return new Promise((resolve, reject) => {
    const state = getState();
    try {
      if (!collectionSnapshotData) resolve();
      const { pathname, selectedEnvironment } = collectionSnapshotData;
      const collection = findCollectionByPathname(state.collections.collections, pathname);
      const collectionCopy = cloneDeep(collection);
      const collectionUid = collectionCopy?.uid;

      // update selected environment
      if (selectedEnvironment) {
        const environment = findEnvironmentInCollectionByName(collectionCopy, selectedEnvironment);
        if (environment) {
          dispatch(_selectEnvironment({ environmentUid: environment?.uid, collectionUid }));
        }
      }

      // todo: add any other redux state that you want to save

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const fetchOauth2Credentials = (payload) => async (dispatch, getState) => {
  const { request, collection, itemUid, folderUid } = payload;
  const state = getState();
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
  const globalEnvironmentVariables = getGlobalEnvironmentVariables({ globalEnvironments, activeGlobalEnvironmentUid });
  request.globalEnvironmentVariables = globalEnvironmentVariables;
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for fetchOAuth2Credentials');
    storage
      .fetchOAuth2Credentials({ itemUid, request, collection })
      .then(({ credentials, url, collectionUid, credentialsId, debugInfo }) => {
        dispatch(
          collectionAddOauth2CredentialsByUrl({
            credentials,
            url,
            collectionUid,
            credentialsId,
            debugInfo: safeParseJSON(safeStringifyJSON(debugInfo)),
            folderUid: folderUid || null,
            itemUid: !folderUid ? itemUid : null
          })
        );
        resolve(credentials);
      })
      .catch(reject);
  });
};

export const refreshOauth2Credentials = (payload) => async (dispatch, getState) => {
  const { request, collection, folderUid, itemUid } = payload;
  const state = getState();
  const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
  const globalEnvironmentVariables = getGlobalEnvironmentVariables({ globalEnvironments, activeGlobalEnvironmentUid });
  request.globalEnvironmentVariables = globalEnvironmentVariables;
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for refreshOAuth2Credentials');
    storage
      .refreshOAuth2Credentials({ itemUid, request, collection })
      .then(({ credentials, url, collectionUid, debugInfo, credentialsId }) => {
        dispatch(
          collectionAddOauth2CredentialsByUrl({
            credentials,
            url,
            collectionUid,
            credentialsId,
            debugInfo: safeParseJSON(safeStringifyJSON(debugInfo)),
            folderUid: folderUid || null,
            itemUid: !folderUid ? itemUid : null
          })
        );
        resolve(credentials);
      })
      .catch(reject);
  });
};

export const clearOauth2Cache = (payload) => async (dispatch, getState) => {
  const { collectionUid, url, credentialsId } = payload;
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for clearOAuth2Cache');
    storage.clearOAuth2Cache(collectionUid, url, credentialsId)
      .then(() => {
        dispatch(
          collectionClearOauth2CredentialsByUrlAndCredentialsId({
            url,
            collectionUid,
            credentialsId
          })
        );
        resolve();
      })
      .catch(reject);
  });
};

export const isOauth2AuthorizationRequestInProgress = () => async () => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for isOAuth2AuthorizationInProgress');
    storage
      .isOAuth2AuthorizationInProgress()
      .then(resolve)
      .catch(reject);
  });
};

export const cancelOauth2AuthorizationRequest = () => async () => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for cancelOAuth2Authorization');
    storage
      .cancelOAuth2Authorization()
      .then(resolve)
      .catch(reject);
  });
};

// todo: could be removed
export const loadRequestViaWorker
  = ({ collectionUid, pathname }) =>
    (dispatch, getState) => {
      return new Promise(async (resolve, reject) => {
        console.log('Using unified storage layer for loadRequestViaWorker');
        storage.loadRequestViaWorker({ collectionUid, pathname }).then(resolve).catch(reject);
      });
    };

// todo: could be removed
export const loadRequest
  = ({ collectionUid, pathname }) =>
    (dispatch, getState) => {
      return new Promise(async (resolve, reject) => {
        console.log('Using unified storage layer for loadRequest');
        storage.loadRequest({ collectionUid, pathname }).then(resolve).catch(reject);
      });
    };

export const loadLargeRequest
  = ({ collectionUid, pathname }) =>
    (dispatch, getState) => {
      return new Promise(async (resolve, reject) => {
        console.log('Using unified storage layer for loadLargeRequest');
        storage.loadLargeRequest({ collectionUid, pathname }).then(resolve).catch(reject);
      });
    };

export const mountCollection
  = ({ collectionUid, collectionPathname, brunoConfig }) =>
    (dispatch, getState) => {
      dispatch(updateCollectionMountStatus({ collectionUid, mountStatus: 'mounting' }));
      return new Promise(async (resolve, reject) => {
        console.log('Using unified storage layer for mountCollection');
        storage.mountCollection({ collectionUid, collectionPathname, brunoConfig })
          .then((transientDirPath) => {
            dispatch(updateCollectionMountStatus({ collectionUid, mountStatus: 'mounted' }));
            dispatch(addTransientDirectory({ collectionUid, pathname: transientDirPath }));
          })
          .then(resolve)
          .catch(() => {
            dispatch(updateCollectionMountStatus({ collectionUid, mountStatus: 'unmounted' }));
            reject();
          });
      });
    };

export const showInFolder = (collectionPath) => () => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for showInFolder');
    storage.showInFolder(collectionPath).then(resolve).catch(reject);
  });
};

export const updateRunnerConfiguration
  = (collectionUid, selectedRequestItems, requestItemsOrder, delay) => (dispatch) => {
    dispatch(
      _updateRunnerConfiguration({
        collectionUid,
        selectedRequestItems,
        requestItemsOrder,
        delay
      })
    );
  };

export const updateActiveConnectionsInStore = (activeConnectionIds) => (dispatch, getState) => {
  dispatch(updateActiveConnections(activeConnectionIds));
};

export const openCollectionSettings
  = (collectionUid, tabName = 'overview') =>
    (dispatch, getState) => {
      const state = getState();
      const collection = findCollectionByUid(state.collections.collections, collectionUid);

      return new Promise((resolve, reject) => {
        if (!collection) {
          return reject(new Error('Collection not found'));
        }

        dispatch(updateSettingsSelectedTab({
          collectionUid: collection.uid,
          tab: tabName
        }));

        dispatch(addTab({
          uid: collection.uid,
          collectionUid: collection.uid,
          type: 'collection-settings'
        }));

        resolve();
      });
    };

export const saveDotEnvVariables = (collectionUid, variables, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for saveDotenvVariables');
    storage
      .saveDotenvVariables(collection.pathname, variables, filename)
      .then(resolve)
      .catch(reject);
  });
};

export const saveDotEnvRaw = (collectionUid, content, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for saveDotenvRaw');
    storage
      .saveDotenvRaw(collection.pathname, content, filename)
      .then(resolve)
      .catch(reject);
  });
};

export const createDotEnvFile = (collectionUid, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for createDotenvFile');
    storage
      .createDotenvFile(collection.pathname, filename)
      .then(resolve)
      .catch(reject);
  });
};

export const deleteDotEnvFile = (collectionUid, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const collection = findCollectionByUid(state.collections.collections, collectionUid);

    if (!collection) {
      return reject(new Error('Collection not found'));
    }

    console.log('Using unified storage layer for deleteDotenvFile');
    storage
      .deleteDotenvFile(collection.pathname, filename)
      .then(resolve)
      .catch(reject);
  });
};

export const cloneGitRepository = (data) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for cloneGitRepository');
    storage
      .cloneGitRepository(data)
      .then((res) => {
        console.log('clone done', res);
      })
      .then(resolve)
      .catch((err) => {
        toast.custom(<IpcErrorModal error={err?.message} />);
        reject();
      });
  });
};

export const scanForBrunoFiles = (dir) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    console.log('Using unified storage layer for scanForBrunoFiles');
    storage
      .scanForBrunoFiles(dir)
      .then(resolve)
      .catch((err) => {
        reject();
      });
  });
};

/**
 * If the current active tab belongs to another workspace, focus a tab in the current workspace.
 */
export const ensureActiveTabInCurrentWorkspace = () => (dispatch, getState) => {
  const state = getState();
  const result = getTabToFocusForCurrentWorkspace(state);
  if (!result) {
    return; // Already in workspace, no active workspace, or unfixable (no workspace tabs and no scratch).
  }
  if (result.addOverviewFirst && result.scratchCollectionUid) {
    dispatch(addTab({
      uid: result.uid,
      collectionUid: result.scratchCollectionUid,
      type: 'workspaceOverview'
    }));
  }
  dispatch(focusTab({ uid: result.uid }));
};

/**
 * Close tabs and delete any transient request files from the filesystem.
 * This thunk wraps the closeTabs reducer to handle transient file cleanup automatically.
 */
export const closeTabs = ({ tabUids }) => async (dispatch, getState) => {
  const state = getState();
  const collections = state.collections.collections;
  const tempDirectories = state.collections.tempDirectories || {};

  // Find transient items and group by temp directory before closing tabs
  const transientByTempDir = {};
  each(tabUids, (tabUid) => {
    for (const collection of collections) {
      const item = findItemInCollection(collection, tabUid);
      if (item?.isTransient && item.pathname) {
        const tempDir = tempDirectories[collection.uid];
        if (tempDir) {
          if (!transientByTempDir[tempDir]) {
            transientByTempDir[tempDir] = [];
          }
          transientByTempDir[tempDir].push(item.pathname);
        }
        break;
      }
    }
  });

  // Close the tabs first
  await dispatch(_closeTabs({ tabUids }));

  // After close, the reducer may have set active tab to one from another workspace. Ensure it belongs to this workspace: prefer any open in-workspace tab, then workspace overview if none.
  // Dispatch is synchronous; state is already updated by _closeTabs above.
  await dispatch(ensureActiveTabInCurrentWorkspace());

  // Delete transient files after tabs are closed
  for (const [tempDir, filePaths] of Object.entries(transientByTempDir)) {
    try {
      console.log('Using unified storage layer for deleteTransientRequests');
      const results = await storage.deleteTransientRequests(filePaths, tempDir);
      if (results.errors?.length > 0) {
        console.error('Errors deleting transient files:', results.errors);
      }
    } catch (err) {
      console.error('Failed to delete transient request files:', err);
    }
  }
};

/**
 * Clear all collections for the current user (cloud-first architecture)
 * This removes all collections from the user's directory to start fresh
 */
export const clearAllUserCollections = () => async (dispatch, getState) => {
  const state = getState();

  // Get userId from auth state (null if not authenticated)
  const userId = state.auth?.user?.id || null;

  try {
    console.log('Using unified storage layer for clearUserCollections');
    const success = await storage.clearUserCollections(userId);

    if (success) {
      // Close all tabs since all collections are being removed
      const allTabUids = state.tabs.tabs.map((tab) => tab.uid);
      if (allTabUids.length > 0) {
        await dispatch(closeTabs({ tabUids: allTabUids }));
      }

      toast.success('All collections cleared successfully');
      console.log(`✅ Cleared all collections for user: ${userId || 'anonymous'}`);
    }

    return success;
  } catch (error) {
    console.error('Failed to clear user collections:', error);
    toast.error('Failed to clear collections');
    throw error;
  }
};
