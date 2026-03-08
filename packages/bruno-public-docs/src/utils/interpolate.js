/**
 * Replace {{variable}} placeholders in a string with values from variables map.
 */
export function interpolate(str, variables = {}) {
  if (!str || typeof str !== 'string') return str || '';
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const val = variables[key.trim()];
    return val !== undefined && val !== '' ? val : match;
  });
}

/**
 * Extract all unique {{variable}} names from a collection items tree.
 */
export function extractVariables(items) {
  const vars = new Set();

  function scan(str) {
    if (!str || typeof str !== 'string') return;
    const re = /\{\{([^}]+)\}\}/g;
    let m;
    while ((m = re.exec(str)) !== null) {
      vars.add(m[1].trim());
    }
  }

  function walk(nodes) {
    for (const node of (nodes || [])) {
      if (node.type === 'folder') {
        scan(node.name);
        scan(node.description);
        walk(node.items);
      } else {
        scan(node.url);
        (node.headers || []).forEach((h) => { scan(h.name); scan(h.value); });
        (node.params || []).forEach((p) => { scan(p.name); scan(p.value); });
        if (node.body?.json) scan(node.body.json);
        if (node.body?.text) scan(node.body.text);
        if (node.auth) {
          const a = node.auth;
          if (a.bearer?.token) scan(a.bearer.token);
          if (a.basic) { scan(a.basic.username); scan(a.basic.password); }
          if (a.apikey) { scan(a.apikey.key); scan(a.apikey.value); }
        }
      }
    }
  }

  walk(items);
  return [...vars].sort();
}
