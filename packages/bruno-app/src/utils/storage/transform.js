/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCHEMA TRANSFORMATION LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Converts cloud API responses to match local filesystem schema structure.
 * This ensures UI code works identically for both storage backends.
 *
 * KEY TRANSFORMATIONS:
 *
 * 1. Item Structure (Request/Folder)
 *    Cloud (flat):       { id, type, method, url, ... }
 *    Local (nested):     { uid, type, request: { method, url, ... }, settings, ... }
 *
 * 2. ID Fields
 *    Cloud:  id → Local: uid
 *
 * 3. Pathname
 *    Cloud:  client_id (21-char alphanumeric, no slashes — doubles as API ID)
 *    Local:  actual filesystem path (always contains '/')
 */

import { nanoid } from 'nanoid';

// ═══════════════════════════════════════════════════════════════════════════
// ITEM TRANSFORMATION (Request/Folder)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform cloud item to local schema format
 * Handles both requests and folders
 */
export function transformCloudItemToLocal(cloudItem, collectionId) {
  const isRequest = cloudItem.type === 'request' || cloudItem.item_type === 'request' || cloudItem.item_subtype;
  // item_subtype preserves the original local type (http-request, graphql-request, etc.)
  const itemType = cloudItem.item_subtype || (isRequest ? 'http-request' : 'folder');

  const baseItem = {
    // Use client_id (21-char nanoid-compatible) as uid so it passes uidSchema validation.
    // Fall back to id only for data that predates client_id.
    uid: cloudItem.client_id || cloudItem.id || cloudItem.uid,
    type: itemType,
    name: cloudItem.name,
    // pathname IS the API item ID in cloud mode (client_id, no slashes).
    // This lets all storage calls use item.pathname directly without parsing.
    pathname: cloudItem.client_id || cloudItem.id,
    seq: cloudItem.sort_order || cloudItem.seq || 1
  };

  // For requests, create nested structure
  if (isRequest && cloudItem.request) {
    // Backend already provides nested structure - use it directly
    baseItem.request = {
      method: cloudItem.request.method || 'GET',
      url: cloudItem.request.url || '',
      headers: cloudItem.request.headers || [],
      params: cloudItem.request.params || [],
      auth: cloudItem.request.auth || { mode: 'inherit' },
      body: cloudItem.request.body || {
        mode: 'none',
        json: null,
        text: null,
        xml: null,
        sparql: null,
        formUrlEncoded: null,
        multipartForm: null,
        graphql: null
      },
      script: cloudItem.request.script || { req: null, res: null },
      vars: {
        req: cloudItem.request.vars?.req || [],
        res: cloudItem.request.vars?.res || []
      },
      assertions: cloudItem.request.assertions || [],
      tests: cloudItem.request.tests || null,
      docs: cloudItem.request.docs || null
    };

    baseItem.settings = cloudItem.settings || {
      encodeUrl: true,
      followRedirects: true,
      maxRedirects: 5,
      timeout: null
    };

    baseItem.filename = cloudItem.filename || `${cloudItem.name.toLowerCase().replace(/\s+/g, '-')}.bru`;
  }

  // For folders, just include items array
  if (!isRequest) {
    baseItem.items = (cloudItem.items || []).map((child) => transformCloudItemToLocal(child, collectionId));
  }

  return baseItem;
}

/**
 * Transform local item to cloud format (for create/update operations)
 */
