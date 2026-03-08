import React, { useState } from 'react';
import { LANGUAGES, generateSnippet } from '../utils/codegen.js';
import { highlightCode } from '../utils/highlight.js';
import { copyToClipboard } from '../utils/ui.js';

const LANG_HIGHLIGHT = {
  curl: 'bash',
  javascript: 'javascript',
  python: 'python',
  go: 'go',
  php: 'php',
  ruby: 'ruby',
};

const CodeSnippets = ({ request, variables, theme }) => {
  const [selectedLang, setSelectedLang] = useState('curl');
  const [copied, setCopied] = useState(false);
  const t = theme;

  const snippet = generateSnippet(selectedLang, request, variables || {});
  const highlighted = highlightCode(snippet, LANG_HIGHLIGHT[selectedLang] || 'plaintext');

  const handleCopy = async () => {
    await copyToClipboard(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerStyle = {
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.md,
    overflow: 'hidden',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0 0 14px',
    background: t.bg.code,
    borderBottom: `1px solid ${t.border.default}`,
  };

  const labelStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginRight: '12px',
    whiteSpace: 'nowrap',
  };

  const tabsStyle = {
    display: 'flex',
    flex: 1,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  };

  const copyBtnStyle = {
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    borderLeft: `1px solid ${t.border.default}`,
    cursor: 'pointer',
    color: copied ? t.text.success || '#22c55e' : t.text.muted,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: t.font.size.xs,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease',
    flexShrink: 0,
  };

  const codeStyle = {
    margin: 0,
    padding: '14px 16px',
    background: t.bg.code,
    color: t.text.code,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    lineHeight: 1.65,
    overflowX: 'auto',
    whiteSpace: 'pre',
    maxHeight: '360px',
    overflowY: 'auto',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>Code</span>
        <div style={tabsStyle}>
          {LANGUAGES.map((lang) => {
            const isActive = lang.id === selectedLang;
            return (
              <button
                key={lang.id}
                onClick={() => setSelectedLang(lang.id)}
                style={{
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${t.text.brand || t.text.link}` : '2px solid transparent',
                  cursor: 'pointer',
                  color: isActive ? t.text.primary : t.text.muted,
                  fontSize: t.font.size.sm,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.1s ease, border-color 0.1s ease',
                }}
                onMouseOver={(e) => { if (!isActive) e.currentTarget.style.color = t.text.primary; }}
                onMouseOut={(e) => { if (!isActive) e.currentTarget.style.color = t.text.muted; }}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
        <button
          style={copyBtnStyle}
          onClick={handleCopy}
          onMouseOver={(e) => { if (!copied) e.currentTarget.style.color = t.text.primary; }}
          onMouseOut={(e) => { if (!copied) e.currentTarget.style.color = t.text.muted; }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={codeStyle}><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
    </div>
  );
};

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default CodeSnippets;
