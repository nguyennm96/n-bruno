import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import rust from 'highlight.js/lib/languages/rust';
import graphql from 'highlight.js/lib/languages/graphql';
import markdownLang from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('json', json);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('markdown', markdownLang);

// Re-exported so index.js can use the same hljs instance
export { hljs };

const LANGUAGES = [
  { value: '', label: 'Plain Text' },
  { value: 'json', label: 'JSON' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash / Shell' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML / HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'rust', label: 'Rust' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'markdown', label: 'Markdown' }
];

const PRETTIER_PARSERS = {
  javascript: 'babel',
  typescript: 'typescript',
  css: 'css',
  markdown: 'markdown',
  yaml: 'yaml',
  json: 'json',
  xml: 'html'
};

export const CAN_FORMAT = new Set([
  'json',
  'yaml',
  'javascript',
  'typescript',
  'css',
  'markdown',
  'xml'
]);

const formatWithPrettier = (code, parser) => {
  const prettier = require('prettier/standalone');
  const parserBabel = require('prettier/parser-babel');
  const parserTypeScript = require('prettier/parser-typescript');
  const parserPostcss = require('prettier/parser-postcss');
  const parserMarkdown = require('prettier/parser-markdown');
  const parserHtml = require('prettier/parser-html');
  const parserYaml = require('prettier/parser-yaml');

  return prettier.format(code, {
    parser,
    plugins: [parserBabel, parserTypeScript, parserPostcss, parserMarkdown, parserHtml, parserYaml],
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'es5'
  });
};

export const formatCodeByLanguage = (code, lang) => {
  const parser = PRETTIER_PARSERS[lang];
  if (parser) {
    return formatWithPrettier(code, parser);
  }
  if (lang === 'json') {
    return JSON.stringify(JSON.parse(code), null, 2);
  }
  if (lang === 'yaml') {
    const jsyaml = require('js-yaml');
    return jsyaml.dump(jsyaml.load(code), { lineWidth: -1 });
  }
  throw new Error('unsupported');
};

export const getCodeLanguage = (codeEl) => {
  const className = codeEl?.className || '';
  const m = className.match(/language-(\S+)/);
  return m ? m[1] : '';
};

export const highlightCodeElement = (codeEl) => {
  if (!codeEl) return;
  codeEl.removeAttribute('data-highlighted');
  hljs.highlightElement(codeEl);
};

const ChevronIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PANEL_HEIGHT = 34;
const EDGE_GAP = 8;

const placeCaretAtEnd = (node) => {
  if (!node) return;
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

const CodeBlockPanel = ({ preEl, onUpdate, onSelectionSync, colorMode = 'dark' }) => {
  const getLang = useCallback(() => {
    const codeEl = preEl?.querySelector?.('code');
    return getCodeLanguage(codeEl || preEl);
  }, [preEl]);

  const [lang, setLangState] = useState(getLang);
  const [dropOpen, setDropOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formatMsg, setFormatMsg] = useState(null); // null | '✓' | 'Error'
  const [pos, setPos] = useState({ top: -9999, left: 0, width: 300 });
  const dropRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!preEl) return;
    const rect = preEl.getBoundingClientRect();
    let width = Math.max(260, rect.width);
    width = Math.min(width, window.innerWidth - EDGE_GAP * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - EDGE_GAP) {
      left = window.innerWidth - EDGE_GAP - width;
    }
    if (left < EDGE_GAP) left = EDGE_GAP;

    let top = rect.top - PANEL_HEIGHT - 4;
    if (top < EDGE_GAP) {
      top = rect.bottom + 4;
    }
    setPos({
      top,
      left,
      width
    });
  }, [preEl]);

  // Track position
  useEffect(() => {
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [updatePos]);

  // Sync lang state when preEl changes
  useEffect(() => {
    setLangState(getLang());
    setDropOpen(false);
    setFormatMsg(null);
  }, [preEl, getLang]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const close = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropOpen]);

  const applyLang = (newLang) => {
    setLangState(newLang);
    setDropOpen(false);
    const codeEl = preEl.querySelector('code') || preEl;
    codeEl.className = newLang ? `language-${newLang}` : '';
    try {
      highlightCodeElement(codeEl);
    } catch { /* ignore highlight errors */ }
    placeCaretAtEnd(codeEl);
    onUpdate();
    requestAnimationFrame(() => {
      onSelectionSync?.();
    });
  };

  const handleFormat = () => {
    if (!CAN_FORMAT.has(lang)) return;
    const codeEl = preEl.querySelector('code') || preEl;
    const code = codeEl.textContent;
    try {
      const formatted = formatCodeByLanguage(code, lang);
      codeEl.textContent = formatted;
      try {
        highlightCodeElement(codeEl);
      } catch { /* ignore highlight errors */ }
      placeCaretAtEnd(codeEl);
      onUpdate();
      requestAnimationFrame(() => {
        onSelectionSync?.();
      });
      setFormatMsg('✓');
      setTimeout(() => setFormatMsg(null), 1500);
    } catch {
      setFormatMsg('Error');
      setTimeout(() => setFormatMsg(null), 2000);
    }
  };

  const handleCopy = () => {
    const codeEl = preEl.querySelector('code') || preEl;
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const currentLabel = LANGUAGES.find((l) => l.value === lang)?.label || 'Plain Text';

  const panel = (
    <div
      className="code-block-panel"
      data-color-mode={colorMode}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Language selector */}
      <div className="cbp-lang-selector" ref={dropRef}>
        <button
          className="cbp-btn cbp-lang-btn"
          onMouseDown={(e) => {
            e.preventDefault(); setDropOpen((v) => !v);
          }}
        >
          {currentLabel}
          <ChevronIcon />
        </button>
        {dropOpen && (
          <div className="cbp-lang-dropdown">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                className={`cbp-lang-item${l.value === lang ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); applyLang(l.value);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cbp-spacer" />

      <button
        className="cbp-btn"
        disabled={!CAN_FORMAT.has(lang)}
        onMouseDown={(e) => {
          e.preventDefault(); handleFormat();
        }}
        title={CAN_FORMAT.has(lang) ? `Format ${currentLabel}` : `Formatting not supported for ${currentLabel}`}
      >
        {formatMsg || 'Format'}
      </button>

      <button
        className="cbp-btn"
        onMouseDown={(e) => {
          e.preventDefault(); handleCopy();
        }}
        title="Copy code"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <span className="cbp-hint">⌘↵ exit · ↵ line break</span>
    </div>
  );

  return createPortal(panel, document.body);
};

export default CodeBlockPanel;
