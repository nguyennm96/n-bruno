import { useState, useRef, useEffect } from 'react';

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
const CodeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
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
const ImageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
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
const ChevronIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Core: restore selection + exec native command ─────────────────────────────
const runCommand = (savedRange, cmd, value = null) => {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  document.execCommand(cmd, false, value);
};

const queryActive = (cmd) => {
  try { return document.queryCommandState(cmd); } catch { return false; }
};

// Check if current selection is inside a given tag (e.g. 'CODE', 'DEL')
const isInsideTag = (tagName) => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  while (node && node !== document.body) {
    if (node.nodeName === tagName.toUpperCase()) return true;
    node = node.parentNode;
  }
  return false;
};

// Remove the nearest ancestor tag wrapping the cursor, keeping its children
const unwrapNearestTag = (tagName) => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  let target = null;
  let cur = node;
  while (cur && cur !== document.body) {
    if (cur.nodeName === tagName.toUpperCase()) {
      target = cur; break;
    }
    cur = cur.parentNode;
  }
  if (!target || !target.parentNode) return;
  const parent = target.parentNode;
  while (target.firstChild) parent.insertBefore(target.firstChild, target);
  parent.removeChild(target);
};

// Convert a block tag (e.g. PRE) to a paragraph, preserving text
const convertBlockToP = (tagName) => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  let target = node;
  while (target && target !== document.body) {
    if (target.nodeName === tagName.toUpperCase()) break;
    target = target.parentNode;
  }
  if (!target || target === document.body || !target.parentNode) return;
  const p = document.createElement('p');
  p.textContent = target.textContent;
  target.parentNode.replaceChild(p, target);
  const range = document.createRange();
  range.selectNodeContents(p);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

// Insert arbitrary HTML at the current saved position
const insertHtmlAt = (savedRange, html) => {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  document.execCommand('insertHTML', false, html);
};

// Wrap selected text in a tag (inline code, strikethrough via insertHTML)
const wrapSelection = (savedRange, tag) => {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const text = sel.toString();
  document.execCommand('insertHTML', false, `<${tag}>${text || 'text'}</${tag}>`);
};

// ── Primitives ────────────────────────────────────────────────────────────────
const Divider = () => <div className="toolbar-divider" />;

const Btn = ({ onClick, active, title, children }) => (
  <button
    className={`toolbar-btn${active ? ' is-active' : ''}`}
    title={title}
    onMouseDown={(e) => {
      e.preventDefault(); onClick();
    }}
  >
    {children}
  </button>
);

