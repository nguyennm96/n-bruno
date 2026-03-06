import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { columnResizing, tableEditing, TableMap } from '@tiptap/pm/tables';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import { useTheme } from 'providers/Theme';
import Toolbar from './Toolbar';
import CodeBlockView from './CodeBlockView';
import StyledWrapper, { LangDropdownGlobalStyle, MethodBadgeGlobalStyle, TableControlsGlobalStyle } from './StyledWrapper';
import TableControls from './TableControls';

const lowlight = createLowlight(common);

/**
 * ProseMirror plugin for initial table column width distribution.
 * Only fires when a table has auto-sized columns (newly inserted or after add/delete column).
 * Distributes them equally to fill the editor width.
 * Does NOT scale down tables that overflow — those scroll instead.
 */
function clampTableResizePlugin() {
  let viewRef = null;
  return new Plugin({
    key: new PluginKey('clampTableResize'),
    view(editorView) {
      viewRef = editorView;
      return { destroy() { viewRef = null; } };
    },
    appendTransaction(transactions, oldState, newState) {
      if (!viewRef || oldState.doc === newState.doc) return null;
      const maxWidth = viewRef.dom.clientWidth;
      const { nodes } = newState.schema;
      let resultTr = null;

      newState.doc.descendants((node, tablePos) => {
        if (node.type !== nodes.table) return;

        // Collect per-column widths from the first row (0 = auto)
        const colWidths = [];
        let measured = false;
        node.descendants((child) => {
          if (measured) return false;
          if (child.type === nodes.tableRow) {
            child.forEach((cell) => {
              const cw = cell.attrs.colwidth;
              colWidths.push(cw && cw[0] > 0 ? cw[0] : 0);
            });
            measured = true;
            return false;
          }
        });

        if (!measured || !colWidths.length) return false;

        // Only act when there are auto-sized columns (new table or add/delete column)
        const hasAuto = colWidths.some((w) => w === 0);
        if (!hasAuto) return false;

        const totalCols = colWidths.length;
        const base = Math.floor(maxWidth / totalCols);
        const targetWidths = Array(totalCols).fill(base);
        // Last column absorbs rounding remainder
        targetWidths[totalCols - 1] = Math.max(80, maxWidth - base * (totalCols - 1));

        const map = TableMap.get(node);
        if (!resultTr) resultTr = newState.tr;

        for (let row = 0; row < map.height; row++) {
          for (let col = 0; col < map.width; col++) {
            const cellOffset = map.map[row * map.width + col];
            if (col > 0 && cellOffset === map.map[row * map.width + col - 1]) continue;
            if (row > 0 && cellOffset === map.map[(row - 1) * map.width + col]) continue;

            const cell = node.nodeAt(cellOffset);
            if (!cell) continue;

            const colspan = cell.attrs.colspan || 1;
            const newCw = Array.from({ length: colspan }, (_, i) =>
              Math.max(80, targetWidths[col + i] ?? targetWidths[col])
            );
            const cw = cell.attrs.colwidth;
            if (cw && cw.length === newCw.length && cw.every((v, i) => v === newCw[i])) continue;

            resultTr.setNodeMarkup(tablePos + 1 + cellOffset, undefined, {
              ...cell.attrs,
              colwidth: newCw
            });
          }
        }

        return false;
      });

      return resultTr?.docChanged ? resultTr : null;
    }
  });
}

// Table extension with:
//  - column resizing always enabled (not gated on editor.isEditable at init time)
//  - insertTable override to create with equal widths filling the editor
const ResizableTable = Table.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      insertTable: ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ tr, dispatch, editor }) => {
          const editorWidth = editor.view.dom.clientWidth;
          const colWidth = Math.floor(editorWidth / cols);
          const { schema } = editor;
          const { tableCell, tableHeader, tableRow, table } = schema.nodes;

          // Last column absorbs rounding remainder so total = editorWidth exactly
          const lastColWidth = editorWidth - colWidth * (cols - 1);
          const makeCell = (isHeader, colIdx) => {
            const CellType = isHeader ? tableHeader : tableCell;
            const w = colIdx === cols - 1 ? lastColWidth : colWidth;
            return CellType.createAndFill({ colwidth: [w] });
          };
          const makeRow = (isHeader) =>
            tableRow.create(null, Array.from({ length: cols }, (_, i) => makeCell(isHeader, i)));

          const rowNodes = [];
          if (withHeaderRow) rowNodes.push(makeRow(true));
          for (let r = withHeaderRow ? 1 : 0; r < rows; r++) rowNodes.push(makeRow(false));

          const tableNode = table.create(null, rowNodes);
          if (dispatch) {
            const offset = tr.selection.from + 1;
            tr.replaceSelectionWith(tableNode).scrollIntoView();
            tr.setSelection(TextSelection.near(tr.doc.resolve(offset)));
          }
          return true;
        }
    };
  },
  addProseMirrorPlugins() {
    return [
      columnResizing({
        handleWidth: this.options.handleWidth,
        cellMinWidth: this.options.cellMinWidth,
        defaultCellMinWidth: this.options.cellMinWidth,
        lastColumnResizable: this.options.lastColumnResizable
      }),
      tableEditing({
        allowTableNodeSelection: this.options.allowTableNodeSelection
      }),
      clampTableResizePlugin()
    ];
  }
});

