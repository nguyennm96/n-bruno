import React, { useState, useCallback } from 'react';
import { copyToClipboard } from '../utils/ui.js';

const CopyButton = ({ text, label = 'Copy', theme, variant = 'default' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [text]);

  const t = theme;

  const isIconOnly = variant === 'icon';

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    background: 'transparent',
    color: copied ? t.text.status2xx : t.text.secondary,
    transition: t.transition,
    fontFamily: t.font.sans,
    fontSize: t.font.size.xs,
    fontWeight: 500,
    padding: isIconOnly ? '4px 6px' : '4px 10px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  return (
    <button
      style={baseStyle}
      onClick={handleCopy}
      title={copied ? 'Copied!' : label}
      onMouseOver={(e) => { if (!copied) e.currentTarget.style.background = t.bg.hover; }}
      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {!isIconOnly && <span>{copied ? 'Copied!' : label}</span>}
    </button>
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

export default CopyButton;