// Dropdown button with a list of items
const Dropdown = ({ trigger, items, onAction, active }) => {
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
const PopoverBtn = ({ icon, title, fields, onSubmit, align = 'left' }) => {
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

// ── Main Toolbar ──────────────────────────────────────────────────────────────

const Toolbar = ({ editorRef, savedRange, onContentChange }) => {
  // Notify parent that content changed after a command runs
  const after = (fn) => {
    fn();
    requestAnimationFrame(() => onContentChange?.());
  };

  const cmd = (command, value) => after(() => runCommand(savedRange, command, value));

  const isBold = queryActive('bold');
  const isItalic = queryActive('italic');
  const isUL = queryActive('insertUnorderedList');
  const isOL = queryActive('insertOrderedList');
  const isCode = isInsideTag('code') && !isInsideTag('pre'); // inline code only
  const isPre = isInsideTag('pre');
  const isStrike = isInsideTag('del') || isInsideTag('s');
  const blockFormat = (() => { try { return document.queryCommandValue('formatBlock').toLowerCase(); } catch { return ''; } })();
  const isBlockquote = blockFormat === 'blockquote';
  const activeHeading = /^h[1-6]$/.test(blockFormat) ? blockFormat : null;

  const headingItems = [
    { label: 'Heading 1', action: () => cmd('formatBlock', blockFormat === 'h1' ? 'p' : 'h1') },
    { label: 'Heading 2', action: () => cmd('formatBlock', blockFormat === 'h2' ? 'p' : 'h2') },
    { label: 'Heading 3', action: () => cmd('formatBlock', blockFormat === 'h3' ? 'p' : 'h3') },
    { label: 'Normal text', action: () => cmd('formatBlock', 'p') }
  ];

  const codeItems = [
    {
      label: 'Inline code',
      action: () => after(() => {
        if (isCode) { unwrapNearestTag('code'); } else { wrapSelection(savedRange, 'code'); }
      })
    },
    {
      label: isPre ? 'Remove code block' : 'Code block',
      action: () => after(() => {
        if (isPre) {
          convertBlockToP('pre');
        } else {
          const sel = window.getSelection();
          const text = (sel && !sel.isCollapsed) ? sel.toString() : 'code here';
          insertHtmlAt(savedRange, `<pre><code>${text}</code></pre>`);
        }
      })
    }
  ];

  return (
    <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {/* Headings */}
      <Dropdown
        trigger={<span className="toolbar-label">{activeHeading ? activeHeading.toUpperCase() : 'H'}</span>}
        items={headingItems}
        onAction={(fn) => after(fn)}
        active={!!activeHeading}
      />
      <Divider />

      {/* Inline formatting */}
      <Btn onClick={() => cmd('bold')} active={isBold} title="Bold (Ctrl+B)"><BoldIcon /></Btn>
      <Btn onClick={() => cmd('italic')} active={isItalic} title="Italic (Ctrl+I)"><ItalicIcon /></Btn>
      <Btn
        onClick={() => after(() => {
          if (isStrike) {
            unwrapNearestTag('del'); unwrapNearestTag('s');
          } else { wrapSelection(savedRange, 'del'); }
        })}
        active={isStrike}
        title="Strikethrough"
      >
        <StrikeIcon />
      </Btn>
      <Divider />

      {/* Code */}
      <Dropdown
        trigger={<CodeIcon />}
        items={codeItems}
        onAction={(fn) => after(fn)}
        active={isCode || isPre}
      />

      {/* Blockquote */}
      <Btn onClick={() => cmd('formatBlock', isBlockquote ? 'p' : 'blockquote')} active={isBlockquote} title="Blockquote"><QuoteIcon /></Btn>
      <Divider />

      {/* Lists */}
      <Btn onClick={() => cmd('insertUnorderedList')} active={isUL} title="Bullet list">
        <span className="toolbar-label" style={{ fontSize: 14 }}>•≡</span>
      </Btn>
      <Btn onClick={() => cmd('insertOrderedList')} active={isOL} title="Ordered list">
        <span className="toolbar-label" style={{ fontSize: 11 }}>1≡</span>
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
        onSubmit={({ url, text }) => {
          if (!url) return;
          after(() => {
            if (text) {
              insertHtmlAt(savedRange, `<a href="${url}" rel="noopener noreferrer">${text}</a>`);
            } else {
              runCommand(savedRange, 'createLink', url);
            }
          });
        }}
      />

      {/* Image */}
      <PopoverBtn
        icon={<ImageIcon />}
        title="Insert Image"
        align="right"
        fields={[
          { key: 'src', label: 'Image URL', placeholder: 'https://...' },
          { key: 'alt', label: 'Alt text', placeholder: 'description' }
        ]}
        onSubmit={({ src, alt }) => {
          if (!src) return;
          after(() => insertHtmlAt(savedRange, `<img src="${src}" alt="${alt || ''}" />`));
        }}
      />

      {/* Table */}
      <PopoverBtn
        icon={<TableIcon />}
        title="Insert Table"
        align="right"
        fields={[
          { key: 'rows', label: 'Rows', placeholder: '3', defaultValue: '3' },
          { key: 'cols', label: 'Columns', placeholder: '3', defaultValue: '3' }
        ]}
        onSubmit={({ rows, cols }) => {
          const r = Math.max(1, parseInt(rows) || 3);
          const c = Math.max(1, parseInt(cols) || 3);
          const headerCells = Array.from({ length: c }, (_, i) => `<th></th>`).join('');
          const bodyRows = Array.from({ length: r - 1 }, () => {
            const cells = Array.from({ length: c }, () => '<td></td>').join('');
            return `<tr>${cells}</tr>`;
          }).join('');
          const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
          after(() => {
            insertHtmlAt(savedRange, html);
            // Move cursor into the first header cell after insertion
            requestAnimationFrame(() => {
              const el = editorRef.current;
              if (!el) return;
              const tables = el.querySelectorAll('table');
              const lastTable = tables[tables.length - 1];
              if (!lastTable) return;
              const firstCell = lastTable.querySelector('th, td');
              if (!firstCell) return;
              const range = document.createRange();
              range.setStart(firstCell, 0);
              range.collapse(true);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              firstCell.focus?.();
            });
          });
        }}
      />

      {/* Horizontal Rule */}
      <Btn onClick={() => cmd('insertHorizontalRule')} title="Horizontal Rule"><HrIcon /></Btn>
    </div>
  );
};

export default Toolbar;
