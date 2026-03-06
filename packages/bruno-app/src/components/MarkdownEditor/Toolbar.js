import { useState, useRef, useEffect, useCallback } from 'react';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const BoldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);
const ItalicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);
const StrikeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <path d="M16 6C16 6 14.5 4 12 4C9.5 4 7 5.5 7 8C7 10.5 10 11.5 12 12" />
    <path d="M8 18C8 18 9.5 20 12 20C14.5 20 17 18.5 17 16C17 13.5 14 12.5 12 12" />
  </svg>
);
const InlineCodeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);
const CodeBlockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" /><line x1="8" y1="17" x2="12" y2="17" />
  </svg>
);
const TableIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
const HrIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);
const SourceIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);
const CheckSquareIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const QuoteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
);
const LinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const Divider = () => <div className="toolbar-divider" />;

const Btn = ({ onClick, active, title, children, disabled }) => (
  <button
    className={`toolbar-btn${active ? ' is-active' : ''}`}
    title={title}
    disabled={disabled}
    onMouseDown={(e) => {
      e.preventDefault(); onClick();
    }}
  >
    {children}
  </button>
);

// Dropdown button with a list of items
const Dropdown = ({ trigger, items, onAction, active, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button
        className={`toolbar-btn toolbar-btn-dropdown${active ? ' is-active' : ''}`}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault(); setOpen((v) => !v);
        }}
      >
        {trigger}<ChevronIcon />
      </button>
      {open && (
        <div className="toolbar-dropdown-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className="toolbar-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault(); onAction(item.action); setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Popover button — opens a small form for URL inputs, etc.
const PopoverBtn = ({ icon, title, fields, onSubmit, align = 'left', btnAttr = {}, disabled }) => {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({});
  const ref = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const init = {};
    fields.forEach((f) => { init[f.key] = f.defaultValue || ''; });
    setVals(init);
    requestAnimationFrame(() => firstRef.current?.focus());
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const submit = () => {
    onSubmit(vals); setOpen(false);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); submit();
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="toolbar-dropdown" ref={ref}>
      <button
        className="toolbar-btn"
        title={title}
        disabled={disabled}
        {...btnAttr}
        onMouseDown={(e) => {
          e.preventDefault(); setOpen((v) => !v);
        }}
      >
        {icon}
      </button>
      {open && (
        <div className={`toolbar-popover${align === 'right' ? ' align-right' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
          <div className="popover-title">{title}</div>
          {fields.map((f, i) => (
            <div key={f.key} className="popover-row">
              <label className="popover-label">{f.label}</label>
              <input
                ref={i === 0 ? firstRef : null}
                className="popover-input"
                type="text"
                placeholder={f.placeholder || ''}
                value={vals[f.key] || ''}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                onKeyDown={onKeyDown}
              />
            </div>
          ))}
          <div className="popover-actions">
            <button
              className="popover-btn popover-cancel"
              onMouseDown={(e) => {
                e.preventDefault(); setOpen(false);
              }}
            >Cancel
            </button>
            <button
              className="popover-btn popover-submit"
              onMouseDown={(e) => {
                e.preventDefault(); submit();
              }}
            >Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Toolbar ───────────────────────────────────────────────────────────────

/**
 * Props:
 *   editor           {Editor}    Tiptap editor instance
 *   isSourceMode     {boolean}
 *   onSourceToggle   {fn}
 */
const Toolbar = ({ editor, isSourceMode, onSourceToggle, isDisabled = false }) => {
  if (!editor && !isSourceMode) return null;
  const controlsDisabled = isSourceMode || isDisabled;

  const isBold = editor?.isActive('bold') ?? false;
  const isItalic = editor?.isActive('italic') ?? false;
  const isStrike = editor?.isActive('strike') ?? false;
  const isUL = editor?.isActive('bulletList') ?? false;
  const isOL = editor?.isActive('orderedList') ?? false;
  const isCode = editor?.isActive('code') ?? false;
  const isCodeBlock = editor?.isActive('codeBlock') ?? false;
  const isBlockquote = editor?.isActive('blockquote') ?? false;
  const activeHeading = [1, 2, 3].find((l) => editor?.isActive('heading', { level: l })) ?? null;

  const cmd = useCallback((fn) => {
    if (!editor) return;
    fn(editor.chain().focus());
  }, [editor]);

  const headingItems = [
    { label: 'Heading 1', action: () => cmd((c) => (activeHeading === 1 ? c.setParagraph() : c.setHeading({ level: 1 })).run()) },
    { label: 'Heading 2', action: () => cmd((c) => (activeHeading === 2 ? c.setParagraph() : c.setHeading({ level: 2 })).run()) },
    { label: 'Heading 3', action: () => cmd((c) => (activeHeading === 3 ? c.setParagraph() : c.setHeading({ level: 3 })).run()) },
    { label: 'Normal text', action: () => cmd((c) => c.setParagraph().run()) }
  ];

  return (
    <div className={`md-toolbar${isDisabled ? ' is-readonly' : ''}`} onMouseDown={(e) => e.preventDefault()}>
      {/* Headings */}
      <Dropdown
        trigger={<span className="toolbar-label">{activeHeading ? `H${activeHeading}` : 'H'}</span>}
        items={headingItems}
        onAction={(fn) => fn()}
        active={!!activeHeading}
        disabled={controlsDisabled}
      />
      <Divider />

      {/* Inline formatting */}
      <Btn onClick={() => cmd((c) => c.toggleBold().run())} active={isBold} title="Bold (Ctrl+B)" disabled={controlsDisabled}><BoldIcon /></Btn>
      <Btn onClick={() => cmd((c) => c.toggleItalic().run())} active={isItalic} title="Italic (Ctrl+I)" disabled={controlsDisabled}><ItalicIcon /></Btn>
      <Btn onClick={() => cmd((c) => c.toggleStrike().run())} active={isStrike} title="Strikethrough" disabled={controlsDisabled}><StrikeIcon /></Btn>
      <Divider />

      {/* Code */}
      <Btn onClick={() => cmd((c) => c.toggleCode().run())} active={isCode} title="Inline code" disabled={controlsDisabled}><InlineCodeIcon /></Btn>
      <Btn onClick={() => cmd((c) => c.toggleCodeBlock().run())} active={isCodeBlock} title="Code block" disabled={controlsDisabled}><CodeBlockIcon /></Btn>

      {/* Blockquote */}
      <Btn onClick={() => cmd((c) => c.toggleBlockquote().run())} active={isBlockquote} title="Blockquote" disabled={controlsDisabled}><QuoteIcon /></Btn>
      <Divider />

      {/* Lists */}
      <Btn onClick={() => cmd((c) => c.toggleBulletList().run())} active={isUL} title="Bullet list" disabled={controlsDisabled}>
        <span className="toolbar-label" style={{ fontSize: 14 }}>•≡</span>
      </Btn>
      <Btn onClick={() => cmd((c) => c.toggleOrderedList().run())} active={isOL} title="Ordered list" disabled={controlsDisabled}>
        <span className="toolbar-label" style={{ fontSize: 11 }}>1≡</span>
      </Btn>
      <Btn
        onClick={() => cmd((c) => c.toggleTaskList().run())}
        active={editor?.isActive('taskList') ?? false}
        title="Task list"
        disabled={controlsDisabled}
      >
        <CheckSquareIcon />
      </Btn>
      <Divider />

      {/* Link */}
      <PopoverBtn
        icon={<LinkIcon />}
        title="Insert Link"
        fields={[
          { key: 'url', label: 'URL', placeholder: 'https://...' },
          { key: 'text', label: 'Link text', placeholder: 'leave empty to use selection' }
        ]}
        btnAttr={{ 'data-toolbar': 'link' }}
        disabled={controlsDisabled}
        onSubmit={({ url, text }) => {
          if (!url || !editor) return;
          const chain = editor.chain().focus();
          if (text) chain.insertContent(`<a href="${url}">${text}</a>`).run();
          else chain.setLink({ href: url, target: '_blank' }).run();
        }}
      />

      {/* Table — insert only */}
      <PopoverBtn
        icon={<TableIcon />}
        title="Insert Table"
        align="right"
        disabled={controlsDisabled}
        fields={[
          { key: 'rows', label: 'Rows', placeholder: '3', defaultValue: '3' },
          { key: 'cols', label: 'Columns', placeholder: '3', defaultValue: '3' }
        ]}
        onSubmit={({ rows, cols }) => {
          if (!editor) return;
          const r = Math.max(1, parseInt(rows) || 3);
          const c = Math.max(1, parseInt(cols) || 3);
          editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run();
        }}
      />

      {/* Horizontal Rule */}
      <Btn onClick={() => cmd((c) => c.setHorizontalRule().run())} title="Horizontal Rule" disabled={controlsDisabled}><HrIcon /></Btn>

      {/* Right section: Source toggle */}
      <div className="toolbar-spacer" />
      <Btn onClick={onSourceToggle} active={isSourceMode} title="Markdown source (raw)" disabled={isDisabled}><SourceIcon /></Btn>
    </div>
  );
};

export default Toolbar;
