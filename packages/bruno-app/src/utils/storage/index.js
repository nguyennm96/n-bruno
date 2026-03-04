/**
 * Unified Storage Layer
 *
 * Provides a single interface for data operations that works with both:
 * - Local filesystem (via Electron IPC)
 * - Cloud backend (via Bruno API)
 *
 * The storage layer automatically routes operations based on authentication state.
 */

import * as localStorageModule from './local';
import * as cloudStorageModule from './cloud';

class StorageManager {
  constructor() {
    this.localStorage = localStorageModule;
    this.cloudStorage = cloudStorageModule;
    this.getState = null; // Will be injected by Redux middleware
  }

  /**
   * Set Redux getState function for accessing auth state
   */
  setGetState(getStateFn) {
    this.getState = getStateFn;
  }

  /**
   * Determine if we should use cloud storage
   */
  isCloudMode() {
    if (!this.getState) {
      console.warn('StorageManager: getState not set, defaulting to local mode');
      return false;
    }
    const state = this.getState();
    return state.auth?.isAuthenticated || false;
  }

  /**
   * Get the appropriate storage implementation
   */
  getStorage() {
    return this.isCloudMode() ? this.cloudStorage : this.localStorage;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Collection Operations
  // ──────────────────────────────────────────────────────────────────────────

  async getCollections() {
    return this.getStorage().getCollections(this.getState);
  }

  async createCollection(name, options = {}) {
    return this.getStorage().createCollection(name, options, this.getState);
  }

  async updateCollection(collectionUid, data) {
    return this.getStorage().updateCollection(collectionUid, data, this.getState);
  }

  async deleteCollection(collectionUid) {
    return this.getStorage().deleteCollection(collectionUid, this.getState);
  }

  async removeCollection(pathname, collectionUid, workspaceId) {
    const mode = this.getMode();
    console.log(`StorageManager.removeCollection: routing to ${mode} storage`);
    return this.getStorage().removeCollection(pathname, collectionUid, workspaceId);
  }

  async renameCollection(collectionUid, newName) {
    const mode = this.getMode();
    console.log(`StorageManager.renameCollection: routing to ${mode} storage`);
    return this.getStorage().renameCollection(collectionUid, newName, this.getState);
  }

  async cloneCollection(collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid) {
    return this.getStorage().cloneCollection(collectionName, collectionFolderName, collectionLocation, previousPath, collectionUid, this.getState);
  }

  async importCollection(collection, collectionLocation, options = {}) {
    return this.getStorage().importCollection(collection, collectionLocation, options, this.getState);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Item Operations (Requests, Folders)
  // ──────────────────────────────────────────────────────────────────────────

  async createFolder(collectionUid, folderName, parentFolderId = null) {
    return this.getStorage().createFolder(collectionUid, folderName, parentFolderId, this.getState);
  }

  async createRequest(collectionUid, requestData) {
    return this.getStorage().createRequest(collectionUid, requestData, this.getState);
  }

  async updateRequest(itemUid, data) {
    return this.getStorage().updateRequest(itemUid, data, this.getState);
  }

  async saveRequest(pathnameOrUid, itemData, format) {
    const mode = this.getMode();
    console.log(`StorageManager.saveRequest: routing to ${mode} storage`);
    return this.getStorage().saveRequest(pathnameOrUid, itemData, format);
  }

  async updateItem(itemUid, collectionUid, data) {
    return this.getStorage().updateItem(itemUid, collectionUid, data, this.getState);
  }

  async deleteItem(itemUid, collectionUid) {
    return this.getStorage().deleteItem(itemUid, collectionUid, this.getState);
  }

  async cloneItem(itemUid, collectionUid, newName) {
    return this.getStorage().cloneItem(itemUid, collectionUid, newName, this.getState);
  }

  async moveItem(params) {
    return this.getStorage().moveItem(params, this.getState);
  }

  async renameItemName(itemPathOrUid, newName, collectionPathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.renameItemName: routing to ${mode} storage`);
    return this.getStorage().renameItemName(itemPathOrUid, newName, collectionPathnameOrUid);
  }

  async renameItemFilename(oldPathOrUid, newPath, newName, newFilename, collectionPathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.renameItemFilename: routing to ${mode} storage`);
    return this.getStorage().renameItemFilename(oldPathOrUid, newPath, newName, newFilename, collectionPathnameOrUid);
  }

  async newRequest(pathnameOrParentId, itemData, format) {
    const mode = this.getMode();
    console.log(`StorageManager.newRequest: routing to ${mode} storage`);
    return this.getStorage().newRequest(pathnameOrParentId, itemData, format);
  }

  async cloneFolder(item, collectionPath, collectionPathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.cloneFolder: routing to ${mode} storage`);
    return this.getStorage().cloneFolder(item, collectionPath, collectionPathnameOrUid);
  }

  async resequenceItems(itemsToResequence, collectionPathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.resequenceItems: routing to ${mode} storage`);
    return this.getStorage().resequenceItems(itemsToResequence, collectionPathnameOrUid);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Environment Operations
  // ──────────────────────────────────────────────────────────────────────────

  async createEnvironment(collectionUid, environmentData) {
    return this.getStorage().createEnvironment(collectionUid, environmentData, this.getState);
  }

  async updateEnvironment(environmentUid, data) {
    return this.getStorage().updateEnvironment(environmentUid, data, this.getState);
  }

  async deleteEnvironment(environmentUid, collectionUid) {
    return this.getStorage().deleteEnvironment(environmentUid, collectionUid, this.getState);
  }

  async renameEnvironment(collectionPathnameOrUid, oldName, newName) {
    const mode = this.getMode();
    console.log(`StorageManager.renameEnvironment: routing to ${mode} storage`);
    return this.getStorage().renameEnvironment(collectionPathnameOrUid, oldName, newName);
  }

  async saveEnvironment(collectionPathnameOrUid, environmentData) {
    const mode = this.getMode();
    console.log(`StorageManager.saveEnvironment: routing to ${mode} storage`);
    return this.getStorage().saveEnvironment(collectionPathnameOrUid, environmentData);
  }

  async updateEnvironmentColor(collectionPathnameOrUid, environmentName, color) {
    const mode = this.getMode();
    console.log(`StorageManager.updateEnvironmentColor: routing to ${mode} storage`);
    return this.getStorage().updateEnvironmentColor(collectionPathnameOrUid, environmentName, color);
  }

  async saveCollectionRoot(collectionPathnameOrUid, collectionRootData, brunoConfig) {
    const mode = this.getMode();
    console.log(`StorageManager.saveCollectionRoot: routing to ${mode} storage`);
    return this.getStorage().saveCollectionRoot(collectionPathnameOrUid, collectionRootData, brunoConfig);
  }

  async updateBrunoConfig(brunoConfig, collectionPathnameOrUid, collectionRoot) {
    const mode = this.getMode();
    console.log(`StorageManager.updateBrunoConfig: routing to ${mode} storage`);
    return this.getStorage().updateBrunoConfig(brunoConfig, collectionPathnameOrUid, collectionRoot);
  }

  async openCollection(options) {
    const mode = this.getMode();
    console.log(`StorageManager.openCollection: routing to ${mode} storage`);
    return this.getStorage().openCollection(options);
  }

  async importCollection(collection, collectionLocation, format) {
    const mode = this.getMode();
    console.log(`StorageManager.importCollection: routing to ${mode} storage`);
    return this.getStorage().importCollection(collection, collectionLocation, format);
  }

  async importCollectionZip(zipFilePath, collectionLocation) {
    const mode = this.getMode();
    console.log(`StorageManager.importCollectionZip: routing to ${mode} storage`);
    return this.getStorage().importCollectionZip(zipFilePath, collectionLocation);
  }

  async addCollectionToWorkspace(workspacePathOrUid, workspaceCollection) {
    const mode = this.getMode();
    console.log(`StorageManager.addCollectionToWorkspace: routing to ${mode} storage`);
    return this.getStorage().addCollectionToWorkspace(workspacePathOrUid, workspaceCollection);
  }

  async getCollectionSecurityConfig(pathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.getCollectionSecurityConfig: routing to ${mode} storage`);
    return this.getStorage().getCollectionSecurityConfig(pathnameOrUid);
  }

  async getCollectionWorkspaces(collectionPathnameOrUid) {
    const mode = this.getMode();
    console.log(`StorageManager.getCollectionWorkspaces: routing to ${mode} storage`);
    return this.getStorage().getCollectionWorkspaces(collectionPathnameOrUid);
  }

  async setCollectionWorkspace(collectionUid, workspacePathname) {
    const mode = this.getMode();
    console.log(`StorageManager.setCollectionWorkspace: routing to ${mode} storage`);
    return this.getStorage().setCollectionWorkspace(collectionUid, workspacePathname);
  }

  async openMultipleCollections(collectionPaths, options = {}) {
    const mode = this.getMode();
    console.log(`StorageManager.openMultipleCollections: routing to ${mode} storage`);
    return this.getStorage().openMultipleCollections(collectionPaths, options);
  }

  async deleteTransientRequests(filePaths, tempDir) {
    const mode = this.getMode();
    console.log(`StorageManager.deleteTransientRequests: routing to ${mode} storage`);
    return this.getStorage().deleteTransientRequests(filePaths, tempDir);
  }

  async clearUserCollections(userId) {
    const mode = this.getMode();
    console.log(`StorageManager.clearUserCollections: routing to ${mode} storage`);
    return this.getStorage().clearUserCollections(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UI/System Operations (mostly local-only)
  // ──────────────────────────────────────────────────────────────────────────

  async updateUiStateSnapshot(data) {
    const mode = this.getMode();
    console.log(`StorageManager.updateUiStateSnapshot: routing to ${mode} storage`);
    return this.getStorage().updateUiStateSnapshot(data);
  }

  async browseDirectory() {
    const mode = this.getMode();
    console.log(`StorageManager.browseDirectory: routing to ${mode} storage`);
    return this.getStorage().browseDirectory();
  }

  async browseFiles(filters, properties) {
    const mode = this.getMode();
    console.log(`StorageManager.browseFiles: routing to ${mode} storage`);
    return this.getStorage().browseFiles(filters, properties);
  }

  async showInFolder(collectionPath) {
    const mode = this.getMode();
    console.log(`StorageManager.showInFolder: routing to ${mode} storage`);
    return this.getStorage().showInFolder(collectionPath);
  }

  async loadRequestViaWorker({ collectionUid, pathname }) {
    const mode = this.getMode();
    console.log(`StorageManager.loadRequestViaWorker: routing to ${mode} storage`);
    return this.getStorage().loadRequestViaWorker({ collectionUid, pathname });
  }

  async loadRequest({ collectionUid, pathname }) {
    const mode = this.getMode();
    console.log(`StorageManager.loadRequest: routing to ${mode} storage`);
    return this.getStorage().loadRequest({ collectionUid, pathname });
  }

  async loadLargeRequest({ collectionUid, pathname }) {
    const mode = this.getMode();
    console.log(`StorageManager.loadLargeRequest: routing to ${mode} storage`);
    return this.getStorage().loadLargeRequest({ collectionUid, pathname });
  }

  // Save and folder operations
  async saveMultipleRequests(itemsToSave) {
    const mode = this.getMode();
    console.log(`StorageManager.saveMultipleRequests: routing to ${mode} storage`);
    return this.getStorage().saveMultipleRequests(itemsToSave);
  }

  async saveFolderRoot(folderData) {
    const mode = this.getMode();
    console.log(`StorageManager.saveFolderRoot: routing to ${mode} storage`);
    return this.getStorage().saveFolderRoot(folderData);
  }

  async runCollectionFolder(collectionUid, folderUid, itemsToRun, options) {
    const mode = this.getMode();
    console.log(`StorageManager.runCollectionFolder: routing to ${mode} storage`);
    return this.getStorage().runCollectionFolder(collectionUid, folderUid, itemsToRun, options);
  }

  // Environment operations
  async createEnvironment(pathname, name, variables, color) {
    const mode = this.getMode();
    console.log(`StorageManager.createEnvironment: routing to ${mode} storage`);
    return this.getStorage().createEnvironment(pathname, name, variables, color);
  }

  async deleteEnvironment(pathname, name) {
    const mode = this.getMode();
    console.log(`StorageManager.deleteEnvironment: routing to ${mode} storage`);
    return this.getStorage().deleteEnvironment(pathname, name);
  }

  // Variable operations
  async updateVariableInFile(pathname, variable, scopeType, collectionRoot, format) {
    const mode = this.getMode();
    console.log(`StorageManager.updateVariableInFile: routing to ${mode} storage`);
    return this.getStorage().updateVariableInFile(pathname, variable, scopeType, collectionRoot, format);
  }

  // Bruno config operations
  async updateBrunoConfigStorage(brunoConfig, pathname, collectionRoot) {
    const mode = this.getMode();
    console.log(`StorageManager.updateBrunoConfigStorage: routing to ${mode} storage`);
    return this.getStorage().updateBrunoConfigStorage(brunoConfig, pathname, collectionRoot);
  }

  // Workspace operations
  async reorderWorkspaceCollections(workspacePathname, collectionPaths) {
    const mode = this.getMode();
    console.log(`StorageManager.reorderWorkspaceCollections: routing to ${mode} storage`);
    return this.getStorage().reorderWorkspaceCollections(workspacePathname, collectionPaths);
  }

  async saveCollectionSecurityConfig(pathname, securityConfig) {
    const mode = this.getMode();
    console.log(`StorageManager.saveCollectionSecurityConfig: routing to ${mode} storage`);
    return this.getStorage().saveCollectionSecurityConfig(pathname, securityConfig);
  }

  // OAuth2 operations
  async fetchOAuth2Credentials(data) {
    const mode = this.getMode();
    console.log(`StorageManager.fetchOAuth2Credentials: routing to ${mode} storage`);
    return this.getStorage().fetchOAuth2Credentials(data);
  }

  async refreshOAuth2Credentials(data) {
    const mode = this.getMode();
    console.log(`StorageManager.refreshOAuth2Credentials: routing to ${mode} storage`);
    return this.getStorage().refreshOAuth2Credentials(data);
  }

  async isOAuth2AuthorizationInProgress() {
    const mode = this.getMode();
    console.log(`StorageManager.isOAuth2AuthorizationInProgress: routing to ${mode} storage`);
    return this.getStorage().isOAuth2AuthorizationInProgress();
  }

  async cancelOAuth2Authorization() {
    const mode = this.getMode();
    console.log(`StorageManager.cancelOAuth2Authorization: routing to ${mode} storage`);
    return this.getStorage().cancelOAuth2Authorization();
  }

  // Dotenv operations
  async saveDotenvVariables(pathname, variables, filename) {
    const mode = this.getMode();
    console.log(`StorageManager.saveDotenvVariables: routing to ${mode} storage`);
    return this.getStorage().saveDotenvVariables(pathname, variables, filename);
  }

  async saveDotenvRaw(pathname, content, filename) {
    const mode = this.getMode();
    console.log(`StorageManager.saveDotenvRaw: routing to ${mode} storage`);
    return this.getStorage().saveDotenvRaw(pathname, content, filename);
  }

  async createDotenvFile(pathname, filename) {
    const mode = this.getMode();
    console.log(`StorageManager.createDotenvFile: routing to ${mode} storage`);
    return this.getStorage().createDotenvFile(pathname, filename);
  }

  async deleteDotenvFile(pathname, filename) {
    const mode = this.getMode();
    console.log(`StorageManager.deleteDotenvFile: routing to ${mode} storage`);
    return this.getStorage().deleteDotenvFile(pathname, filename);
  }

  // Git operations
  async cloneGitRepository(data) {
    const mode = this.getMode();
    console.log(`StorageManager.cloneGitRepository: routing to ${mode} storage`);
    return this.getStorage().cloneGitRepository(data);
  }

  async scanForBrunoFiles(dir) {
    const mode = this.getMode();
    console.log(`StorageManager.scanForBrunoFiles: routing to ${mode} storage`);
    return this.getStorage().scanForBrunoFiles(dir);
  }

  // Mount collection
  async mountCollection(data) {
    const mode = this.getMode();
    console.log(`StorageManager.mountCollection: routing to ${mode} storage`);
    return this.getStorage().mountCollection(data);
  }

  // Preferences
  async savePreferences(preferences) {
    const mode = this.getMode();
    console.log(`StorageManager.savePreferences: routing to ${mode} storage`);
    return this.getStorage().savePreferences(preferences);
  }

  // System operations (always local - no mode check needed)
  async deleteCookiesForDomain(domain) {
    console.log('StorageManager.deleteCookiesForDomain: always local');
    return this.localStorage.deleteCookiesForDomain(domain);
  }

  async deleteCookie(domain, path, cookieKey) {
    console.log('StorageManager.deleteCookie: always local');
    return this.localStorage.deleteCookie(domain, path, cookieKey);
  }

  async addCookie(domain, cookie) {
    console.log('StorageManager.addCookie: always local');
    return this.localStorage.addCookie(domain, cookie);
  }

  async modifyCookie(domain, oldCookie, cookie) {
    console.log('StorageManager.modifyCookie: always local');
    return this.localStorage.modifyCookie(domain, oldCookie, cookie);
  }

  async getParsedCookie(cookieStr) {
    console.log('StorageManager.getParsedCookie: always local');
    return this.localStorage.getParsedCookie(cookieStr);
  }

  async createCookieString(cookieObj) {
    console.log('StorageManager.createCookieString: always local');
    return this.localStorage.createCookieString(cookieObj);
  }

  async completeQuitFlow() {
    console.log('StorageManager.completeQuitFlow: always local');
    return this.localStorage.completeQuitFlow();
  }

  async getSystemProxyVariables() {
    console.log('StorageManager.getSystemProxyVariables: always local');
    return this.localStorage.getSystemProxyVariables();
  }

  async refreshSystemProxy() {
    console.log('StorageManager.refreshSystemProxy: always local');
    return this.localStorage.refreshSystemProxy();
  }

  // Auth token operations (always local - secure storage)
  async saveAuthTokens(tokens) {
    console.log('StorageManager.saveAuthTokens: always local');
    return this.localStorage.saveAuthTokens(tokens);
  }

  async getAuthTokens() {
    console.log('StorageManager.getAuthTokens: always local');
    return this.localStorage.getAuthTokens();
  }

  async clearAuthTokens() {
    console.log('StorageManager.clearAuthTokens: always local');
    return this.localStorage.clearAuthTokens();
  }

  // Workspace link operations (always local)
  async saveWorkspaceLink(linkData) {
    console.log('StorageManager.saveWorkspaceLink: always local');
    return this.localStorage.saveWorkspaceLink(linkData);
  }

  async removeWorkspaceLink(linkData) {
    console.log('StorageManager.removeWorkspaceLink: always local');
    return this.localStorage.removeWorkspaceLink(linkData);
  }

  async getWorkspaceLinks() {
    console.log('StorageManager.getWorkspaceLinks: always local');
    return this.localStorage.getWorkspaceLinks();
  }

  // Workspace operations (always local - filesystem operations)
  async createWorkspace(workspaceName, workspacePath) {
    console.log('StorageManager.createWorkspace: always local');
    return this.localStorage.createWorkspace(workspaceName, workspacePath);
  }

  async openWorkspace(workspacePath) {
    console.log('StorageManager.openWorkspace: always local');
    return this.localStorage.openWorkspace(workspacePath);
  }

  async openWorkspaceDialog() {
    console.log('StorageManager.openWorkspaceDialog: always local');
    return this.localStorage.openWorkspaceDialog();
  }

  async removeCollectionFromWorkspace(workspaceUid, workspacePath, collectionPath, options = {}) {
    console.log('StorageManager.removeCollectionFromWorkspace: always local');
    return this.localStorage.removeCollectionFromWorkspace(workspaceUid, workspacePath, collectionPath, options);
  }

  async loadWorkspaceApiSpecs(workspacePath) {
    console.log('StorageManager.loadWorkspaceApiSpecs: always local');
    return this.localStorage.loadWorkspaceApiSpecs(workspacePath);
  }

  async openApiSpecFile(apiSpecPath, workspacePath) {
    console.log('StorageManager.openApiSpecFile: always local');
    return this.localStorage.openApiSpecFile(apiSpecPath, workspacePath);
  }

  async getGlobalEnvironments(workspacePath) {
    console.log('StorageManager.getGlobalEnvironments: always local');
    return this.localStorage.getGlobalEnvironments(workspacePath);
  }

  async loadWorkspaceCollections(workspacePath) {
    console.log('StorageManager.loadWorkspaceCollections: always local');
    return this.localStorage.loadWorkspaceCollections(workspacePath);
  }

  async getLastOpenedWorkspaces() {
    console.log('StorageManager.getLastOpenedWorkspaces: always local');
    return this.localStorage.getLastOpenedWorkspaces();
  }

  async startWorkspaceWatcher(workspacePath) {
    console.log('StorageManager.startWorkspaceWatcher: always local');
    return this.localStorage.startWorkspaceWatcher(workspacePath);
  }

  async saveWorkspaceDocs(workspacePath, docs) {
    console.log('StorageManager.saveWorkspaceDocs: always local');
    return this.localStorage.saveWorkspaceDocs(workspacePath, docs);
  }

  async renameWorkspace(...args) {
    console.log('StorageManager.renameWorkspace: always local');
    return this.localStorage.renameWorkspace(...args);
  }

  async closeWorkspace(workspacePath) {
    console.log('StorageManager.closeWorkspace: always local');
    return this.localStorage.closeWorkspace(workspacePath);
  }

  async loadWorkspaceEnvironments(workspacePath) {
    console.log('StorageManager.loadWorkspaceEnvironments: always local');
    return this.localStorage.loadWorkspaceEnvironments(workspacePath);
  }

  async createWorkspaceEnvironment(workspacePath, environmentName) {
    console.log('StorageManager.createWorkspaceEnvironment: always local');
    return this.localStorage.createWorkspaceEnvironment(workspacePath, environmentName);
  }

  async deleteWorkspaceEnvironment(workspacePath, environmentUid) {
    console.log('StorageManager.deleteWorkspaceEnvironment: always local');
    return this.localStorage.deleteWorkspaceEnvironment(workspacePath, environmentUid);
  }

  async selectWorkspaceEnvironment(workspacePath, environmentUid) {
    console.log('StorageManager.selectWorkspaceEnvironment: always local');
    return this.localStorage.selectWorkspaceEnvironment(workspacePath, environmentUid);
  }

  async importWorkspaceEnvironment(workspacePath, environmentData) {
    console.log('StorageManager.importWorkspaceEnvironment: always local');
    return this.localStorage.importWorkspaceEnvironment(workspacePath, environmentData);
  }

  async updateWorkspaceEnvironment(workspacePath, environmentUid, environmentData) {
    console.log('StorageManager.updateWorkspaceEnvironment: always local');
    return this.localStorage.updateWorkspaceEnvironment(workspacePath, environmentUid, environmentData);
  }

  async renameWorkspaceEnvironment(workspacePath, environmentUid, newName) {
    console.log('StorageManager.renameWorkspaceEnvironment: always local');
    return this.localStorage.renameWorkspaceEnvironment(workspacePath, environmentUid, newName);
  }

  async copyWorkspaceEnvironment(workspacePath, environmentUid, newName) {
    console.log('StorageManager.copyWorkspaceEnvironment: always local');
    return this.localStorage.copyWorkspaceEnvironment(workspacePath, environmentUid, newName);
  }

  async exportWorkspace(workspacePath, workspaceName) {
    console.log('StorageManager.exportWorkspace: always local');
    return this.localStorage.exportWorkspace(workspacePath, workspaceName);
  }

  async importWorkspace(zipFilePath, extractLocation) {
    console.log('StorageManager.importWorkspace: always local');
    return this.localStorage.importWorkspace(zipFilePath, extractLocation);
  }

  async mountWorkspaceScratch(params) {
    console.log('StorageManager.mountWorkspaceScratch: always local');
    return this.localStorage.mountWorkspaceScratch(params);
  }

  async addCollectionWatcher(params) {
    console.log('StorageManager.addCollectionWatcher: always local');
    return this.localStorage.addCollectionWatcher(params);
  }

  async saveWorkspaceDotEnvVariables(params) {
    console.log('StorageManager.saveWorkspaceDotEnvVariables: always local');
    return this.localStorage.saveWorkspaceDotEnvVariables(params);
  }

  async saveWorkspaceDotEnvRaw(params) {
    console.log('StorageManager.saveWorkspaceDotEnvRaw: always local');
    return this.localStorage.saveWorkspaceDotEnvRaw(params);
  }

  async createWorkspaceDotEnvFile(params) {
    console.log('StorageManager.createWorkspaceDotEnvFile: always local');
    return this.localStorage.createWorkspaceDotEnvFile(params);
  }

  async deleteWorkspaceDotEnvFile(params) {
    console.log('StorageManager.deleteWorkspaceDotEnvFile: always local');
    return this.localStorage.deleteWorkspaceDotEnvFile(params);
  }

  async fetchNotifications() {
    console.log('StorageManager.fetchNotifications: always local');
    return this.localStorage.fetchNotifications();
  }

  async createGlobalEnvironment(params) {
    console.log('StorageManager.createGlobalEnvironment: always local');
    return this.localStorage.createGlobalEnvironment(params);
  }

  async renameGlobalEnvironment(params) {
    console.log('StorageManager.renameGlobalEnvironment: always local');
    return this.localStorage.renameGlobalEnvironment(params);
  }

  async saveGlobalEnvironment(params) {
    console.log('StorageManager.saveGlobalEnvironment: always local');
    return this.localStorage.saveGlobalEnvironment(params);
  }

  async updateGlobalEnvironmentColor(params) {
    console.log('StorageManager.updateGlobalEnvironmentColor: always local');
    return this.localStorage.updateGlobalEnvironmentColor(params);
  }

  async selectGlobalEnvironment(params) {
    console.log('StorageManager.selectGlobalEnvironment: always local');
    return this.localStorage.selectGlobalEnvironment(params);
  }

  async deleteGlobalEnvironment(params) {
    console.log('StorageManager.deleteGlobalEnvironment: always local');
    return this.localStorage.deleteGlobalEnvironment(params);
  }

  async updateUiStateSnapshot(params) {
    console.log('StorageManager.updateUiStateSnapshot: always local');
    return this.localStorage.updateUiStateSnapshot(params);
  }

  async openApiSpec(workspacePath) {
    console.log('StorageManager.openApiSpec: always local');
    return this.localStorage.openApiSpec(workspacePath);
  }

  async createApiSpec(apiSpecName, apiSpecLocation, content, workspacePath) {
    console.log('StorageManager.createApiSpec: always local');
    return this.localStorage.createApiSpec(apiSpecName, apiSpecLocation, content, workspacePath);
  }

  async saveApiSpec(pathname, content) {
    console.log('StorageManager.saveApiSpec: always local');
    return this.localStorage.saveApiSpec(pathname, content);
  }

  async removeApiSpec(pathname, workspacePath) {
    console.log('StorageManager.removeApiSpec: always local');
    return this.localStorage.removeApiSpec(pathname, workspacePath);
  }

  async saveTransientRequest(params) {
    console.log('StorageManager.saveTransientRequest: always local');
    return this.localStorage.saveTransientRequest(params);
  }

  async ensureCollectionsFolder(workspacePath) {
    console.log('StorageManager.ensureCollectionsFolder: always local');
    return this.localStorage.ensureCollectionsFolder(workspacePath);
  }

  async exportCollectionZip(collectionPath, collectionName) {
    console.log('StorageManager.exportCollectionZip: always local');
    return this.localStorage.exportCollectionZip(collectionPath, collectionName);
  }

  async isBrunoCollectionZip(filePath) {
    console.log('StorageManager.isBrunoCollectionZip: always local');
    return this.localStorage.isBrunoCollectionZip(filePath);
  }

  async ensureApispecFolder(workspacePath) {
    console.log('StorageManager.ensureApispecFolder: always local');
    return this.localStorage.ensureApispecFolder(workspacePath);
  }

  async getCollectionJson(collectionLocation) {
    console.log('StorageManager.getCollectionJson: always local');
    return this.localStorage.getCollectionJson(collectionLocation);
  }

  async appReady() {
    console.log('StorageManager.appReady: always local');
    return this.localStorage.appReady();
  }

  async newRequestFile(fullName, item) {
    const mode = this.getMode();
    console.log(`StorageManager.newRequestFile: routing to ${mode} storage`);
    return this.getStorage().newRequestFile(fullName, item);
  }

  async loadMethodsReflection(data) {
    const mode = this.getMode();
    console.log(`StorageManager.loadMethodsReflection: routing to ${mode} storage`);
    return this.getStorage().loadMethodsReflection(data);
  }

  async generateGrpcurl(data) {
    const mode = this.getMode();
    console.log(`StorageManager.generateGrpcurl: routing to ${mode} storage`);
    return this.getStorage().generateGrpcurl(data);
  }

  async clearOAuth2Cache(collectionUid, url, credentialsId) {
    const mode = this.getMode();
    console.log(`StorageManager.clearOAuth2Cache: routing to ${mode} storage`);
    return this.getStorage().clearOAuth2Cache(collectionUid, url, credentialsId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get the mode we're currently in
   */
  getMode() {
    return this.isCloudMode() ? 'cloud' : 'local';
  }

  /**
   * Check if a collection is a cloud collection
   */
  isCloudCollection(collection) {
    return collection?.isCloud === true || collection?.pathname?.startsWith('cloud://');
  }
}

// Export singleton instance
export const storage = new StorageManager();

// Export for testing
export { StorageManager };
