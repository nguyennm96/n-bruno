import React, { useState, useRef, useEffect } from 'react';
import FolderItem from './FolderItem.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { filterItems, OVERVIEW_ANCHOR_ID } from '../utils/collection.js';

const SIDEBAR_WIDTH = 280;

const DocsSidebar = ({ collection, theme, activeId, isDark, onToggleTheme, onClose, isMobile, onOpenEnvPicker, extractedVars }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const t = theme;
  const navRef = useRef(null);

  const filteredItems = filterItems(collection.items || [], searchQuery);

  // Auto-scroll active nav item into view
  useEffect(() => {
    if (!activeId || !navRef.current) return;
    const el = navRef.current.querySelector(`[data-anchor="${activeId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId]);

  const sidebarStyle = {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    height: '100vh',
    background: t.bg.sidebar,
    boxShadow: t.shadow.sidebar,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
  };

  const headerStyle = {
    padding: '20px 16px 14px',
    borderBottom: `1px solid ${t.border.default}`,
    flexShrink: 0,
  };

  const logoStyle = {
    maxWidth: '120px',
    maxHeight: '32px',
    objectFit: 'contain',
    marginBottom: '12px',
    display: 'block',
  };

  const collectionNameStyle = {
    fontSize: t.font.size.lg,
    fontWeight: 700,
    color: t.text.primary,
    lineHeight: 1.3,
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const collectionDescStyle = {
    fontSize: t.font.size.sm,
    color: t.text.secondary,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const searchStyle = {
    padding: '10px 12px',
    borderBottom: `1px solid ${t.border.default}`,
    flexShrink: 0,
  };

  const inputWrapStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    padding: '6px 10px',
  };

  const inputStyle = {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: t.text.primary,
    fontSize: t.font.size.base,
    fontFamily: t.font.sans,
    lineHeight: 1.4,
  };

  const navStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  };

  const footerStyle = {
    padding: '10px 12px',
    borderTop: `1px solid ${t.border.default}`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const poweredStyle = {
    fontSize: t.font.size.xs,
    color: t.text.muted,
  };

  const emptyStyle = {
    padding: '20px 16px',
    color: t.text.muted,
    fontSize: t.font.size.sm,
    textAlign: 'center',
  };

  return (
    <aside style={sidebarStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {collection.logoUrl && (
              <img src={collection.logoUrl} alt="Logo" style={logoStyle} />
            )}
            <div style={collectionNameStyle}>{collection.info.name}</div>
            {collection.info.description && (
              <div style={collectionDescStyle}>{collection.info.description}</div>
            )}
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: t.text.muted, padding: '2px', display: 'flex', flexShrink: 0,
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={searchStyle}>
        <div style={inputWrapStyle}>
          <SearchIcon color={t.text.muted} />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={inputStyle}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.text.muted, lineHeight: 1, display: 'flex' }}
            >
              <ClearIcon />
            </button>
          )}
        </div>
      </div>

      {/* Navigation tree */}
      <nav style={navStyle} ref={navRef}>
        {/* Overview link */}
        {!searchQuery && (() => {
          const isActive = activeId === OVERVIEW_ANCHOR_ID;
          return (
            <a
              href={`#${OVERVIEW_ANCHOR_ID}`}
              data-anchor={OVERVIEW_ANCHOR_ID}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(OVERVIEW_ANCHOR_ID);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 16px',
                textDecoration: 'none',
                color: isActive ? t.text.activeItem : t.text.sidebarItem,
                background: isActive ? t.bg.activeItem : 'transparent',
                borderLeft: `2px solid ${isActive ? t.border.focus : 'transparent'}`,
                fontSize: t.font.size.base, fontWeight: 500,
                transition: t.transition,
                marginBottom: '2px',
              }}
              onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.background = t.bg.hover; e.currentTarget.style.color = t.text.primary; } }}
              onMouseOut={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.text.sidebarItem; } }}
            >
              <HomeIcon color={isActive ? t.text.activeItem : t.text.muted} />
              Overview
            </a>
          );
        })()}

        {filteredItems.length === 0 ? (
          <div style={emptyStyle}>
            {searchQuery ? 'No results found' : 'No endpoints'}
          </div>
        ) : (
          filteredItems.map((node, i) => (
            <FolderItem
              key={node.uid || i}
              node={node}
              theme={theme}
              activeId={activeId}
              searchQuery={searchQuery}
              level={0}
            />
          ))
        )}
      </nav>

      {/* Footer */}
      <div style={footerStyle}>
        <span style={poweredStyle}>Powered by Bruno</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {extractedVars && extractedVars.length > 0 && onOpenEnvPicker && (
            <button
              onClick={onOpenEnvPicker}
              title="Environment Variables"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px',
                background: 'transparent',
                border: `1px solid ${t.border.default}`,
                borderRadius: t.radius.sm,
                cursor: 'pointer',
                color: t.text.muted,
                fontSize: t.font.size.xs,
                fontWeight: 500,
                transition: 'color 0.1s ease, border-color 0.1s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = t.text.primary; e.currentTarget.style.borderColor = t.border.strong || t.text.muted; }}
              onMouseOut={(e) => { e.currentTarget.style.color = t.text.muted; e.currentTarget.style.borderColor = t.border.default; }}
            >
              <VarsIcon />
              Vars
            </button>
          )}
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} theme={theme} />
        </div>
      </div>
    </aside>
  );
};

const HomeIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const VarsIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
  </svg>
);

const SearchIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ClearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default DocsSidebar;
