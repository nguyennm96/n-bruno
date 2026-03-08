/**
 * Build a curl command string from a normalized request object.
 */
export function buildCurlCommand(request) {
  const parts = ['curl'];

  // Method (skip -X GET since it's default)
  if (request.method && request.method !== 'GET') {
    parts.push(`-X ${request.method}`);
  }

  // Headers
  const headers = (request.headers || []).filter((h) => h.enabled !== false && h.name);
  for (const header of headers) {
    parts.push(`-H '${escapeShell(header.name)}: ${escapeShell(header.value || '')}'`);
  }

  // Auth → Authorization header
  if (request.auth) {
    const { type, bearer, basic, apikey } = request.auth;
    if (type === 'bearer' && bearer?.token) {
      parts.push(`-H 'Authorization: Bearer ${escapeShell(bearer.token)}'`);
    } else if (type === 'basic' && basic) {
      const creds = `${basic.username || ''}:${basic.password || ''}`;
      parts.push(`-u '${escapeShell(creds)}'`);
    } else if ((type === 'api-key' || type === 'apikey') && apikey?.key) {
      if (!apikey.placement || apikey.placement === 'header') {
        parts.push(`-H '${escapeShell(apikey.key)}: ${escapeShell(apikey.value || '<api_key>')}'`);
      }
    }
  }

  // Body
  if (request.body) {
    const { type } = request.body;
    if (type === 'json' && request.body.json) {
      parts.push(`-H 'Content-Type: application/json'`);
      parts.push(`-d '${escapeShell(request.body.json)}'`);
    } else if (type === 'text' && request.body.text) {
      parts.push(`-H 'Content-Type: text/plain'`);
      parts.push(`-d '${escapeShell(request.body.text)}'`);
    } else if (type === 'form' && request.body.form) {
      const pairs = (request.body.form || [])
        .filter((p) => p.name)
        .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value || '')}`)
        .join('&');
      parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`);
      parts.push(`-d '${pairs}'`);
    } else if (type === 'multipart' && request.body.formdata) {
      for (const field of (request.body.formdata || [])) {
        if (field.name) {
          parts.push(`-F '${escapeShell(field.name)}=${escapeShell(field.value || '')}'`);
        }
      }
    }
  }

  // URL (always last for readability)
  const url = buildUrlWithParams(request.url || '', request.params || []);
  parts.push(`'${url}'`);

  return parts.join(' \\\n  ');
}

function buildUrlWithParams(url, params) {
  const queryParams = (params || []).filter(
    (p) => p.enabled !== false && p.name && (!p.type || p.type === 'query')
  );
  if (queryParams.length === 0) return url;
  const qs = queryParams
    .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value || '')}`)
    .join('&');
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

function escapeShell(str) {
  return String(str).replace(/'/g, "'\\''");
}
