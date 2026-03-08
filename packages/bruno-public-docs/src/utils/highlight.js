import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import plaintext from 'highlight.js/lib/languages/plaintext';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';

hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);

export function highlightCode(code, language = 'json') {
  if (!code || typeof code !== 'string') return '';
  try {
    const supported = hljs.getLanguage(language);
    if (!supported) return escapeHtml(code);
    const result = hljs.highlight(code, { language });
    return result.value;
  } catch {
    return escapeHtml(code);
  }
}

export function highlightJson(code) {
  return highlightCode(code, 'json');
}

export function highlightAuto(code) {
  if (!code || typeof code !== 'string') return '';
  try {
    // Try JSON first
    JSON.parse(code);
    return highlightCode(code, 'json');
  } catch {
    // Not JSON — return as plain text
    return escapeHtml(code);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
