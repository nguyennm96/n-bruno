import { interpolate } from './interpolate.js';

function applyVars(str, variables) {
  return interpolate(str, variables);
}

function buildAuthHeaders(auth, variables) {
  if (!auth) return [];
  const type = auth.type?.toLowerCase();

  if (type === 'bearer' && auth.bearer?.token) {
    return [{ name: 'Authorization', value: `Bearer ${applyVars(auth.bearer.token, variables)}` }];
  }
  if (type === 'basic' && auth.basic) {
    const u = applyVars(auth.basic.username || '', variables);
    const p = applyVars(auth.basic.password || '', variables);
    try {
      return [{ name: 'Authorization', value: `Basic ${btoa(`${u}:${p}`)}` }];
    } catch {
      return [{ name: 'Authorization', value: `Basic <base64(${u}:${p})>` }];
    }
  }
  if ((type === 'api-key' || type === 'apikey') && auth.apikey) {
    if (auth.apikey.placement !== 'query') {
      return [{ name: applyVars(auth.apikey.key || 'X-API-Key', variables), value: applyVars(auth.apikey.value || '', variables) }];
    }
  }
  return [];
}

function buildHeaders(request, variables) {
  const base = (request.headers || [])
    .filter((h) => h.enabled !== false && h.name)
    .map((h) => ({ name: h.name, value: applyVars(h.value || '', variables) }));
  return [...base, ...buildAuthHeaders(request.auth, variables)];
}

function buildUrl(request, variables) {
  let url = applyVars(request.url || '', variables);
  const params = (request.params || []).filter((p) => p.enabled !== false && p.name);
  const authParams = [];

  const auth = request.auth;
  if (auth && (auth.type === 'api-key' || auth.type === 'apikey') && auth.apikey?.placement === 'query') {
    authParams.push({ name: auth.apikey.key || 'api_key', value: applyVars(auth.apikey.value || '', variables) });
  }

  const allParams = [
    ...params.map((p) => ({ name: p.name, value: applyVars(p.value || '', variables) })),
    ...authParams,
  ];

  if (allParams.length > 0) {
    const qs = allParams.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`).join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  return url;
}

// ── cURL ────────────────────────────────────────────────────────────────────

export function buildCurlCommand(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);
  const parts = [`curl -X ${method}`];

  headers.forEach((h) => {
    parts.push(`  -H '${h.name}: ${h.value}'`);
  });

  if (request.body) {
    const b = request.body;
    if (b.type === 'json' && b.json) {
      parts.push(`  -H 'Content-Type: application/json'`);
      parts.push(`  -d '${applyVars(b.json, variables).replace(/'/g, "'\\''")}'`);
    } else if (b.type === 'text' && b.text) {
      parts.push(`  -d '${applyVars(b.text, variables).replace(/'/g, "'\\''")}'`);
    } else if (b.type === 'form-urlencoded' && b.formUrlEncoded) {
      (b.formUrlEncoded || []).filter((f) => f.enabled !== false && f.name).forEach((f) => {
        parts.push(`  --data-urlencode '${f.name}=${applyVars(f.value || '', variables)}'`);
      });
    } else if ((b.type === 'multipart-form' || b.type === 'multipart') && b.multipartForm) {
      (b.multipartForm || []).filter((f) => f.enabled !== false && f.name).forEach((f) => {
        parts.push(`  -F '${f.name}=${applyVars(f.value || '', variables)}'`);
      });
    }
  }

  parts.push(`  '${url}'`);
  return parts.join(' \\\n');
}

// ── JavaScript (fetch) ──────────────────────────────────────────────────────

export function buildFetchSnippet(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);
  const headersObj = {};
  headers.forEach((h) => { headersObj[h.name] = h.value; });

  let bodyStr = null;
  if (request.body) {
    const b = request.body;
    if (b.type === 'json' && b.json) {
      headersObj['Content-Type'] = 'application/json';
      bodyStr = applyVars(b.json, variables);
    } else if (b.type === 'text' && b.text) {
      bodyStr = applyVars(b.text, variables);
    }
  }

  const lines = [];
  lines.push(`const response = await fetch('${url}', {`);
  lines.push(`  method: '${method}',`);
  if (Object.keys(headersObj).length > 0) {
    const headersJson = JSON.stringify(headersObj, null, 2)
      .split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n');
    lines.push(`  headers: ${headersJson},`);
  }
  if (bodyStr) {
    const escaped = bodyStr.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    lines.push(`  body: \`${escaped}\`,`);
  }
  lines.push(`});`);
  lines.push(``);
  lines.push(`const data = await response.json();`);
  lines.push(`console.log(data);`);
  return lines.join('\n');
}

// ── Python (requests) ───────────────────────────────────────────────────────

export function buildPythonSnippet(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);
  const headersObj = {};
  headers.forEach((h) => { headersObj[h.name] = h.value; });

  const lines = [];
  lines.push(`import requests`);
  lines.push(``);

  if (Object.keys(headersObj).length > 0) {
    lines.push(`headers = ${JSON.stringify(headersObj, null, 4)}`);
    lines.push(``);
  }

  let bodyArgs = '';
  if (request.body) {
    const b = request.body;
    if (b.type === 'json' && b.json) {
      lines.push(`payload = ${applyVars(b.json, variables)}`);
      lines.push(``);
      bodyArgs = ', json=payload';
    } else if (b.type === 'text' && b.text) {
      lines.push(`payload = """${applyVars(b.text, variables)}"""`);
      lines.push(``);
      bodyArgs = ', data=payload';
    }
  }

  const headerArg = Object.keys(headersObj).length > 0 ? ', headers=headers' : '';
  lines.push(`response = requests.${method.toLowerCase()}(`);
  lines.push(`    '${url}'${headerArg}${bodyArgs}`);
  lines.push(`)`);
  lines.push(``);
  lines.push(`print(response.status_code)`);
  lines.push(`print(response.json())`);
  return lines.join('\n');
}

