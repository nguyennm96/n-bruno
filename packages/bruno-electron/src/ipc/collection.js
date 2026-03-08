const _ = require('lodash');
const fs = require('fs');
const fsExtra = require('fs-extra');
const os = require('os');
const path = require('path');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const AdmZip = require('adm-zip');
const { ipcMain, shell, dialog, app } = require('electron');
const {
  parseRequest,
  parseCollection,
  stringifyCollection,
  parseEnvironment,
  DEFAULT_COLLECTION_FORMAT
} = require('@usebruno/filestore');
const brunoConverters = require('@usebruno/converters');
const { postmanToBruno } = brunoConverters;
const { dotenvToJson } = require('@usebruno/lang');
const { cookiesStore } = require('../store/cookies');

const {
  DEFAULT_GITIGNORE,
  writeFile,
  isDirectory,
  createDirectory,
  sanitizeName,
  getCollectionFormat,
  searchForRequestFiles,
  validateName,
  getCollectionStats,
  generateUniqueName,
  isDotEnvFile,
  isBrunoConfigFile,
  isBruEnvironmentConfig,
  isCollectionRootBruFile,
  scanForBrunoFiles
} = require('../utils/filesystem');
const { openCollectionDialog } = require('../app/collections');
const { generateUidBasedOnHash, stringifyJson, safeStringifyJSON, safeParseJSON } = require('../utils/common');
const { deleteCookiesForDomain, getDomainsWithCookies, addCookieForDomain, modifyCookieForDomain, parseCookieString, createCookieString, deleteCookie } = require('../utils/cookies');
const UiStateSnapshotStore = require('../store/ui-state-snapshot');
const interpolateVars = require('./network/interpolate-vars');
const { interpolateString } = require('./network/interpolate-string');
const { getEnvVars, getTreePathFromCollectionToItem, mergeVars } = require('../utils/collection');
const { getProcessEnvVars } = require('../store/process-env');
const { getOAuth2TokenUsingAuthorizationCode, getOAuth2TokenUsingClientCredentials, getOAuth2TokenUsingPasswordCredentials, getOAuth2TokenUsingImplicitGrant, refreshOauth2Token } = require('../utils/oauth2');
const { getCertsAndProxyConfig } = require('./network/cert-utils');
const { cancelOAuth2AuthorizationRequest, isOauth2AuthorizationRequestInProgress } = require('../utils/oauth2-protocol-handler');
const { getNewCollectionPath, clearUserCollections } = require('../utils/default-collection-path');

const uiStateSnapshotStore = new UiStateSnapshotStore();

