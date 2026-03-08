import React, { useState } from 'react';
import { highlightJson, highlightAuto } from '../utils/highlight.js';

const ResponseExamples = ({ examples, theme }) => {
  const [openIdx, setOpenIdx] = useState(0);

  if (!examples || examples.length === 0) return null;

  const t = theme;

  const labelStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginBottom: '10px',
  };

  const getStatusColors = (status) => {
    if (!status) return { bg: t.bg.badge['HEAD'], text: t.text.badge['HEAD'] };
    const s = parseInt(status);
    if (s >= 200 && s < 300) return { bg: t.bg.status2xx, text: t.text.status2xx };
    if (s >= 300 && s < 400) return { bg: t.bg.status3xx, text: t.text.status3xx };
    if (s >= 400) return { bg: t.bg.status4xx, text: t.text.status4xx };
    return { bg: t.bg.badge['HEAD'], text: t.text.badge['HEAD'] };
  };

  const getBodyContent = (body) => {
    if (!body) return null;

    let raw = '';
    if (body.type === 'json' && body.json) raw = body.json;
    else if (body.type === 'text' && body.text) raw = body.text;
    else if (typeof body === 'string') raw = body;
    else return null;

    const highlighted = highlightAuto(raw);
    return highlighted;
  };

  const codeStyle = {
    margin: 0,
    padding: '14px 16px',
    background: t.bg.code,
    color: t.text.code,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    lineHeight: 1.6,
    overflowX: 'auto',
    whiteSpace: 'pre',
    borderRadius: `0 0 ${t.radius.md} ${t.radius.md}`,
    borderTop: `1px solid ${t.border.default}`,
  };

  return (
    <div>
      <div style={labelStyle}>Response Examples</div>
      {examples.map((ex, idx) => {
        const isOpen = openIdx === idx;
        const statusColors = getStatusColors(ex.status);
        const bodyHtml = getBodyContent(ex.body);

        const cardStyle = {
          border: `1px solid ${t.border.default}`,
          borderRadius: t.radius.md,
          marginBottom: '8px',
          overflow: 'hidden',
        };

        const headerStyle = {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: t.bg.example.header,
          cursor: 'pointer',
          userSelect: 'none',
        };

        const headerLeftStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        };

        const statusBadgeStyle = {
          background: statusColors.bg,
          color: statusColors.text,
          fontSize: t.font.size.xs,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: t.radius.sm,
          fontFamily: t.font.mono,
          minWidth: '36px',
          textAlign: 'center',
        };

        const exNameStyle = {
          fontSize: t.font.size.base,
          fontWeight: 500,
          color: t.text.primary,
        };

        const chevronStyle = {
          transition: 'transform 0.15s ease',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          color: t.text.muted,
          flexShrink: 0,
        };

        return (
          <div key={idx} style={cardStyle}>
            <div
              style={headerStyle}
              onClick={() => setOpenIdx(isOpen ? -1 : idx)}
              onMouseOver={(e) => { e.currentTarget.style.background = t.bg.hover; }}
              onMouseOut={(e) => { e.currentTarget.style.background = t.bg.example.header; }}
            >
              <div style={headerLeftStyle}>
                {ex.status && (
                  <span style={statusBadgeStyle}>{ex.status}</span>
                )}
                <span style={exNameStyle}>{ex.name}</span>
                {ex.statusText && (
                  <span style={{ fontSize: t.font.size.sm, color: t.text.muted }}>{ex.statusText}</span>
                )}
              </div>
              <ChevronIcon style={chevronStyle} />
            </div>

            {isOpen && (
              <div>
                {/* Response headers */}
                {ex.headers && ex.headers.length > 0 && (
                  <div style={{
                    padding: '10px 14px',
                    background: t.bg.hover,
                    borderTop: `1px solid ${t.border.default}`,
                  }}>
                    {ex.headers.map((h, hi) => (
                      <div key={hi} style={{ fontSize: t.font.size.sm, fontFamily: t.font.mono, color: t.text.secondary, marginBottom: '2px' }}>
                        <span style={{ color: t.text.link }}>{h.name}</span>
                        <span style={{ color: t.text.muted }}>: </span>
                        {h.value}
                      </div>
                    ))}
                  </div>
                )}

                {/* Response body */}
                {bodyHtml ? (
                  <pre style={codeStyle}>
                    <code dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                  </pre>
                ) : (
                  <div style={{ padding: '14px 16px', color: t.text.muted, fontSize: t.font.size.sm, background: t.bg.code, borderTop: `1px solid ${t.border.default}` }}>
                    No response body
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ChevronIcon = ({ style }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default ResponseExamples;
