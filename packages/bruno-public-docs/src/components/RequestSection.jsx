import React, { useState } from 'react';
import MethodBadge from './MethodBadge.jsx';
import MarkdownContent from './MarkdownContent.jsx';
import ParamsTable from './ParamsTable.jsx';
import AuthInfo from './AuthInfo.jsx';
import RequestBody from './RequestBody.jsx';
import ResponseExamples from './ResponseExamples.jsx';
import UrlDisplay from './UrlDisplay.jsx';
import CodeSnippets from './CodeSnippets.jsx';
import TryItModal from './TryItModal.jsx';
import { requestAnchorId } from '../utils/collection.js';

const RequestSection = ({ request, theme, settings, isMobile, variables }) => {
  const t = theme;
  const anchorId = requestAnchorId(request);
  const showAuth = settings?.show_auth !== false;
  const showExamples = settings?.show_examples !== false;
  const [tryItOpen, setTryItOpen] = useState(false);

  const sectionStyle = {
    padding: isMobile ? '24px 20px' : '40px 48px',
    borderBottom: `1px solid ${t.border.default}`,
    scrollMarginTop: '20px',
  };

  const headerRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
  };

  const titleStyle = {
    fontSize: t.font.size['2xl'],
    fontWeight: 700,
    color: t.text.primary,
    marginBottom: '6px',
    lineHeight: 1.3,
    flex: 1,
  };

  const titleRowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '4px',
  };

  const tryItBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 14px',
    background: t.text.brand || t.text.link,
    color: '#fff',
    border: 'none',
    borderRadius: t.radius.base,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: t.font.size.sm,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'opacity 0.1s ease',
  };

  const dividerStyle = {
    borderTop: `1px solid ${t.border.default}`,
    margin: '24px 0',
  };

  // Filter enabled params and headers
  const params = (request.params || []).filter((p) => p.enabled !== false);
  const headers = (request.headers || []).filter((h) => h.enabled !== false);

  return (
    <section id={anchorId} style={sectionStyle}>
      {/* Method badge + URL with path param highlight + copy URL button */}
      <div style={headerRowStyle}>
        <MethodBadge method={request.method} theme={theme} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <UrlDisplay url={request.url} theme={theme} variables={variables} />
        </div>
      </div>

      {/* Title + Try It button */}
      <div style={titleRowStyle}>
        <h2 style={titleStyle}>{request.name}</h2>
        <button
          style={tryItBtnStyle}
          onClick={() => setTryItOpen(true)}
          onMouseOver={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <SendIcon />
          Try It
        </button>
      </div>

      {/* 📄 Documentation content */}
      {request.docs && (
        <div style={{ marginTop: '16px', marginBottom: '28px' }}>
          <MarkdownContent content={request.docs} theme={theme} />
        </div>
      )}

      {/* Authentication */}
      {showAuth && request.auth && request.auth.type && request.auth.type !== 'none' && (
        <>
          <div style={dividerStyle} />
          <AuthInfo auth={request.auth} theme={theme} />
        </>
      )}

      {/* Query / Path Params */}
      {params.length > 0 && (
        <>
          <div style={dividerStyle} />
          <ParamsTable items={params} title="Parameters" theme={theme} />
        </>
      )}

      {/* Request Headers */}
      {headers.length > 0 && (
        <>
          <div style={dividerStyle} />
          <ParamsTable items={headers} title="Headers" theme={theme} />
        </>
      )}

      {/* Request Body */}
      {request.body && request.body.type && request.body.type !== 'none' && (
        <>
          <div style={dividerStyle} />
          <RequestBody body={request.body} theme={theme} />
        </>
      )}

      {/* Code Snippets */}
      <div style={dividerStyle} />
      <CodeSnippets request={request} variables={variables || {}} theme={theme} />

      {/* Response Examples */}
      {showExamples && request.examples && request.examples.length > 0 && (
        <>
          <div style={dividerStyle} />
          <ResponseExamples examples={request.examples} theme={theme} />
        </>
      )}

      {/* Try It Modal */}
      {tryItOpen && (
        <TryItModal
          request={request}
          variables={variables || {}}
          theme={theme}
          onClose={() => setTryItOpen(false)}
        />
      )}
    </section>
  );
};

const SendIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export default RequestSection;
