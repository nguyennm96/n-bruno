import React, { useState } from 'react';
import MethodBadge from './MethodBadge.jsx';
import { requestAnchorId, folderAnchorId, OVERVIEW_ANCHOR_ID } from '../utils/collection.js';

const FolderItem = ({ node, theme, activeId, searchQuery, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const t = theme;

  if (node.type === 'folder') {
    const anchorId = folderAnchorId(node);
    const isActive = activeId === anchorId;

    const folderLabelStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: `6px 16px 6px ${16 + level * 12}px`,
      cursor: 'pointer',
      userSelect: 'none',
      color: isActive ? t.text.primary : t.text.folderLabel,
      fontSize: t.font.size.xs,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.7px',
      background: isActive ? t.bg.activeItem : 'transparent',
      borderLeft: `2px solid ${isActive ? t.border.focus : 'transparent'}`,
      textDecoration: 'none',
      transition: t.transition,
    };

    const chevronStyle = {
      transition: 'transform 0.15s ease',
      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
      flexShrink: 0,
    };

    const handleLabelClick = (e) => {
      e.preventDefault();
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleChevronClick = (e) => {
      e.stopPropagation();
      setIsOpen((v) => !v);
    };

    return (
      <div>
        <a
          href={`#${anchorId}`}
          data-anchor={anchorId}
          style={folderLabelStyle}
          onClick={handleLabelClick}
          onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.color = t.text.primary; e.currentTarget.style.background = t.bg.hover; } }}
          onMouseOut={(e) => { if (!isActive) { e.currentTarget.style.color = t.text.folderLabel; e.currentTarget.style.background = 'transparent'; } }}
        >
          <span
            style={{ display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0 }}
            onClick={handleChevronClick}
          >
            <FolderChevron style={chevronStyle} />
          </span>
          <FolderIcon />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {node.name}
          </span>
        </a>

        {isOpen && (node.items || []).map((child, i) => (
          <FolderItem
            key={child.uid || i}
            node={child}
            theme={theme}
            activeId={activeId}
            searchQuery={searchQuery}
            level={level + 1}
          />
        ))}
      </div>
    );
  }

  // Request node
  const anchorId = requestAnchorId(node);
  const isActive = activeId === anchorId;

  const handleClick = (e) => {
    e.preventDefault();
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: `7px 16px 7px ${16 + (level) * 12}px`,
    cursor: 'pointer',
    textDecoration: 'none',
    color: isActive ? t.text.activeItem : t.text.sidebarItem,
    background: isActive ? t.bg.activeItem : 'transparent',
    borderLeft: `2px solid ${isActive ? t.border.focus : 'transparent'}`,
    transition: t.transition,
    fontSize: t.font.size.base,
    lineHeight: 1.4,
  };

  return (
    <a
      href={`#${anchorId}`}
      data-anchor={anchorId}
      style={itemStyle}
      onClick={handleClick}
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = t.bg.hover;
          e.currentTarget.style.color = t.text.primary;
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = t.text.sidebarItem;
        }
      }}
    >
      <MethodBadge method={node.method} theme={theme} size="sm" />
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        fontSize: t.font.size.base,
      }}>
        {node.name}
      </span>
    </a>
  );
};

const FolderChevron = ({ style }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const FolderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default FolderItem;

