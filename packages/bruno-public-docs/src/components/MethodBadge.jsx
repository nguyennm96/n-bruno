import React from 'react';

const METHOD_CONFIG = {
  GET:     { bg: 'bg',   text: 'text' },
  POST:    { bg: 'bg',   text: 'text' },
  PATCH:   { bg: 'bg',   text: 'text' },
  PUT:     { bg: 'bg',   text: 'text' },
  DELETE:  { bg: 'bg',   text: 'text' },
  HEAD:    { bg: 'bg',   text: 'text' },
  OPTIONS: { bg: 'bg',   text: 'text' },
};

const MethodBadge = ({ method, theme, size = 'base' }) => {
  const m = (method || 'GET').toUpperCase();

  const bgColor = theme.bg.badge[m] || theme.bg.badge['HEAD'];
  const textColor = theme.text.badge[m] || theme.text.badge['HEAD'];

  const fontSize = size === 'sm' ? theme.font.size.xs : theme.font.size.sm;
  const padding = size === 'sm' ? '2px 6px' : '4px 9px';

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: bgColor,
    color: textColor,
    fontSize,
    fontWeight: 700,
    padding,
    borderRadius: theme.radius.sm,
    fontFamily: theme.font.mono,
    letterSpacing: '0.3px',
    minWidth: size === 'sm' ? '38px' : '50px',
    flexShrink: 0,
  };

  return <span style={style}>{m}</span>;
};

export default MethodBadge;
