import React from 'react';
import { parseUrlSegments } from '../utils/ui.js';
import { interpolate } from '../utils/interpolate.js';
import CopyButton from './CopyButton.jsx';

const UrlDisplay = ({ url, method, theme, variables }) => {
  const t = theme;
  const displayUrl = variables && Object.keys(variables).length > 0 ? interpolate(url, variables) : url;
  const segments = parseUrlSegments(displayUrl);

  const wrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: t.bg.hover,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.md,
    padding: '10px 14px',
    overflow: 'hidden',
  };

  const urlPartStyle = {
    flex: 1,
    fontFamily: t.font.mono,
    fontSize: t.font.size.base,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    minWidth: 0,
  };

  return (
    <div style={wrapperStyle}>
      <div style={urlPartStyle}>
        {segments.map((seg, i) => (
          <span
            key={i}
            style={{
              color: seg.isParam ? t.text.link : t.text.primary,
              fontWeight: seg.isParam ? 600 : 400,
              background: seg.isParam ? (t.isDark ? 'rgba(88,166,255,0.12)' : 'rgba(37,99,235,0.08)') : 'transparent',
              borderRadius: seg.isParam ? t.radius.sm : 0,
              padding: seg.isParam ? '0 3px' : 0,
            }}
          >
            {seg.text}
          </span>
        ))}
      </div>
      <CopyButton text={displayUrl} label="Copy URL" theme={theme} variant="icon" />
    </div>
  );
};

export default UrlDisplay;
