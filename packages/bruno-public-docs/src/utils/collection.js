/**
 * Normalize a parsed collection object (OpenCollection format or Bruno native)
 * into a consistent shape used by the viewer components.
 */
export function parseCollection(data) {
  if (!data) return null;

  return {
    info: {
      name: data.info?.name || data.name || 'Untitled Collection',
      description: data.info?.description || data.description || '',
      version: data.info?.version || '',
    },
    items: normalizeItems(data.items || []),
  };
}

function normalizeItems(items) {
  return items
    .filter((item) => item.type !== 'js') // skip JS script files
    .map((item) => {
    if (item.type === 'folder') {
      return {
        type: 'folder',
        uid: item.uid || item.info?.name || Math.random().toString(36).slice(2),
        name: item.info?.name || item.name || 'Folder',
        description: item.info?.description || item.description || '',
        items: normalizeItems(item.items || []),
      };
    }

    // http-request or request
    return {
      type: 'request',
      uid: item.uid || item.info?.name || Math.random().toString(36).slice(2),
      name: item.info?.name || item.name || 'Untitled',
      docs: item.info?.description || item.docs || item.request?.docs || item.description || '',
      method: (item.request?.method || 'GET').toUpperCase(),
      url: item.request?.url || '',
      headers: normalizeKeyValueList(item.request?.headers),
      params: normalizeKeyValueList(item.request?.params),
      body: item.request?.body || null,
      auth: item.request?.auth || null,
      examples: normalizeExamples(item.examples || []),
    };
  });
}

function normalizeKeyValueList(list) {
  if (!list) return [];
  return list
    .filter((kv) => kv && kv.name)
    .map((kv) => ({
      name: kv.name || '',
      value: kv.value || '',
      description: kv.description || '',
      enabled: kv.enabled !== false,
    }));
}

function normalizeExamples(examples) {
  return examples.map((ex) => ({
    name: ex.name || 'Example',
    status: ex.response?.status || null,
    statusText: ex.response?.statusText || '',
    headers: normalizeKeyValueList(ex.response?.headers),
    body: ex.response?.body || null,
  }));
}

/**
 * Flatten all requests from the items tree into a single array.
 * Used for search/filter in sidebar.
 */
export function flattenRequests(items) {
  const result = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        walk(node.items || []);
      } else {
        result.push(node);
      }
    }
  }

  walk(items || []);
  return result;
}

/**
 * Filter items tree by search query (matches request name, method, or URL).
 * Returns a new tree with only matching items (preserving folder structure).
 */
export function filterItems(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase();

  function filterNode(node) {
    if (node.type === 'folder') {
      const filtered = node.items.map(filterNode).filter(Boolean);
      if (filtered.length === 0) return null;
      return { ...node, items: filtered };
    }
    // request
    const match =
      node.name.toLowerCase().includes(q) ||
      node.method.toLowerCase().includes(q) ||
      node.url.toLowerCase().includes(q);
    return match ? node : null;
  }

  return items.map(filterNode).filter(Boolean);
}

/**
 * Generate a stable anchor ID for a request based on its uid/name.
 */
export function requestAnchorId(request) {
  return `req-${request.uid}`;
}

/**
 * Generate a stable anchor ID for a folder.
 */
export function folderAnchorId(folder) {
  return `folder-${folder.uid}`;
}

/** Anchor ID for the collection overview section */
export const OVERVIEW_ANCHOR_ID = 'section-overview';

/**
 * Get all section IDs in render order: overview, then tree walk (folders + requests).
 * Used to pass to useActiveSection so every section is tracked.
 */
export function getAllSectionIds(items) {
  const ids = [OVERVIEW_ANCHOR_ID];

  function walk(nodes) {
    for (const node of (nodes || [])) {
      if (node.type === 'folder') {
        ids.push(folderAnchorId(node));
        walk(node.items || []);
      } else {
        ids.push(requestAnchorId(node));
      }
    }
  }

  walk(items);
  return ids;
}
