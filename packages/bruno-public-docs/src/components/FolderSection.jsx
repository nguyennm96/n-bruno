import React from 'react';
import MarkdownContent from './MarkdownContent.jsx';
import { folderAnchorId } from '../utils/collection.js';

const FolderSection = ({ folder, theme, isMobile }) => {
  const t = theme;
  const anchorId = folderAnchorId(folder);

  const sectionStyle = {
    padding: isMobile ? '24px 20px 16px' : '32px 48px 20px',
    borderBottom: `1px solid ${t.border.subtle || t.border.default}`,
    background: t.bg.folderSection || t.bg.sidebar,
    scrollMarginTop: '20px',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: folder.description ? '12px' : 0,
  };

  const titleStyle = {
    fontSize: t.font.size.lg,
    fontWeight: 700,
    color: t.text.folderLabel || t.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    lineHeight: 1.2,
  };

  return (
    <section id={anchorId} style={sectionStyle}>
      <div style={headerStyle}>
        <FolderIcon color={t.text.folderLabel || t.text.muted} />
        <h2 style={titleStyle}>{folder.name}</h2>
      </div>
      {folder.description && (
        <div style={{ maxWidth: '700px' }}>
          <MarkdownContent content={folder.description} theme={theme} />
        </div>
      )}
    </section>
  );
};

const FolderIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default FolderSection;
