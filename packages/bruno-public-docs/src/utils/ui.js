import { useState, useEffect } from 'react';

/**
 * Copy text to clipboard. Returns a promise.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/**
 * Hook: tracks viewport width for responsive layout.
 * Returns true when viewport is <= breakpoint (default 768px).
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Parse a URL and return segments with path param highlights.
 * Supports :param and {param} and {{param}} styles.
 * Returns an array of { text, isParam } segments.
 */
export function parseUrlSegments(url) {
  if (!url) return [{ text: '', isParam: false }];

  // Split the URL into base + query
  const [base, query] = url.split('?');

  // Tokenize path segments — highlight :param, {param}, {{param}}
  const segments = [];
  let remaining = base;

  // Regex matches {{param}}, {param}, :param
  const paramRegex = /(\{\{[^}]+\}\}|\{[^}]+\}|:[a-zA-Z_][a-zA-Z0-9_]*)/g;
  let lastIdx = 0;
  let match;

  while ((match = paramRegex.exec(remaining)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ text: remaining.slice(lastIdx, match.index), isParam: false });
    }
    segments.push({ text: match[0], isParam: true });
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < remaining.length) {
    segments.push({ text: remaining.slice(lastIdx), isParam: false });
  }

  if (query !== undefined) {
    segments.push({ text: `?${query}`, isParam: false });
  }

  return segments.length > 0 ? segments : [{ text: url, isParam: false }];
}
