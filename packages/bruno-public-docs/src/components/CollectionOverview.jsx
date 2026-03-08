import React from 'react';
import MarkdownContent from './MarkdownContent.jsx';
import { OVERVIEW_ANCHOR_ID } from '../utils/collection.js';

function countRequests(items) {
  let n = 0;
  for (const item of (items || [])) {
    if (item.type === 'folder') n += countRequests(item.items);
    else n++;
  }
  return n;
}

function countFolders(items) {
  let n = 0;
  for (const item of (items || [])) {
    if (item.type === 'folder') {
      n++;
      n += countFolders(item.items);
    }
  }
  return n;
}

const CollectionOverview = ({ collection, theme, isMobile }) => {
  const t = theme;
  const totalRequests = countRequests(collection.items || []);
  const totalFolders = countFolders(collection.items || []);

  const sectionStyle = {
    padding: isMobile ? '32px 20px 28px' : '56px 48px 40px',
    borderBottom: `1px solid ${t.border.default}`,
    scrollMarginTop: '20px',
  };

  const logoStyle = {
    maxWidth: '140px',
    maxHeight: '40px',
    objectFit: 'contain',
    marginBottom: '20px',
    display: 'block',
  };

  const titleStyle = {
    fontSize: isMobile ? t.font.size['2xl'] : t.font.size['3xl'],
    fontWeight: 800,
    color: t.text.primary,
    marginBottom: '12px',
    lineHeight: 1.15,
  };

  const statsRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '24px',
    flexWrap: 'wrap',
  };

  const statBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: t.bg.hover,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.pill || '999px',
    fontSize: t.font.size.sm,
    color: t.text.secondary,
    fontWeight: 500,
  };

  const countStyle = {
    fontWeight: 700,
    color: t.text.primary,
  };

  return (
    <section id={OVERVIEW_ANCHOR_ID} style={sectionStyle}>
      {collection.logoUrl && (
        <img src={collection.logoUrl} alt="Logo" style={logoStyle} />
      )}
      <h1 style={titleStyle}>{collection.info.name}</h1>

      {collection.info.description && (
        <div style={{ maxWidth: '700px' }}>
          <MarkdownContent content={collection.info.description} theme={theme} />
        </div>
      )}

      <div style={statsRowStyle}>
        <span style={statBadgeStyle}>
          <EndpointIcon color={t.text.muted} />
          <span><span style={countStyle}>{totalRequests}</span> endpoint{totalRequests !== 1 ? 's' : ''}</span>
        </span>
        {totalFolders > 0 && (
          <span style={statBadgeStyle}>
            <FolderIcon color={t.text.muted} />
            <span><span style={countStyle}>{totalFolders}</span> folder{totalFolders !== 1 ? 's' : ''}</span>
          </span>
        )}
      </div>
    </section>
  );
};

const EndpointIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="13 2 13 9 22 9" />
    <path d="M22 2L13 9" />
    <path d="M2 22l7-7m3.5 3.5L22 8" />
  </svg>
);

const FolderIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default CollectionOverview;