const registerRendererEventHandlers = (mainWindow, watcher) => {
  // create collection
  ipcMain.handle(
    'renderer:create-collection',
    async (event, collectionName, userId, options = {}) => {
      try {
        const format = options.format || DEFAULT_COLLECTION_FORMAT;

        // Use default collection path based on userId
        // Auto-generates unique name if collectionName not provided
        const dirPath = getNewCollectionPath(userId, collectionName);

        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);

          if (files.length > 0) {
            throw new Error(`collection: ${dirPath} already exists and is not empty`);
          }
        }

        if (!validateName(path.basename(dirPath))) {
          throw new Error(`collection: invalid pathname - ${dirPath}`);
        }

        if (!fs.existsSync(dirPath)) {
          await createDirectory(dirPath);
        }

        // Use the directory name as the actual collection name if auto-generated
        const actualCollectionName = collectionName || path.basename(dirPath);

        const uid = generateUidBasedOnHash(dirPath);
        let brunoConfig = {
          version: '1',
          name: actualCollectionName,
          type: 'collection',
          ignore: ['node_modules', '.git']
        };

        if (format === 'yml') {
          const collectionRoot = {
            meta: {
              name: actualCollectionName
            }
          };
          // For YAML collections, set opencollection instead of version
          brunoConfig = {
            opencollection: '1.0.0',
            name: actualCollectionName,
            type: 'collection',
            ignore: ['node_modules', '.git']
          };
          const content = stringifyCollection(collectionRoot, brunoConfig, { format });
          await writeFile(path.join(dirPath, 'opencollection.yml'), content);
        } else if (format === 'bru') {
          const content = await stringifyJson(brunoConfig);
          await writeFile(path.join(dirPath, 'bruno.json'), content);
        } else {
          throw new Error(`Invalid format: ${format}`);
        }

        console.log(`✅ Created collection "${actualCollectionName}" at: ${dirPath}`);

        await writeFile(path.join(dirPath, '.gitignore'), DEFAULT_GITIGNORE);

        const { size, filesCount } = await getCollectionStats(dirPath);
        brunoConfig.size = size;
        brunoConfig.filesCount = filesCount;

        mainWindow.webContents.send('main:collection-opened', dirPath, uid, brunoConfig);
        ipcMain.emit('main:collection-opened', mainWindow, dirPath, uid, brunoConfig);
      } catch (error) {
        return Promise.reject(error);
      }
    }
  );
  // clone collection
  ipcMain.handle(
    'renderer:clone-collection',
    async (event, collectionName, collectionFolderName, collectionLocation, previousPath) => {
      collectionFolderName = sanitizeName(collectionFolderName);
      const dirPath = path.join(collectionLocation, collectionFolderName);
      if (fs.existsSync(dirPath)) {
        throw new Error(`collection: ${dirPath} already exists`);
      }

      if (!validateName(path.basename(dirPath))) {
        throw new Error(`collection: invalid pathname - ${dirPath}`);
      }

      // create dir
      await createDirectory(dirPath);
      const uid = generateUidBasedOnHash(dirPath);
      const format = getCollectionFormat(previousPath);
      let brunoConfig;

      if (format === 'yml') {
        const configFilePath = path.join(previousPath, 'opencollection.yml');
        const content = fs.readFileSync(configFilePath, 'utf8');
        const {
          brunoConfig: parsedBrunoConfig,
          collectionRoot
        } = parseCollection(content, { format });

        brunoConfig = parsedBrunoConfig;
        brunoConfig.name = collectionName;

        const newContent = stringifyCollection(collectionRoot, brunoConfig, { format });
        await writeFile(path.join(dirPath, 'opencollection.yml'), newContent);
      } else if (format === 'bru') {
        const configFilePath = path.join(previousPath, 'bruno.json');
        const content = fs.readFileSync(configFilePath, 'utf8');
        brunoConfig = JSON.parse(content);
        brunoConfig.name = collectionName;
        const newContent = await stringifyJson(brunoConfig);
        await writeFile(path.join(dirPath, 'bruno.json'), newContent);
      } else {
        throw new Error(`Invalid collectionformat: ${format}`);
      }

      // Now copy all the files matching the collection's filetype along with the dir
      const files = searchForRequestFiles(previousPath);

      for (const sourceFilePath of files) {
        const relativePath = path.relative(previousPath, sourceFilePath);
        const newFilePath = path.join(dirPath, relativePath);

        // skip if the file is opencollection.yml or bruno.json at the root of the collection
        const isRootConfigFile = (path.basename(sourceFilePath) === 'opencollection.yml' || path.basename(sourceFilePath) === 'bruno.json')
          && path.dirname(sourceFilePath) === previousPath;

        if (isRootConfigFile) {
          continue;
        }

        // handle dir of files
        fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
        // copy each files
        fs.copyFileSync(sourceFilePath, newFilePath);
      }

      const { size, filesCount } = await getCollectionStats(dirPath);
      brunoConfig.size = size;
      brunoConfig.filesCount = filesCount;

      mainWindow.webContents.send('main:collection-opened', dirPath, uid, brunoConfig);
      ipcMain.emit('main:collection-opened', mainWindow, dirPath, uid);
    }
  );

  // Generic environment export handler
  ipcMain.handle('renderer:export-environment', async (event, { environments, environmentType, filePath, exportFormat = 'folder' }) => {
    try {
      const { app } = require('electron');
      const appVersion = app?.getVersion() || '2.0.0';

      // For single environments and folder exports, include info in each environment
      const environmentWithInfo = (environment) => ({
        name: environment.name,
        variables: environment.variables,
        color: environment.color ?? undefined,
        info: {
          type: 'bruno-environment',
          exportedAt: new Date().toISOString(),
          exportedUsing: `AhaMan/v${appVersion}`
        }
      });

      if (exportFormat === 'folder') {
        // separate environment json files in folder
        const baseFolderName = `ahaman-${environmentType}-environments`;
        const uniqueFolderName = generateUniqueName(baseFolderName, (name) => fs.existsSync(path.join(filePath, name)));
        const exportPath = path.join(filePath, uniqueFolderName);

        fs.mkdirSync(exportPath, { recursive: true });

        for (const environment of environments) {
          const baseFileName = environment.name ? `${environment.name.replace(/[^a-zA-Z0-9-_]/g, '_')}` : 'environment';
          const uniqueFileName = generateUniqueName(baseFileName, (name) => fs.existsSync(path.join(exportPath, `${name}.json`)));
          const fullPath = path.join(exportPath, `${uniqueFileName}.json`);

          const cleanEnv = environmentWithInfo(environment);
          const jsonContent = JSON.stringify(cleanEnv, null, 2);
          await fs.promises.writeFile(fullPath, jsonContent, 'utf8');
        }
      } else if (exportFormat === 'single-file') {
        // all environments in a single file with top-level info and environments array
        const baseFileName = `ahaman-${environmentType}-environments`;
        const uniqueFileName = generateUniqueName(baseFileName, (name) => fs.existsSync(path.join(filePath, `${name}.json`)));
        const fullPath = path.join(filePath, `${uniqueFileName}.json`);

        const exportData = {
          info: {
            type: 'bruno-environment',
            exportedAt: new Date().toISOString(),
            exportedUsing: `AhaMan/v${appVersion}`
          },
          environments
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        await fs.promises.writeFile(fullPath, jsonContent, 'utf8');
      } else if (exportFormat === 'single-object') {
        // single environment json file
        if (environments.length !== 1) {
          throw new Error('Single object export requires exactly one environment');
        }

        const environment = environments[0];
        const baseFileName = environment.name ? `${environment.name.replace(/[^a-zA-Z0-9-_]/g, '_')}` : 'environment';
        const uniqueFileName = generateUniqueName(baseFileName, (name) => fs.existsSync(path.join(filePath, `${name}.json`)));
        const fullPath = path.join(filePath, `${uniqueFileName}.json`);
        const jsonContent = JSON.stringify(environmentWithInfo(environment), null, 2);
        await fs.promises.writeFile(fullPath, jsonContent, 'utf8');
      } else {
        throw new Error(`Unsupported export format: ${exportFormat}`);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:open-collection', async () => {
    if (watcher && mainWindow) {
      await openCollectionDialog(mainWindow, watcher);
    }
  });

  ipcMain.handle('renderer:open-devtools', async () => {
    mainWindow.webContents.openDevTools();
  });

  ipcMain.handle('renderer:load-gql-schema-file', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile']
      });
      if (filePaths.length === 0) {
        return;
      }

      const jsonData = fs.readFileSync(filePaths[0], 'utf8');
      return safeParseJSON(jsonData);
    } catch (err) {
      return Promise.reject(new Error('Failed to load GraphQL schema file'));
    }
  });

  const updateCookiesAndNotify = async () => {
    const domainsWithCookies = await getDomainsWithCookies();
    mainWindow.webContents.send(
      'main:cookies-update',
      safeParseJSON(safeStringifyJSON(domainsWithCookies))
    );
    cookiesStore.saveCookieJar();
  };

  // Delete all cookies for a domain
  ipcMain.handle('renderer:delete-cookies-for-domain', async (event, domain) => {
    try {
      await deleteCookiesForDomain(domain);
      await updateCookiesAndNotify();
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:delete-cookie', async (event, domain, path, cookieKey) => {
    try {
      await deleteCookie(domain, path, cookieKey);
      await updateCookiesAndNotify();
    } catch (error) {
      return Promise.reject(error);
    }
  });

  // add cookie
  ipcMain.handle('renderer:add-cookie', async (event, domain, cookie) => {
    try {
      await addCookieForDomain(domain, cookie);
      await updateCookiesAndNotify();
    } catch (error) {
      return Promise.reject(error);
    }
  });

  // modify cookie
  ipcMain.handle('renderer:modify-cookie', async (event, domain, oldCookie, cookie) => {
    try {
      await modifyCookieForDomain(domain, oldCookie, cookie);
      await updateCookiesAndNotify();
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:get-parsed-cookie', async (event, cookieStr) => {
    try {
      return parseCookieString(cookieStr);
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:create-cookie-string', async (event, cookie) => {
    try {
      return createCookieString(cookie);
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:update-ui-state-snapshot', (event, { type, data }) => {
    try {
      uiStateSnapshotStore.update({ type, data });
    } catch (error) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('renderer:fetch-oauth2-credentials', async (event, { itemUid, request, collection }) => {
    try {
      if (request.oauth2) {
        let requestCopy = _.cloneDeep(request);
        const { uid: collectionUid, pathname: collectionPath, runtimeVariables, environments = [], activeEnvironmentUid } = collection;
        const environment = _.find(environments, (e) => e.uid === activeEnvironmentUid);
        const envVars = getEnvVars(environment);
        const processEnvVars = getProcessEnvVars(collectionUid);
        const partialItem = { uid: itemUid };
        const requestTreePath = getTreePathFromCollectionToItem(collection, partialItem);
        mergeVars(collection, requestCopy, requestTreePath);
        const globalEnvironmentVariables = collection.globalEnvironmentVariables;
        const promptVariables = collection.promptVariables;
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
        const { oauth2: { grantType, accessTokenUrl, refreshTokenUrl }, collectionVariables, folderVariables, requestVariables } = requestCopy || {};

        // For OAuth2 token requests, use accessTokenUrl for cert/proxy config instead of main request URL
        let certsAndProxyConfigForTokenUrl = null;
        let certsAndProxyConfigForRefreshUrl = null;

        if (accessTokenUrl && grantType !== 'implicit') {
          const interpolatedTokenUrl = interpolateString(accessTokenUrl, {
            globalEnvironmentVariables,
            collectionVariables,
            envVars,
            folderVariables,
            requestVariables,
            runtimeVariables,
            processEnvVars,
            promptVariables
          });
          let tokenRequestForConfig = { ...requestCopy, url: interpolatedTokenUrl };
          certsAndProxyConfigForTokenUrl = await getCertsAndProxyConfig({
            collectionUid,
            collection,
            request: tokenRequestForConfig,
            envVars,
            runtimeVariables,
            processEnvVars,
            collectionPath,
            globalEnvironmentVariables
          });
        }

        // For refresh token requests, use refreshTokenUrl if available, otherwise accessTokenUrl
        const tokenUrlForRefresh = refreshTokenUrl || accessTokenUrl;
        if (tokenUrlForRefresh && grantType !== 'implicit') {
          const interpolatedRefreshUrl = interpolateString(tokenUrlForRefresh, {
            globalEnvironmentVariables,
            collectionVariables,
            envVars,
            folderVariables,
            requestVariables,
            runtimeVariables,
            processEnvVars,
            promptVariables
          });
          let refreshRequestForConfig = { ...requestCopy, url: interpolatedRefreshUrl };
          certsAndProxyConfigForRefreshUrl = await getCertsAndProxyConfig({
            collectionUid,
            collection,
            request: refreshRequestForConfig,
            envVars,
            runtimeVariables,
            processEnvVars,
            collectionPath,
            globalEnvironmentVariables
          });
        }

        const handleOAuth2Response = (response) => {
          if (response.error && !response.debugInfo) {
            throw new Error(response.error);
          }
          return response;
        };

        switch (grantType) {
          case 'authorization_code':
            interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
            return await getOAuth2TokenUsingAuthorizationCode({
              request: requestCopy,
              collectionUid,
              forceFetch: true,
              certsAndProxyConfigForTokenUrl,
              certsAndProxyConfigForRefreshUrl
            }).then(handleOAuth2Response);

          case 'client_credentials':
            interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
            return await getOAuth2TokenUsingClientCredentials({
              request: requestCopy,
              collectionUid,
              forceFetch: true,
              certsAndProxyConfigForTokenUrl,
              certsAndProxyConfigForRefreshUrl
            }).then(handleOAuth2Response);

          case 'password':
            interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
            return await getOAuth2TokenUsingPasswordCredentials({
              request: requestCopy,
              collectionUid,
              forceFetch: true,
              certsAndProxyConfigForTokenUrl,
              certsAndProxyConfigForRefreshUrl
            }).then(handleOAuth2Response);

          case 'implicit':
            interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
            return await getOAuth2TokenUsingImplicitGrant({
              request: requestCopy,
              collectionUid,
              forceFetch: true
            }).then(handleOAuth2Response);

          default:
            return {
              error: `Unsupported grant type: ${grantType}`,
              credentials: null,
              url: null,
              collectionUid,
              credentialsId: null
            };
        }
      }
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:refresh-oauth2-credentials', async (event, { itemUid, request, collection }) => {
    try {
      if (request.oauth2) {
        let requestCopy = _.cloneDeep(request);
        const { uid: collectionUid, pathname: collectionPath, runtimeVariables, environments = [], activeEnvironmentUid } = collection;
        const environment = _.find(environments, (e) => e.uid === activeEnvironmentUid);
        const envVars = getEnvVars(environment);
        const processEnvVars = getProcessEnvVars(collectionUid);
        const partialItem = { uid: itemUid };
        const requestTreePath = getTreePathFromCollectionToItem(collection, partialItem);
        mergeVars(collection, requestCopy, requestTreePath);
        interpolateVars(requestCopy, envVars, runtimeVariables, processEnvVars);
        const globalEnvironmentVariables = collection.globalEnvironmentVariables;

        const certsAndProxyConfig = await getCertsAndProxyConfig({
          collectionUid,
          collection,
          request: requestCopy,
          envVars,
          runtimeVariables,
          processEnvVars,
          collectionPath,
          globalEnvironmentVariables
        });

        let { credentials, url, credentialsId, debugInfo } = await refreshOauth2Token({ requestCopy, collectionUid, certsAndProxyConfig });
        return { credentials, url, collectionUid, credentialsId, debugInfo };
      }
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:cancel-oauth2-authorization-request', async () => {
    try {
      const cancelled = cancelOAuth2AuthorizationRequest();
      return { success: true, cancelled };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('renderer:is-oauth2-authorization-request-in-progress', () => {
    return isOauth2AuthorizationRequestInProgress();
  });

  // todo: could be removed

  // todo: could be removed

  ipcMain.handle('renderer:show-in-folder', async (event, filePath) => {
    try {
      if (!filePath) {
        throw new Error('File path is required');
      }
      shell.showItemInFolder(filePath);
    } catch (error) {
      console.error('Error in show-in-folder: ', error);
      throw error;
    }
  });

  // Implement the Postman to Bruno conversion handler
  ipcMain.handle('renderer:convert-postman-to-bruno', async (event, postmanCollection) => {
    try {
      // Convert Postman collection to Bruno format
      const brunoCollection = await postmanToBruno(postmanCollection, { useWorkers: true });

      return brunoCollection;
    } catch (error) {
      console.error('Error converting Postman to Bruno:', error);
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:get-collection-json', async (event, collectionPath) => {
    let variables = {};
    let name = '';
    const getBruFilesRecursively = async (dir) => {
      const getFilesInOrder = async (dir) => {
        let bruJsons = [];

        const traverse = async (currentPath) => {
          const filesInCurrentDir = fs.readdirSync(currentPath);

          if (currentPath.includes('node_modules')) {
            return;
          }

          for (const file of filesInCurrentDir) {
            const filePath = path.join(currentPath, file);
            const stats = fs.lstatSync(filePath);

            if (stats.isDirectory() && !filePath.startsWith('.git') && !filePath.startsWith('node_modules')) {
              await traverse(filePath);
            }
          }

          const currentDirBruJsons = [];
          for (const file of filesInCurrentDir) {
            const filePath = path.join(currentPath, file);
            const stats = fs.lstatSync(filePath);

            if (isBrunoConfigFile(filePath, collectionPath)) {
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                const brunoConfig = JSON.parse(content);

                name = brunoConfig?.name;
              } catch (err) {
                console.error(err);
              }
            }

            if (isDotEnvFile(filePath, collectionPath)) {
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                const jsonData = dotenvToJson(content);
                variables = {
                  ...variables,
                  processEnvVariables: {
                    ...process.env,
                    ...jsonData
                  }
                };
                continue;
              } catch (err) {
                console.error(err);
              }
            }

            if (isBruEnvironmentConfig(filePath, collectionPath)) {
              try {
                let bruContent = fs.readFileSync(filePath, 'utf8');
                const environmentFilepathBasename = path.basename(filePath);
                const environmentName = environmentFilepathBasename.substring(0, environmentFilepathBasename.length - 4);
                let data = await parseEnvironment(bruContent);
                variables = {
                  ...variables,
                  envVariables: {
                    ...(variables?.envVariables || {}),
                    [path.basename(filePath)]: data.variables
                  }
                };
                continue;
              } catch (err) {
                console.error(err);
              }
            }

            if (isCollectionRootBruFile(filePath, collectionPath)) {
              try {
                let bruContent = fs.readFileSync(filePath, 'utf8');
                let data = await parseCollection(bruContent);
                // TODO
                continue;
              } catch (err) {
                console.error(err);
              }
            }
            if (!stats.isDirectory() && path.extname(filePath) === '.bru' && file !== 'folder.bru') {
              const bruContent = fs.readFileSync(filePath, 'utf8');
              const bruJson = parseRequest(bruContent);

              currentDirBruJsons.push({
                ...bruJson
              });
            }
          }

          bruJsons = bruJsons.concat(currentDirBruJsons);
        };

        await traverse(dir);
        return bruJsons;
      };

      const orderedFiles = await getFilesInOrder(dir);
      return orderedFiles;
    };

    const files = await getBruFilesRecursively(collectionPath);
    return { name, files, ...variables };
  });

  ipcMain.handle('renderer:export-collection-zip', async (event, collectionPath, collectionName) => {
    try {
      if (!collectionPath || !fs.existsSync(collectionPath)) {
        throw new Error('Collection path does not exist');
      }

      const defaultFileName = `${sanitizeName(collectionName)}.zip`;
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Collection as ZIP',
        defaultPath: defaultFileName,
        filters: [{ name: 'Zip Files', extensions: ['zip'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const ignoredDirectories = ['node_modules', '.git'];

      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
          resolve();
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);

        const addDirectoryToArchive = (dirPath, archivePath) => {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryArchivePath = archivePath ? path.join(archivePath, entry.name) : entry.name;

            if (entry.isDirectory()) {
              if (!ignoredDirectories.includes(entry.name)) {
                addDirectoryToArchive(fullPath, entryArchivePath);
              }
            } else {
              archive.file(fullPath, { name: entryArchivePath });
            }
          }
        };

        addDirectoryToArchive(collectionPath, '');
        archive.finalize();
      });

      return { success: true, filePath };
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:is-bruno-collection-zip', async (event, zipFilePath) => {
    try {
      const zip = new AdmZip(zipFilePath);
      const entries = zip.getEntries().map((e) => e.entryName);

      return entries.some(
        (name) =>
          name === 'bruno.json'
          || name === 'opencollection.yml'
          || /^[^/]+\/bruno\.json$/.test(name)
          || /^[^/]+\/opencollection\.yml$/.test(name)
      );
    } catch {
      return false;
    }
  });

  ipcMain.handle('renderer:import-collection-zip', async (event, zipFilePath, collectionLocation) => {
    try {
      if (!fs.existsSync(zipFilePath)) {
        throw new Error('ZIP file does not exist');
      }

      if (!collectionLocation || !fs.existsSync(collectionLocation)) {
        throw new Error('Collection location does not exist');
      }

      const tempDir = path.join(os.tmpdir(), `bruno_zip_import_${Date.now()}`);
      await fsExtra.ensureDir(tempDir);

      // Validates that no symlinks point outside the base directory
      const validateNoExternalSymlinks = (dir, baseDir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const stat = fs.lstatSync(fullPath);

          if (stat.isSymbolicLink()) {
            const linkTarget = fs.readlinkSync(fullPath);
            const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget);
            if (!resolvedTarget.startsWith(baseDir + path.sep) && resolvedTarget !== baseDir) {
              throw new Error(`Security error: Symlink "${entry.name}" points outside extraction directory`);
            }
          }

          if (stat.isDirectory() && !stat.isSymbolicLink()) {
            validateNoExternalSymlinks(fullPath, baseDir);
          }
        }
      };

      try {
        await extractZip(zipFilePath, { dir: tempDir });

        validateNoExternalSymlinks(tempDir, tempDir);

        const extractedItems = fs.readdirSync(tempDir);
        let collectionDir = tempDir;

        if (extractedItems.length === 1) {
          const singleItem = path.join(tempDir, extractedItems[0]);
          const singleItemStat = fs.lstatSync(singleItem);
          if (singleItemStat.isDirectory() && !singleItemStat.isSymbolicLink()) {
            collectionDir = singleItem;
          }
        }

        const brunoJsonPath = path.join(collectionDir, 'bruno.json');
        const openCollectionYmlPath = path.join(collectionDir, 'opencollection.yml');

        if (!fs.existsSync(brunoJsonPath) && !fs.existsSync(openCollectionYmlPath)) {
          throw new Error('Invalid collection: Neither bruno.json nor opencollection.yml found in the ZIP file');
        }

        // Ensure config files are not symlinks
        if (fs.existsSync(brunoJsonPath) && fs.lstatSync(brunoJsonPath).isSymbolicLink()) {
          throw new Error('Security error: bruno.json cannot be a symbolic link');
        }
        if (fs.existsSync(openCollectionYmlPath) && fs.lstatSync(openCollectionYmlPath).isSymbolicLink()) {
          throw new Error('Security error: opencollection.yml cannot be a symbolic link');
        }

        let collectionName = 'Imported Collection';
        let brunoConfig = { name: collectionName, version: '1', type: 'collection', ignore: ['node_modules', '.git'] };
        if (fs.existsSync(openCollectionYmlPath)) {
          try {
            const content = fs.readFileSync(openCollectionYmlPath, 'utf8');
            const parsed = parseCollection(content, { format: 'yml' });
            brunoConfig = parsed.brunoConfig || brunoConfig;
            collectionName = brunoConfig.name || collectionName;
          } catch (e) {
            console.error(`Error parsing opencollection.yml at ${openCollectionYmlPath}:`, e);
          }
        } else if (fs.existsSync(brunoJsonPath)) {
          try {
            brunoConfig = JSON.parse(fs.readFileSync(brunoJsonPath, 'utf8'));
            collectionName = brunoConfig.name || collectionName;
          } catch (e) {
            console.error(`Error parsing bruno.json at ${brunoJsonPath}:`, e);
          }
        }

        let sanitizedName = sanitizeName(collectionName);
        if (!sanitizedName) {
          sanitizedName = `untitled-${Date.now()}`;
        }
        let finalCollectionPath = path.join(collectionLocation, sanitizedName);
        let counter = 1;
        while (fs.existsSync(finalCollectionPath)) {
          finalCollectionPath = path.join(collectionLocation, `${sanitizedName} (${counter})`);
          counter++;
        }

        await fsExtra.move(collectionDir, finalCollectionPath);
        if (tempDir !== collectionDir) {
          await fsExtra.remove(tempDir).catch(() => { });
        }

        const uid = generateUidBasedOnHash(finalCollectionPath);
        const { size, filesCount } = await getCollectionStats(finalCollectionPath);
        brunoConfig.size = size;
        brunoConfig.filesCount = filesCount;

        mainWindow.webContents.send('main:collection-opened', finalCollectionPath, uid, brunoConfig);
        ipcMain.emit('main:collection-opened', mainWindow, finalCollectionPath, uid, brunoConfig);

        return finalCollectionPath;
      } catch (error) {
        await fsExtra.remove(tempDir).catch(() => { });
        throw error;
      }
    } catch (error) {
      throw error;
    }
  });
};

const registerMainEventHandlers = (mainWindow, watcher) => {
  ipcMain.on('main:open-collection', () => {
    if (watcher && mainWindow) {
      openCollectionDialog(mainWindow, watcher);
    }
  });

  ipcMain.on('main:open-docs', () => {
    const docsURL = 'https://docs.usebruno.com';
    shell.openExternal(docsURL);
  });

  ipcMain.on('main:collection-opened', async (win, pathname, uid, brunoConfig) => {
    app.addRecentDocument(pathname);
  });

  ipcMain.handle('renderer:scan-for-bruno-files', (event, dir) => {
    try {
      return scanForBrunoFiles(dir);
    } catch (error) {
      throw new Error(error.message);
    }
  });

  // The app listen for this event and allows the user to save unsaved requests before closing the app
  ipcMain.on('main:start-quit-flow', () => {
    mainWindow.webContents.send('main:start-quit-flow');
  });

  ipcMain.handle('main:complete-quit-flow', () => {
    mainWindow.destroy();
  });

  ipcMain.handle('main:force-quit', () => {
    process.exit();
  });

  // Clear all collections for a user (cloud-first architecture)
  ipcMain.handle('renderer:clear-user-collections', async (event, userId) => {
    try {
      const success = clearUserCollections(userId);
      if (success) {
        console.log(`✅ Cleared all collections for user: ${userId || 'anonymous'}`);
      }
      return success;
    } catch (error) {
      console.error('Failed to clear user collections:', error);
      throw error;
    }
  });

  // Read file content (for cloud sync)
  ipcMain.handle('renderer:read-file', async (event, filepath) => {
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return content;
    } catch (error) {
      console.error(`Failed to read file: ${filepath}`, error);
      throw error;
    }
  });
};

const registerCollectionsIpc = (mainWindow, watcher) => {
  registerRendererEventHandlers(mainWindow, watcher);
  registerMainEventHandlers(mainWindow, watcher);
};

module.exports = registerCollectionsIpc;
