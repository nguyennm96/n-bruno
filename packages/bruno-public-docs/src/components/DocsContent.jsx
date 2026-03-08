import React, { useMemo } from 'react';
import RequestSection from './RequestSection.jsx';
import FolderSection from './FolderSection.jsx';
import CollectionOverview from './CollectionOverview.jsx';
import { getAllSectionIds } from '../utils/collection.js';
import { useActiveSection } from '../hooks/useActiveSection.js';

const DocsContent = ({ collection, theme, settings, onActiveChange, isMobile, onOpenSidebar, variables }) => {
  const t = theme;

  const allSectionIds = useMemo(() => getAllSectionIds(collection.items || []), [collection]);
  const activeId = useActiveSection(allSectionIds);

  React.useEffect(() => {
    if (onActiveChange) onActiveChange(activeId);
  }, [activeId, onActiveChange]);

  function renderItems(items) {
    return (items || []).map((node) => {
      if (node.type === 'folder') {
        return (
          <React.Fragment key={node.uid}>
            <FolderSection folder={node} theme={theme} settings={settings} isMobile={isMobile} />
            {renderItems(node.items || [])}
          </React.Fragment>
        );
      }
      return (
        <RequestSection
          key={node.uid}
          request={node}
          theme={theme}
          settings={settings}
          isMobile={isMobile}
          variables={variables || {}}
        />
      );
    });
  }

  const mainStyle = {
    flex: 1,
    overflowY: 'auto',
    height: '100vh',
    background: t.bg.page,
    minWidth: 0,
  };

  const mobileHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    background: t.bg.sidebar,
    borderBottom: `1px solid ${t.border.default}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  };

  const hamburgerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    background: 'transparent',
    color: t.text.secondary,
    cursor: 'pointer',
    flexShrink: 0,
  };

  const emptyStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: t.text.muted,
    fontSize: t.font.size.md,
  };

  return (
    <main style={mainStyle}>
      {/* Mobile sticky header with hamburger */}
      {isMobile && (
        <div style={mobileHeaderStyle}>
          <button
            style={hamburgerStyle}
            onClick={onOpenSidebar}
            onMouseOver={(e) => { e.currentTarget.style.background = t.bg.hover; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <HamburgerIcon />
          </button>
          <span style={{ fontSize: t.font.size.base, fontWeight: 600, color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {collection.info.name}
          </span>
        </div>
      )}

      {/* Collection Overview */}
      <CollectionOverview collection={collection} theme={theme} isMobile={isMobile} />

      {/* All sections */}
      {(collection.items || []).length === 0 ? (
        <div style={emptyStyle}>No endpoints in this collection</div>
      ) : (
        renderItems(collection.items || [])
      )}
    </main>
  );
};

const HamburgerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export default DocsContent;