export function transformLocalItemToCloud(localItem) {
  const isRequest = localItem.type === 'http-request' || localItem.type === 'graphql-request'
    || localItem.type === 'grpc-request' || localItem.type === 'ws-request';

  const cloudItem = {
    name: localItem.name,
    type: isRequest ? 'request' : 'folder',
    item_subtype: isRequest ? localItem.type : undefined, // preserve sub-type (http-request, graphql-request, etc.)
    parent_item_id: localItem.parentItemId || null,
    sort_order: localItem.seq || 1
  };

  if (isRequest && localItem.request) {
    // Send nested request structure
    cloudItem.request = {
      method: localItem.request.method || 'GET',
      url: localItem.request.url || '',
      headers: localItem.request.headers || [],
      params: localItem.request.params || [],
      auth: localItem.request.auth,
      body: localItem.request.body,
      script: localItem.request.script,
      vars: localItem.request.vars,
      assertions: localItem.request.assertions,
      tests: localItem.request.tests,
      docs: localItem.request.docs
    };

    cloudItem.settings = localItem.settings;
    cloudItem.filename = localItem.filename;
  }

  return cloudItem;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform cloud collection to local schema format
 */
export function transformCloudCollectionToLocal(cloudCollection) {
  const collection = {
    uid: cloudCollection.id,
    version: '1',
    name: cloudCollection.name,
    type: 'collection',
    pathname: `cloud://${cloudCollection.id}`,
    isCloud: true,

    // Transform items recursively
    items: (cloudCollection.items || []).map((item) => transformCloudItemToLocal(item, cloudCollection.id)),

    // Environments
    environments: cloudCollection.environments || [],
    activeEnvironmentUid: cloudCollection.active_environment_uid || null,

    // Settings
    brunoConfig: cloudCollection.bruno_config || {},
    root: cloudCollection.root || {},

    // UI state
    collapsed: false,
    settingsSelectedTab: 'overview',
    folderLevelSettingsSelectedTab: {},

    // Timestamps
    createdAt: cloudCollection.created_at,
    updatedAt: cloudCollection.updated_at
  };

  return collection;
}

/**
 * Transform local collection to cloud format (for create/update)
 */
export function transformLocalCollectionToCloud(localCollection) {
  return {
    name: localCollection.name,
    description: localCollection.description || null,
    bruno_config: localCollection.brunoConfig,
    root: localCollection.root
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT TRANSFORMATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform cloud environment to local format
 */
export function transformCloudEnvironmentToLocal(cloudEnv) {
  return {
    uid: cloudEnv.id,
    name: cloudEnv.name,
    variables: cloudEnv.variables || [],
    color: cloudEnv.color || null
  };
}

/**
 * Transform local environment to cloud format
 */
export function transformLocalEnvironmentToCloud(localEnv) {
  return {
    name: localEnv.name,
    variables: localEnv.variables || [],
    color: localEnv.color || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate UID for new items (matches local format)
 */
export function generateUid() {
  return nanoid(21); // Same as local UIDs
}

/**
 * Check if an item is a cloud item
 */
export function isCloudItem(item) {
  return item?.isCloud === true || item?.pathname?.startsWith('cloud://');
}

/**
 * Check if a collection is a cloud collection
 */
export function isCloudCollection(collection) {
  return collection?.isCloud === true || collection?.pathname?.startsWith('cloud://');
}

/**
 * Extract workspace ID from cloud pathname
 */
export function extractWorkspaceIdFromPathname(pathname) {
  if (!pathname?.startsWith('cloud://')) return null;
  const parts = pathname.replace('cloud://', '').split('/');
  return parts[0] || null;
}

/**
 * Extract item ID from cloud pathname
 */
export function extractItemIdFromPathname(pathname) {
  if (!pathname?.startsWith('cloud://')) return null;
  const parts = pathname.replace('cloud://', '').split('/');
  return parts[1] || null;
}

/**
 * Create default request object (matches local schema)
 */
export function createDefaultRequest(method = 'GET', url = '') {
  return {
    method,
    url,
    headers: [],
    params: [],
    auth: { mode: 'inherit' },
    body: {
      mode: 'none',
      json: null,
      text: null,
      xml: null,
      sparql: null,
      formUrlEncoded: null,
      multipartForm: null,
      graphql: null
    },
    script: { req: null, res: null },
    vars: { req: [], res: [] },
    assertions: [],
    tests: null,
    docs: null
  };
}

/**
 * Create default settings object
 */
export function createDefaultSettings() {
  return {
    encodeUrl: true,
    followRedirects: true,
    maxRedirects: 5,
    timeout: null
  };
}