// ── Go (net/http) ───────────────────────────────────────────────────────────

export function buildGoSnippet(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);

  const hasBody = request.body && (
    (request.body.type === 'json' && request.body.json) ||
    (request.body.type === 'text' && request.body.text)
  );

  const lines = [];
  lines.push(`package main`);
  lines.push(``);
  lines.push(`import (`);
  lines.push(`\t"fmt"`);
  if (hasBody) lines.push(`\t"strings"`);
  lines.push(`\t"io"`);
  lines.push(`\t"net/http"`);
  lines.push(`)`);
  lines.push(``);
  lines.push(`func main() {`);

  let bodyVar = 'nil';
  if (hasBody) {
    const b = request.body;
    const bodyStr = b.type === 'json'
      ? applyVars(b.json, variables)
      : applyVars(b.text, variables);
    const escaped = bodyStr.replace(/`/g, '` + "`" + `');
    lines.push(`\tbody := strings.NewReader(\`${escaped}\`)`);
    bodyVar = 'body';
    lines.push(``);
  }

  lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", ${bodyVar})`);
  headers.forEach((h) => {
    lines.push(`\treq.Header.Set("${h.name}", "${h.value.replace(/"/g, '\\"')}")`);
  });
  lines.push(``);
  lines.push(`\tclient := &http.Client{}`);
  lines.push(`\tresp, _ := client.Do(req)`);
  lines.push(`\tdefer resp.Body.Close()`);
  lines.push(`\tbody2, _ := io.ReadAll(resp.Body)`);
  lines.push(`\tfmt.Println(resp.Status)`);
  lines.push(`\tfmt.Println(string(body2))`);
  lines.push(`}`);
  return lines.join('\n');
}

// ── PHP (cURL extension) ────────────────────────────────────────────────────

export function buildPhpSnippet(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);

  const lines = [];
  lines.push(`<?php`);
  lines.push(``);
  lines.push(`$curl = curl_init();`);
  lines.push(`curl_setopt_array($curl, [`);
  lines.push(`  CURLOPT_URL => '${url}',`);
  lines.push(`  CURLOPT_RETURNTRANSFER => true,`);
  lines.push(`  CURLOPT_CUSTOMREQUEST => '${method}',`);
  if (headers.length > 0) {
    lines.push(`  CURLOPT_HTTPHEADER => [`);
    headers.forEach((h) => {
      lines.push(`    '${h.name}: ${h.value.replace(/'/g, "\\'")}',`);
    });
    lines.push(`  ],`);
  }
  if (request.body) {
    const b = request.body;
    if (b.type === 'json' && b.json) {
      lines.push(`  CURLOPT_POSTFIELDS => '${applyVars(b.json, variables).replace(/'/g, "\\'")}',`);
    } else if (b.type === 'text' && b.text) {
      lines.push(`  CURLOPT_POSTFIELDS => '${applyVars(b.text, variables).replace(/'/g, "\\'")}',`);
    }
  }
  lines.push(`]);`);
  lines.push(``);
  lines.push(`$response = curl_exec($curl);`);
  lines.push(`curl_close($curl);`);
  lines.push(`echo $response;`);
  return lines.join('\n');
}

// ── Ruby (net/http) ─────────────────────────────────────────────────────────

export function buildRubySnippet(request, variables = {}) {
  const method = request.method || 'GET';
  const url = buildUrl(request, variables);
  const headers = buildHeaders(request, variables);

  const methodClass = {
    GET: 'Get', POST: 'Post', PUT: 'Put', DELETE: 'Delete',
    PATCH: 'Patch', HEAD: 'Head', OPTIONS: 'Options',
  }[method] || 'Get';

  const lines = [];
  lines.push(`require 'net/http'`);
  lines.push(`require 'uri'`);
  lines.push(`require 'json'`);
  lines.push(``);
  lines.push(`uri = URI.parse('${url}')`);
  lines.push(`http = Net::HTTP.new(uri.host, uri.port)`);
  lines.push(`http.use_ssl = uri.scheme == 'https'`);
  lines.push(``);
  lines.push(`request = Net::HTTP::${methodClass}.new(uri.request_uri)`);
  headers.forEach((h) => {
    lines.push(`request['${h.name}'] = '${h.value.replace(/'/g, "\\'")}'`);
  });
  if (request.body) {
    const b = request.body;
    if (b.type === 'json' && b.json) {
      lines.push(`request.content_type = 'application/json'`);
      lines.push(`request.body = '${applyVars(b.json, variables).replace(/'/g, "\\'")}'`);
    } else if (b.type === 'text' && b.text) {
      lines.push(`request.body = '${applyVars(b.text, variables).replace(/'/g, "\\'")}'`);
    }
  }
  lines.push(``);
  lines.push(`response = http.request(request)`);
  lines.push(`puts response.code`);
  lines.push(`puts response.body`);
  return lines.join('\n');
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
];

export function generateSnippet(langId, request, variables = {}) {
  switch (langId) {
    case 'curl': return buildCurlCommand(request, variables);
    case 'javascript': return buildFetchSnippet(request, variables);
    case 'python': return buildPythonSnippet(request, variables);
    case 'go': return buildGoSnippet(request, variables);
    case 'php': return buildPhpSnippet(request, variables);
    case 'ruby': return buildRubySnippet(request, variables);
    default: return buildCurlCommand(request, variables);
  }
}