/**
 * WYSIWYG Markdown editor powered by Tiptap + ProseMirror.
 *
 * Props:
 *   value       {string}   markdown string (controlled)
 *   onEdit      {fn}       called with markdown on every change
 *   onSave      {fn}       called when user presses Ctrl+S
 *   placeholder {string}
 *   height      {number}   min-height in px (default 200)
 */
const MarkdownEditor = ({ value, onEdit, onSave, placeholder, height = 200 }) => {
  const { displayedTheme } = useTheme();
  const containerRef = useRef(null);
  const sourceTextareaRef = useRef(null);
  const onEditRef = useRef(onEdit);
  const onSaveRef = useRef(onSave);
  onEditRef.current = onEdit;
  onSaveRef.current = onSave;

  const [isEditing, setIsEditing] = useState(false);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState('');
  // ── Tiptap editor setup ────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in code block — we use CodeBlockLowlight instead
        codeBlock: false,
        // Use built-in history
        history: true
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
        addKeyboardShortcuts() {
          // Tab width by language convention; default 2
          const TAB_WIDTH = {
            'python': 4, 'py': 4,
            'java': 4, 'kotlin': 4, 'scala': 4,
            'c': 4, 'cpp': 4, 'c++': 4, 'cs': 4, 'csharp': 4,
            'rust': 4, 'rs': 4,
            'go': 4,
            'php': 4,
            'swift': 4,
            'ruby': 2, 'rb': 2
          };

          const getIndent = (lang) => ' '.repeat(TAB_WIDTH[lang?.toLowerCase()] ?? 2);

          const inCodeBlock = () => {
            const { $from } = this.editor.state.selection;
            for (let d = $from.depth; d > 0; d--) {
              if ($from.node(d).type.name === 'codeBlock') return { depth: d, $from };
            }
            return null;
          };

          return {
            // Cmd/Ctrl+A → select only code block content
            'Mod-a': () => {
              const loc = inCodeBlock();
              if (!loc) return false;
              const { depth, $from } = loc;
              this.editor.chain().setTextSelection({
                from: $from.start(depth),
                to: $from.end(depth)
              }).run();
              return true;
            },

            // Tab → insert language-aware spaces
            'Tab': () => {
              const loc = inCodeBlock();
              if (!loc) return false;
              const lang = loc.$from.node(loc.depth).attrs.language;
              const { state, view } = this.editor;
              view.dispatch(state.tr.insertText(getIndent(lang)));
              return true;
            },

            // Shift+Tab → remove one indent level from line start
            'Shift-Tab': () => {
              const loc = inCodeBlock();
              if (!loc) return false;
              const lang = loc.$from.node(loc.depth).attrs.language;
              const indent = getIndent(lang);
              const { state, view } = this.editor;
              const { $from } = state.selection;
              const blockStart = $from.start(loc.depth);
              const textBeforeCursor = $from.node(loc.depth).textContent.slice(0, $from.pos - blockStart);
              const lineStart = blockStart + textBeforeCursor.lastIndexOf('\n') + 1;
              const lineText = state.doc.textBetween(lineStart, $from.end(loc.depth));
              if (lineText.startsWith(indent)) {
                view.dispatch(state.tr.delete(lineStart, lineStart + indent.length));
              } else {
                const spaces = lineText.match(/^( +)/)?.[1];
                if (spaces) view.dispatch(state.tr.delete(lineStart, lineStart + spaces.length));
              }
              return true;
            },

            // Enter → newline + preserve current line indentation
            'Enter': () => {
              const loc = inCodeBlock();
              if (!loc) return false;
              const { state, view } = this.editor;
              const { $from, empty } = state.selection;
              if (!empty) return false;
              const blockStart = $from.start(loc.depth);
              const textBeforeCursor = $from.node(loc.depth).textContent.slice(0, $from.pos - blockStart);
              const currentLine = textBeforeCursor.slice(textBeforeCursor.lastIndexOf('\n') + 1);
              const indent = currentLine.match(/^(\s*)/)[1];
              view.dispatch(state.tr.insertText('\n' + indent));
              return true;
            }
          };
        }
      }).configure({ lowlight }),
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
      }),
      Image.configure({ inline: false, allowBase64: true }),
      ResizableTable.configure({
        resizable: true,
        cellMinWidth: 80 // 24px padding + 56px minimum readable content
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: placeholder || 'Click to add documentation…'
      })
    ],
    content: value ? { type: 'doc', content: [] } : '',
    editable: false,
    onUpdate: ({ editor: e }) => {
      if (!isEditing) return;
      const markdown = e.storage.markdown.getMarkdown();
      onEditRef.current?.(markdown);
    },
    onCreate: ({ editor: e }) => {
      if (value) {
        e.commands.setContent(value);
      }
    }
  });

  // ── Load external value changes (when not editing) ──────────────────────────
  useEffect(() => {
    if (!editor || isEditing) return;
    const current = editor.storage.markdown.getMarkdown();
    if (current !== value) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor, isEditing]);

  // ── Enter / exit edit mode ─────────────────────────────────────────────────
  const enterEdit = useCallback(() => {
    if (isEditing || !editor) return;
    setIsEditing(true);
    editor.setEditable(true);
    requestAnimationFrame(() => editor.commands.focus('end'));
  }, [isEditing, editor]);

  const exitEdit = useCallback(() => {
    if (!isEditing || !editor) return;
    setIsEditing(false);
    setIsSourceMode(false);
    editor.setEditable(false);
    if (isSourceMode) {
      editor.commands.setContent(sourceValue || '');
      onEditRef.current?.(sourceValue);
    } else {
      const markdown = editor.storage.markdown.getMarkdown();
      onEditRef.current?.(markdown);
    }
  }, [isEditing, editor, isSourceMode, sourceValue]);

  // ── Click outside → exit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      // Ignore clicks inside portal-rendered dropdowns (they live in document.body)
      if (e.target.closest?.('.cbv-portal-dropdown')) return;
      if (e.target.closest?.('.toolbar-dropdown-menu')) return;
      if (e.target.closest?.('.toolbar-popover')) return;
      if (e.target.closest?.('.tc-portal')) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        exitEdit();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditing, exitEdit]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSaveRef.current?.();
        return;
      }
      if (e.key === 'Escape') exitEdit();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isEditing, exitEdit]);

  const handleModeChange = useCallback((mode) => {
    if (!editor) return;
    if (mode === 'markdown') {
      if (isSourceMode) return;
      const markdown = editor.storage.markdown.getMarkdown();
      setSourceValue(markdown);
      editor.setEditable(false);
      setIsSourceMode(true);
      return;
    }

    if (!isSourceMode) return;
    editor.commands.setContent(sourceValue || '');
    editor.setEditable(true);
    onEditRef.current?.(sourceValue);
    setIsSourceMode(false);
    requestAnimationFrame(() => editor.commands.focus());
  }, [editor, isSourceMode, sourceValue]);

  // ── Source textarea change ────────────────────────────────────────────────
  const handleSourceChange = useCallback((e) => {
    const md = e.target.value;
    setSourceValue(md);
    onEditRef.current?.(md);
  }, []);

  const applyMarkdownTransform = useCallback((transform) => {
    const textarea = sourceTextareaRef.current;
    if (!textarea || !transform) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const selectedText = sourceValue.slice(start, end);
    const replacement = transform({ selectedText, value: sourceValue, start, end });
    if (typeof replacement !== 'string') return;

    const nextValue = `${sourceValue.slice(0, start)}${replacement}${sourceValue.slice(end)}`;
    const nextCursor = start + replacement.length;
    setSourceValue(nextValue);
    onEditRef.current?.(nextValue);

    requestAnimationFrame(() => {
      sourceTextareaRef.current?.focus();
      sourceTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [sourceValue]);

  const isEmpty = !value?.trim();
  const colorMode = displayedTheme === 'dark' ? 'dark' : 'light';

  return (
    <>
      <LangDropdownGlobalStyle />
      <TableControlsGlobalStyle />
      <MethodBadgeGlobalStyle />
      {editor && isEditing && <TableControls editor={editor} />}
      <StyledWrapper
        ref={containerRef}
        data-editing={isEditing}
        data-color-mode={colorMode}
      >
        <Toolbar
          editor={isSourceMode ? null : editor}
          isSourceMode={isSourceMode}
          mode={isSourceMode ? 'markdown' : 'rich'}
          onModeChange={handleModeChange}
          onApplyMarkdown={applyMarkdownTransform}
          isDisabled={!isEditing}
        />

        {/* Editing surface */}
        <div
          className="editor-area"
          style={{ height }}
          onClick={!isEditing ? enterEdit : undefined}
        >
          {/* Placeholder shown in view mode when empty */}
          {isEmpty && !isEditing && (
            <div className="editor-placeholder">
              {placeholder || 'Click to add documentation…'}
            </div>
          )}

          {/* Tiptap editor — hidden in source mode */}
          <div style={{ display: isSourceMode ? 'none' : undefined }}>
            <EditorContent editor={editor} className="editor-content" />
          </div>

          {/* Source mode textarea */}
          {isSourceMode && (
            <div className="source-editor-wrapper">
              <textarea
                ref={sourceTextareaRef}
                className="source-editor"
                value={sourceValue}
                onChange={handleSourceChange}
                autoFocus
              />
            </div>
          )}
        </div>

      </StyledWrapper>
    </>
  );
};

export default MarkdownEditor;
