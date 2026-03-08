import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { interpolate } from '../utils/interpolate.js';
import { highlightAuto } from '../utils/highlight.js';

function buildFetchOptions(state) {
  const { method, url, headers, params, body, bodyType } = state;

  let finalUrl = url;
  const enabledParams = params.filter((p) => p.enabled && p.name);
  if (enabledParams.length > 0) {
    const qs = enabledParams.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value || '')}`).join('&');
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
  }

  const headersObj = {};
  headers.filter((h) => h.enabled && h.name).forEach((h) => {
    headersObj[h.name] = h.value;
  });

  const options = { method, headers: headersObj };

  if (body && method !== 'GET' && method !== 'HEAD') {
    if (bodyType === 'json') headersObj['Content-Type'] = 'application/json';
    options.body = body;
  }

  return { finalUrl, options };
}

const TryItModal = ({ request, variables, theme, onClose }) => {
  const t = theme;

  const initialHeaders = (request.headers || [])
    .filter((h) => h.enabled !== false && h.name)
    .map((h) => ({ name: h.name, value: interpolate(h.value || '', variables), enabled: true }));

  const initialParams = (request.params || [])
    .filter((p) => p.enabled !== false && p.name)
    .map((p) => ({ name: p.name, value: interpolate(p.value || '', variables), enabled: true }));

  const getInitialBody = () => {
    if (!request.body) return '';
    if (request.body.type === 'json') return interpolate(request.body.json || '', variables);
    if (request.body.type === 'text') return interpolate(request.body.text || '', variables);
    return '';
  };

  const [state, setState] = useState({
    method: request.method || 'GET',
    url: interpolate(request.url || '', variables),
    headers: initialHeaders,
    params: initialParams,
    body: getInitialBody(),
    bodyType: request.body?.type || 'none',
  });

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const updateField = (field, value) => setState((s) => ({ ...s, [field]: value }));

  const updateListItem = (listKey, idx, field, value) => {
    setState((s) => {
      const list = [...s[listKey]];
      list[idx] = { ...list[idx], [field]: value };
      return { ...s, [listKey]: list };
    });
  };

  const addListItem = (listKey) => {
    setState((s) => ({ ...s, [listKey]: [...s[listKey], { name: '', value: '', enabled: true }] }));
  };

  const removeListItem = (listKey, idx) => {
    setState((s) => ({ ...s, [listKey]: s[listKey].filter((_, i) => i !== idx) }));
  };

  const sendRequest = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setError(null);
    try {
      const { finalUrl, options } = buildFetchOptions(state);
      const startTime = Date.now();
      const resp = await fetch(finalUrl, options);
      const elapsed = Date.now() - startTime;
      const text = await resp.text();
      const respHeaders = [];
      resp.headers.forEach((v, k) => respHeaders.push({ name: k, value: v }));
      setResponse({ status: resp.status, statusText: resp.statusText, headers: respHeaders, body: text, elapsed });
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [state]);

  const getStatusColors = (status) => {
    if (!status) return { bg: t.bg.hover, text: t.text.muted };
    if (status >= 200 && status < 300) return { bg: t.bg.status2xx, text: t.text.status2xx };
    if (status >= 300 && status < 400) return { bg: t.bg.status3xx, text: t.text.status3xx };
    return { bg: t.bg.status4xx, text: t.text.status4xx };
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  };

  const modalStyle = {
    background: t.bg.page,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.lg,
    width: '100%',
    maxWidth: '760px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  };

  const modalHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${t.border.default}`,
    flexShrink: 0,
    background: t.bg.sidebar,
  };

  const modalBodyStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const sectionLabelStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginBottom: '8px',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    background: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    color: t.text.primary,
    fontFamily: t.font.sans,
    fontSize: t.font.size.base,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const textareaStyle = {
    ...inputStyle,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    resize: 'vertical',
    minHeight: '100px',
    lineHeight: 1.6,
  };

  const tableCellInputStyle = {
    padding: '5px 8px',
    background: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.sm,
    color: t.text.primary,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const sendBtnStyle = {
    padding: '9px 20px',
    background: t.text.brand || t.text.link,
    color: '#fff',
    border: 'none',
    borderRadius: t.radius.base,
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: 600,
    fontSize: t.font.size.base,
    opacity: loading ? 0.7 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  };

  const closeBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: t.text.muted, padding: '4px', display: 'flex', borderRadius: t.radius.sm,
  };

  const addBtnStyle = {
    background: 'none', border: `1px dashed ${t.border.default}`,
    borderRadius: t.radius.sm, cursor: 'pointer',
    color: t.text.muted, padding: '5px 10px',
    fontSize: t.font.size.sm, width: '100%',
    marginTop: '4px',
  };

  const urlRowStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  };

  const methodSelectStyle = {
    padding: '8px 10px',
    background: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    color: t.text.primary,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    fontWeight: 700,
    outline: 'none',
    flexShrink: 0,
    cursor: 'pointer',
  };

  const renderKvTable = (listKey, label) => (
    <div>
      <div style={sectionLabelStyle}>{label}</div>
      {state[listKey].length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
          {state[listKey].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => updateListItem(listKey, idx, 'enabled', e.target.checked)}
                style={{ flexShrink: 0, cursor: 'pointer' }}
              />
              <input
                value={item.name}
                onChange={(e) => updateListItem(listKey, idx, 'name', e.target.value)}
                placeholder="Name"
                style={{ ...tableCellInputStyle, flex: '0 0 38%' }}
              />
              <input
                value={item.value}
                onChange={(e) => updateListItem(listKey, idx, 'value', e.target.value)}
                placeholder="Value"
                style={{ ...tableCellInputStyle, flex: 1 }}
              />
              <button
                onClick={() => removeListItem(listKey, idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, padding: '2px', display: 'flex', flexShrink: 0 }}
              >
                <RemoveIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <button style={addBtnStyle} onClick={() => addListItem(listKey)}>
        + Add {label === 'Query Params' ? 'param' : 'header'}
      </button>
    </div>
  );

  return createPortal(
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: t.font.size.md, fontWeight: 700, color: t.text.primary }}>
              Try It
            </span>
            <span style={{ fontSize: t.font.size.sm, color: t.text.muted }}>
              — {request.name}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button style={sendBtnStyle} onClick={sendRequest} disabled={loading}>
              {loading ? <SpinIcon /> : <SendIcon />}
              {loading ? 'Sending…' : 'Send'}
            </button>
            <button style={closeBtnStyle} onClick={onClose}><CloseIcon /></button>
          </div>
        </div>

        {/* Body */}
        <div style={modalBodyStyle}>
          {/* URL Row */}
          <div>
            <div style={sectionLabelStyle}>Request</div>
            <div style={urlRowStyle}>
              <select
                value={state.method}
                onChange={(e) => updateField('method', e.target.value)}
                style={methodSelectStyle}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                value={state.url}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="https://api.example.com/endpoint"
                style={{ ...inputStyle, flex: 1, fontFamily: t.font.mono, fontSize: t.font.size.sm }}
              />
            </div>
          </div>

          {/* Params */}
          {renderKvTable('params', 'Query Params')}

          {/* Headers */}
          {renderKvTable('headers', 'Headers')}

          {/* Body */}
          {state.bodyType !== 'none' && state.bodyType !== 'form-urlencoded' && (
            <div>
              <div style={sectionLabelStyle}>Body ({state.bodyType})</div>
              <textarea
                value={state.body}
                onChange={(e) => updateField('body', e.target.value)}
                placeholder="Request body..."
                style={textareaStyle}
              />
            </div>
          )}

          {/* Response */}
          {(response || error) && (
            <div style={{ borderTop: `1px solid ${t.border.default}`, paddingTop: '16px' }}>
              <div style={sectionLabelStyle}>Response</div>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  background: t.bg.status4xx,
                  border: `1px solid ${t.border.default}`,
                  borderRadius: t.radius.md,
                  color: t.text.status4xx,
                  fontSize: t.font.size.sm,
                }}>
                  <strong>Request failed:</strong> {error}
                  {error.toLowerCase().includes('cors') || error.toLowerCase().includes('network') ? (
                    <div style={{ marginTop: '6px', opacity: 0.8 }}>
                      This may be a CORS restriction. The API server must allow browser requests.
                    </div>
                  ) : null}
                </div>
              )}

              {response && (() => {
                const sc = getStatusColors(response.status);
                let bodyHtml = null;
                try {
                  const parsed = JSON.parse(response.body);
                  bodyHtml = highlightAuto(JSON.stringify(parsed, null, 2));
                } catch {
                  bodyHtml = null;
                }

                return (
                  <div style={{ border: `1px solid ${t.border.default}`, borderRadius: t.radius.md, overflow: 'hidden' }}>
                    {/* Status bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', background: t.bg.sidebar,
                      borderBottom: `1px solid ${t.border.default}`,
                    }}>
                      <span style={{
                        background: sc.bg, color: sc.text,
                        padding: '3px 10px', borderRadius: t.radius.sm,
                        fontFamily: t.font.mono, fontSize: t.font.size.sm, fontWeight: 700,
                      }}>
                        {response.status} {response.statusText}
                      </span>
                      <span style={{ fontSize: t.font.size.sm, color: t.text.muted }}>
                        {response.elapsed}ms
                      </span>
                    </div>

                    {/* Response headers (collapsed by default) */}
                    {response.headers.length > 0 && (
                      <details>
                        <summary style={{
                          padding: '8px 14px', cursor: 'pointer',
                          fontSize: t.font.size.sm, color: t.text.muted,
                          background: t.bg.hover, borderBottom: `1px solid ${t.border.default}`,
                          userSelect: 'none',
                        }}>
                          Response headers ({response.headers.length})
                        </summary>
                        <div style={{ padding: '8px 14px', background: t.bg.hover, borderBottom: `1px solid ${t.border.default}` }}>
                          {response.headers.map((h, i) => (
                            <div key={i} style={{ fontFamily: t.font.mono, fontSize: t.font.size.sm, marginBottom: '2px' }}>
                              <span style={{ color: t.text.link }}>{h.name}</span>
                              <span style={{ color: t.text.muted }}>: </span>
                              <span style={{ color: t.text.secondary }}>{h.value}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Body */}
                    <pre style={{
                      margin: 0, padding: '14px 16px',
                      background: t.bg.code, color: t.text.code,
                      fontFamily: t.font.mono, fontSize: t.font.size.sm,
                      lineHeight: 1.6, overflowX: 'auto', maxHeight: '300px', overflowY: 'auto',
                    }}>
                      {bodyHtml
                        ? <code dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                        : <code>{response.body || '(empty body)'}</code>
                      }
                    </pre>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RemoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SpinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default TryItModal;
