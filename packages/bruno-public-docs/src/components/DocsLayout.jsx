import React, { createContext, useCallback, useState, useMemo } from 'react';
import DocsSidebar from './DocsSidebar.jsx';
import DocsContent from './DocsContent.jsx';
import EnvPicker from './EnvPicker.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { useIsMobile } from '../utils/ui.js';
import { buildMarkdownCss } from './MarkdownContent.jsx';
import { extractVariables } from '../utils/interpolate.js';

export const ThemeContext = createContext(null);

const DocsLayout = ({ collection, settings }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
  const [variables, setVariables] = useState({});
  const isMobile = useIsMobile(768);

  const extractedVars = useMemo(
    () => extractVariables(collection.items || []),
    [collection]
  );

  const handleActiveChange = useCallback((id) => {
    setActiveId(id);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const layoutStyle = {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: theme.bg.page,
    fontFamily: theme.font.sans,
    fontSize: theme.font.size.base,
    color: theme.text.primary,
    lineHeight: 1.5,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  };

  const customCss = settings?.custom_css;
  const logoUrl = settings?.custom_logo_url;
  const enrichedCollection = { ...collection, logoUrl };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {/* Global base styles */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.border.strong}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.text.muted}; }
        a { color: inherit; }
        h1,h2,h3,h4,h5,h6 { margin: 0; }
      `}</style>

      {/* Markdown content global CSS (single inject, no duplicates) */}
      <style id="md-content-css">{buildMarkdownCss(theme)}</style>

      {/* Highlight.js syntax theme */}
      {isDark ? <HljsDark /> : <HljsLight />}

      {/* User's custom CSS */}
      {customCss && <style id="custom-docs-css">{customCss}</style>}

      <div style={layoutStyle}>
        {/* Mobile overlay backdrop */}
        {isMobile && sidebarOpen && (
          <div
            onClick={handleSidebarClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 40,
            }}
          />
        )}

        {/* Sidebar — fixed on desktop, overlay on mobile */}
        <div
          style={{
            position: isMobile ? 'fixed' : 'sticky',
            top: 0,
            left: 0,
            zIndex: isMobile ? 50 : 'auto',
            height: '100vh',
            transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <DocsSidebar
            collection={enrichedCollection}
            theme={theme}
            activeId={activeId}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onClose={isMobile ? handleSidebarClose : undefined}
            isMobile={isMobile}
            onOpenEnvPicker={() => setEnvPickerOpen(true)}
            extractedVars={extractedVars}
          />
        </div>

        {/* Main content */}
        <DocsContent
          collection={enrichedCollection}
          theme={theme}
          settings={settings}
          onActiveChange={handleActiveChange}
          isMobile={isMobile}
          onOpenSidebar={() => setSidebarOpen(true)}
          variables={variables}
        />
      </div>

      {/* Environment Variables picker modal */}
      {envPickerOpen && (
        <EnvPicker
          variables={variables}
          extractedVars={extractedVars}
          onChange={setVariables}
          onClose={() => setEnvPickerOpen(false)}
          theme={theme}
        />
      )}
    </ThemeContext.Provider>
  );
};

// Inline highlight.js CSS
const HljsLight = () => (
  <style>{`.hljs{color:#383a42;background:#fafafa}.hljs-comment,.hljs-quote{color:#a0a1a7;font-style:italic}.hljs-doctag,.hljs-formula,.hljs-keyword{color:#a626a4}.hljs-deletion,.hljs-name,.hljs-section,.hljs-selector-tag,.hljs-subst{color:#e45649}.hljs-literal{color:#0184bb}.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#50a14f}.hljs-attr,.hljs-number,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-pseudo,.hljs-template-variable,.hljs-type,.hljs-variable{color:#986801}.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-symbol,.hljs-title{color:#4078f2}.hljs-built_in,.hljs-class .hljs-title,.hljs-title.class_{color:#c18401}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}.hljs-link{text-decoration:underline}`}</style>
);

const HljsDark = () => (
  <style>{`.hljs{color:#abb2bf;background:#282c34}.hljs-comment,.hljs-quote{color:#5c6370;font-style:italic}.hljs-doctag,.hljs-formula,.hljs-keyword{color:#c678dd}.hljs-deletion,.hljs-name,.hljs-section,.hljs-selector-tag,.hljs-subst{color:#e06c75}.hljs-literal{color:#56b6c2}.hljs-addition,.hljs-attribute,.hljs-meta .hljs-string,.hljs-regexp,.hljs-string{color:#98c379}.hljs-attr,.hljs-number,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-pseudo,.hljs-template-variable,.hljs-type,.hljs-variable{color:#d19a66}.hljs-bullet,.hljs-link,.hljs-meta,.hljs-selector-id,.hljs-symbol,.hljs-title{color:#61aeee}.hljs-built_in,.hljs-class .hljs-title,.hljs-title.class_{color:#e6c07b}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}.hljs-link{text-decoration:underline}`}</style>
);

export default DocsLayout;
