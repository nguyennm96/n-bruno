import React from 'react';
import { highlightJson, highlightAuto } from '../utils/highlight.js';

const BODY_TYPES = {
  json: 'JSON',
  text: 'Text',
  xml: 'XML',
  html: 'HTML',
  form: 'Form URL Encoded',
  multipart: 'Multipart Form',
  file: 'Binary / File',
  graphql: 'GraphQL',
};

const RequestBody = ({ body, theme }) => {
  if (!body || !body.type || body.type === 'none') return null;

  const t = theme;
  const typeName = BODY_TYPES[body.type] || body.type;

  const labelStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginBottom: '8px',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: t.bg.hover,
    borderBottom: `1px solid ${t.border.default}`,
    borderRadius: `${t.radius.md} ${t.radius.md} 0 0`,
  };

  const typeTagStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 600,
    color: t.text.secondary,
    background: t.bg.codeInline,
    padding: '2px 8px',
    borderRadius: t.radius.pill,
  };

  const codeBlockStyle = {
    margin: 0,
    padding: '14px 16px',
    background: t.bg.code,
    color: t.text.code,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    lineHeight: 1.6,
    overflowX: 'auto',
    borderRadius: `0 0 ${t.radius.md} ${t.radius.md}`,
    whiteSpace: 'pre',
  };

  const wrapperStyle = {
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.md,
    overflow: 'hidden',
    marginBottom: '24px',
  };

  const getContent = () => {
    if (body.type === 'json' && body.json) {
      const highlighted = highlightJson(body.json);
      return (
        <pre style={codeBlockStyle}>
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      );
    }

    if (body.type === 'text' && body.text) {
      return (
        <pre style={codeBlockStyle}>
          <code>{body.text}</code>
        </pre>
      );
    }

    if ((body.type === 'xml' || body.type === 'html') && body.xml) {
      return (
        <pre style={codeBlockStyle}>
          <code>{body.xml}</code>
        </pre>
      );
    }

    if (body.type === 'graphql' && body.graphql) {
      return (
        <pre style={codeBlockStyle}>
          <code>{body.graphql.query || ''}</code>
        </pre>
      );
    }

    if (body.type === 'form' && body.form) {
      const pairs = Array.isArray(body.form) ? body.form : [];
      if (pairs.length === 0) return null;
      return (
        <pre style={codeBlockStyle}>
          <code>{pairs.map((p) => `${p.name}=${p.value}`).join('\n')}</code>
        </pre>
      );
    }

    if (body.type === 'multipart' && body.formdata) {
      const pairs = Array.isArray(body.formdata) ? body.formdata : [];
      if (pairs.length === 0) return null;
      return (
        <pre style={codeBlockStyle}>
          <code>{pairs.map((p) => `${p.name}: ${p.value || '[file]'}`).join('\n')}</code>
        </pre>
      );
    }

    return (
      <div style={{ padding: '14px 16px', color: t.text.muted, fontSize: t.font.size.sm, background: t.bg.code }}>
        {typeName} body
      </div>
    );
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={labelStyle}>Request Body</div>
      <div style={wrapperStyle}>
        <div style={headerStyle}>
          <span style={typeTagStyle}>{typeName}</span>
        </div>
        {content}
      </div>
    </div>
  );
};

export default RequestBody;
