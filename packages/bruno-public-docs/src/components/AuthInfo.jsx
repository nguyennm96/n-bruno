import React from 'react';

const AUTH_LABELS = {
  bearer: 'Bearer Token',
  basic: 'Basic Auth',
  'api-key': 'API Key',
  apikey: 'API Key',
  oauth2: 'OAuth 2.0',
  oauth1: 'OAuth 1.0',
  digest: 'Digest Auth',
  ntlm: 'NTLM',
  wsse: 'WSSE',
  awsv4: 'AWS Signature v4',
  none: 'No Auth',
};

const AUTH_DESCRIPTIONS = {
  bearer: 'This endpoint requires a Bearer token in the Authorization header.',
  basic: 'This endpoint uses HTTP Basic Authentication (username + password).',
  'api-key': 'This endpoint requires an API key for authentication.',
  apikey: 'This endpoint requires an API key for authentication.',
  oauth2: 'This endpoint uses OAuth 2.0 for authentication.',
  oauth1: 'This endpoint uses OAuth 1.0 for authentication.',
  digest: 'This endpoint uses HTTP Digest Authentication.',
  ntlm: 'This endpoint uses NTLM Authentication.',
  wsse: 'This endpoint uses WSSE Authentication.',
  awsv4: 'This endpoint uses AWS Signature Version 4 for authentication.',
  none: 'This endpoint does not require authentication.',
};

const AuthInfo = ({ auth, theme }) => {
  if (!auth || !auth.type || auth.type === 'none' || auth.type === 'inherit') return null;

  const t = theme;
  const type = auth.type.toLowerCase();
  const label = AUTH_LABELS[type] || auth.type;
  const description = AUTH_DESCRIPTIONS[type] || '';

  const containerStyle = {
    marginBottom: '24px',
    padding: '12px 16px',
    background: t.bg.authBadge,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.md,
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: description ? '6px' : 0,
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    background: t.text.authBadge,
    color: t.text.inverse,
    fontSize: t.font.size.xs,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: t.radius.pill,
    letterSpacing: '0.3px',
  };

  const titleStyle = {
    fontSize: t.font.size.sm,
    fontWeight: 600,
    color: t.text.primary,
  };

  const descStyle = {
    fontSize: t.font.size.sm,
    color: t.text.secondary,
    lineHeight: 1.5,
  };

  const labelStyle = {
    fontSize: t.font.size.xs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginBottom: '8px',
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={labelStyle}>Authentication</div>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={badgeStyle}>
            <LockIcon />
            {label}
          </div>
          {auth.bearer?.token && (
            <span style={{ fontSize: t.font.size.xs, color: t.text.muted }}>
              Token required
            </span>
          )}
        </div>
        {description && <div style={descStyle}>{description}</div>}

        {/* Specific auth details */}
        {type === 'bearer' && (
          <div style={{ marginTop: '8px', fontFamily: t.font.mono, fontSize: t.font.size.sm, color: t.text.secondary }}>
            <code style={{ background: t.bg.codeInline, padding: '2px 6px', borderRadius: t.radius.sm }}>
              Authorization: Bearer {'<token>'}
            </code>
          </div>
        )}
        {type === 'basic' && (
          <div style={{ marginTop: '8px', fontFamily: t.font.mono, fontSize: t.font.size.sm, color: t.text.secondary }}>
            <code style={{ background: t.bg.codeInline, padding: '2px 6px', borderRadius: t.radius.sm }}>
              Authorization: Basic {'<base64(username:password)>'}
            </code>
          </div>
        )}
        {(type === 'api-key' || type === 'apikey') && auth.apikey?.key && (
          <div style={{ marginTop: '8px', fontFamily: t.font.mono, fontSize: t.font.size.sm, color: t.text.secondary }}>
            <code style={{ background: t.bg.codeInline, padding: '2px 6px', borderRadius: t.radius.sm }}>
              {auth.apikey.placement || 'header'}: {auth.apikey.key}: {'<api_key>'}
            </code>
          </div>
        )}
      </div>
    </div>
  );
};

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default AuthInfo;
