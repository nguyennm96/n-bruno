import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { common } from 'lowlight';

// All languages from the common lowlight grammar set
const LANGUAGES = Object.keys(common).sort();

// ── Prettier async format ─────────────────────────────────────────────────────
const PRETTIER_PARSERS = {
  javascript: 'babel',
  js: 'babel',
  jsx: 'babel',
  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  json: 'json',
  json5: 'json5',
  graphql: 'graphql',
  markdown: 'markdown',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml'
};

const formatCode = async (code, language) => {
  const parser = PRETTIER_PARSERS[language];
  if (!parser) return code;
  try {
    const prettier = await import('prettier/standalone');
    let plugin;
    if (parser === 'babel') plugin = await import('prettier/parser-babel');
    else if (parser === 'typescript') plugin = await import('prettier/parser-typescript');
    else if (parser === 'css') plugin = await import('prettier/parser-postcss');
    else if (parser === 'html') plugin = await import('prettier/parser-html');
    else if (parser === 'graphql') plugin = await import('prettier/parser-graphql');
    else if (parser === 'markdown') plugin = await import('prettier/parser-markdown');
    else if (parser === 'yaml') plugin = await import('prettier/parser-yaml');
    else return code;

    const mod = prettier.default ?? prettier;
    const pluginObj = plugin.default ?? plugin;
    return mod.format(code, { parser, plugins: [pluginObj] });
  } catch {
    return code;
  }
};

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const FormatIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Language Dropdown Portal ────────────────────────────────────────────────────
const LangDropdown = ({ anchorRef, open, onClose, languages, selected, onSelect }) => {
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position dropdown below anchor button
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 30);
  }, [open, anchorRef]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target)
        && anchorRef.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const filtered = search
    ? languages.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : languages;

  return createPortal(
    <div
      ref={dropdownRef}
      className="cbv-portal-dropdown"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 99999,
        width: 180,
        borderRadius: 6,
        padding: 4,
        border: '1px solid',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)'
      }}
    >
      <input
        ref={searchRef}
        className="cbv-portal-search"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '4px 8px',
          marginBottom: 4,
          borderRadius: 4,
          fontSize: 12,
          outline: 'none',
          border: '1px solid'
        }}
        placeholder="Search language…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation(); onClose();
          }
          if (e.key === 'Enter' && filtered.length > 0) { onSelect(filtered[0]); }
        }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {filtered.map((lang) => (
          <button
            key={lang}
            className={`cbv-portal-item${lang === selected ? ' active' : ''}`}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 4,
              fontWeight: lang === selected ? 600 : 400,
              whiteSpace: 'nowrap'
            }}
            onMouseDown={(e) => {
              e.preventDefault(); onSelect(lang);
            }}
          >
            {lang}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

/**
 * Tiptap ReactNodeView for code blocks.
 * Renders: language selector + Format + Copy buttons above the code content.
 */
const CodeBlockView = ({ node, updateAttributes, extension, getPos }) => {
  const language = node.attrs.language || 'plaintext';
  const [langOpen, setLangOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const langBtnRef = useRef(null);

  const handleCopy = useCallback(() => {
    const code = node.textContent;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [node.textContent]);

  const handleFormat = useCallback(async () => {
    const code = node.textContent;
    setFormatting(true);
    try {
      const formatted = await formatCode(code, language);
      if (formatted && formatted !== code) {
        updateAttributes({ formattedContent: formatted });
        // Tiptap: update the text content of the node
        // We dispatch a transaction to replace node content
        const { editor } = extension.options;
        if (editor) {
          const { state, view } = editor;
          const { tr } = state;
          // Find the position of this code block node
          let nodePos = null;
          state.doc.descendants((n, pos) => {
            if (n === node) {
              nodePos = pos; return false;
            }
          });
          if (nodePos !== null) {
            const textNode = state.schema.text(formatted.replace(/\n$/, ''));
            tr.replaceWith(nodePos + 1, nodePos + 1 + node.content.size, textNode);
            view.dispatch(tr);
          }
        }
      }
    } finally {
      setFormatting(false);
    }
  }, [node, language, updateAttributes, extension]);

  const canFormat = !!PRETTIER_PARSERS[language];

  return (
    <NodeViewWrapper className="tiptap-code-block">
      {/* Panel bar */}
      <div className="cbv-panel" contentEditable={false}>
        {/* Language selector */}
        <button
          ref={langBtnRef}
          className="cbv-btn cbv-lang-btn"
          onMouseDown={(e) => {
            e.preventDefault(); setLangOpen((v) => !v);
          }}
        >
          <span>{language || 'plaintext'}</span>
          <ChevronIcon />
        </button>

        <LangDropdown
          anchorRef={langBtnRef}
          open={langOpen}
          onClose={() => setLangOpen(false)}
          languages={LANGUAGES}
          selected={language}
          onSelect={(lang) => {
            const pos = typeof getPos === 'function' ? getPos() : null;
            updateAttributes({ language: lang });
            setLangOpen(false);
            const { editor } = extension.options;
            if (editor && pos !== null) {
              requestAnimationFrame(() => {
                // pos+1 puts cursor inside the code content (not the node itself)
                editor.chain().focus().setTextSelection(pos + 1).run();
              });
            } else if (editor) {
              requestAnimationFrame(() => editor.commands.focus());
            }
          }}
        />

        <div className="cbv-spacer" />

        {/* Format button */}
        {canFormat && (
          <button
            className="cbv-btn"
            title="Format code (Prettier)"
            disabled={formatting}
            onMouseDown={(e) => {
              e.preventDefault(); handleFormat();
            }}
          >
            <FormatIcon />
            <span>{formatting ? 'Formatting…' : 'Format'}</span>
          </button>
        )}

        {/* Copy button */}
        <button
          className="cbv-btn"
          title="Copy code"
          onMouseDown={(e) => {
            e.preventDefault(); handleCopy();
          }}
        >
          <CopyIcon />
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code content — Tiptap manages editing here */}
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

export default CodeBlockView;
