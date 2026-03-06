import { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from 'providers/Theme';
import { markdownToHtml, htmlToMarkdown } from './serializer';
import Toolbar from './Toolbar';
import CodeBlockPanel, { hljs, CAN_FORMAT, formatCodeByLanguage, getCodeLanguage, highlightCodeElement } from './CodeBlockPanel';
import StyledWrapper, { CodeBlockPanelGlobalStyle } from './StyledWrapper';

/**
 * Custom WYSIWYG editor — Postman-style click-to-edit.
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
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const onEditRef = useRef(onEdit);
  const onSaveRef = useRef(onSave);
  onEditRef.current = onEdit;
  onSaveRef.current = onSave;

  const [isEditing, setIsEditing] = useState(false);
  const [savedRange, setSavedRange] = useState(null);
  const [isEmpty, setIsEmpty] = useState(!value?.trim());
  const [activeCodeBlock, setActiveCodeBlock] = useState(null);

  // ── Load/sync content from outside ──────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || isEditing) return;
    const html = markdownToHtml(value);
    editorRef.current.innerHTML = html;
    setIsEmpty(!value?.trim());
  }, [value]);

  // ── Enter / exit edit mode ───────────────────────────────────────────────────
  const enterEdit = useCallback(() => {
    if (isEditing) return;
    setIsEditing(true);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    });
  }, [isEditing]);

  const exitEdit = useCallback(() => {
    if (!isEditing) return;
    setIsEditing(false);
    setActiveCodeBlock(null);
    if (editorRef.current) {
      const markdown = htmlToMarkdown(editorRef.current.innerHTML);
      onEditRef.current?.(markdown);
    }
  }, [isEditing]);

  // ── Click outside → exit ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      // Ignore clicks inside the code block panel (portal renders to document.body)
      if (e.target.closest?.('.code-block-panel')) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        exitEdit();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditing, exitEdit]);

  // ── Track selection so Toolbar can restore it + detect active code block ────
  const trackSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0).cloneRange());

      // Detect if cursor is inside a <pre> code block
      let node = sel.getRangeAt(0).startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      let pre = null;
      let cur = node;
      while (cur && cur !== editorRef.current) {
        if (cur.nodeName === 'PRE') {
          pre = cur; break;
        }
        cur = cur.parentNode;
      }
      setActiveCodeBlock(pre);
    }
  }, []);

  // ── Apply hljs syntax highlighting in preview mode ──────────────────────────
  useEffect(() => {
    if (isEditing || !editorRef.current) return;
    editorRef.current.querySelectorAll('pre code').forEach((block) => {
      // Reset any prior highlighting before re-highlighting
      block.removeAttribute('data-highlighted');
      hljs.highlightElement(block);
    });
  }, [isEditing, value]);

  // ── Input handler — emit markdown on each keystroke ──────────────────────────
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.textContent?.trim() || '';
    setIsEmpty(!text);
    const markdown = htmlToMarkdown(editorRef.current.innerHTML);
    onEditRef.current?.(markdown);
  }, []);

  const autoFormatCodeBlock = useCallback((preEl) => {
    if (!preEl) return;
    const codeEl = preEl.querySelector('code') || preEl;
    const lang = getCodeLanguage(codeEl);
    if (!CAN_FORMAT.has(lang)) return;
    try {
      const formatted = formatCodeByLanguage(codeEl.textContent || '', lang);
      codeEl.textContent = formatted;
      highlightCodeElement(codeEl);
      handleInput();
      requestAnimationFrame(() => {
        trackSelection();
      });
    } catch {
      // keep typing smooth when formatter can't parse intermediate code
    }
  }, [handleInput, trackSelection]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSaveRef.current?.();
      return;
    }
    if (e.key === 'Escape') {
      exitEdit();
      return;
    }

    // Cmd/Ctrl+A inside blockquote or pre → select only that block's content
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        let container = null;
        let cur = node;
        while (cur && cur !== editorRef.current) {
          if (cur.nodeName === 'BLOCKQUOTE' || cur.nodeName === 'PRE') {
            container = cur;
            break;
          }
          cur = cur.parentNode;
        }
        if (container) {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(container);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
      }
    }

    // Tab inside code block: insert indentation + auto format
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const startNode = sel.getRangeAt(0).startContainer;
      const el = startNode.nodeType === Node.TEXT_NODE ? startNode.parentNode : startNode;
      let pre = null;
      let cur = el;
      while (cur && cur !== editorRef.current) {
        if (cur.nodeName === 'PRE') {
          pre = cur; break;
        }
        cur = cur.parentNode;
      }
      if (pre) {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
        requestAnimationFrame(() => autoFormatCodeBlock(pre));
        return;
      }
    }

    // Handle Enter key
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const startNode = sel.getRangeAt(0).startContainer;
      const el = startNode.nodeType === Node.TEXT_NODE ? startNode.parentNode : startNode;

      // Find nearest special block ancestor (BLOCKQUOTE or PRE)
      let specialBlock = null;
      let cur = el;
      while (cur && cur !== editorRef.current) {
        if (cur.nodeName === 'BLOCKQUOTE' || cur.nodeName === 'PRE') {
          specialBlock = cur;
          break;
        }
        cur = cur.parentNode;
      }

      if (specialBlock) {
        // Cmd/Ctrl+Enter → exit the block, insert paragraph after
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          if (specialBlock.nextSibling) {
            specialBlock.parentNode.insertBefore(p, specialBlock.nextSibling);
          } else {
            specialBlock.parentNode.appendChild(p);
          }
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          handleInput();
          return;
        }
        // Enter or Shift+Enter → stay inside, add line break
        e.preventDefault();
        document.execCommand('insertLineBreak');
        handleInput();
        if (specialBlock.nodeName === 'PRE') {
          requestAnimationFrame(() => autoFormatCodeBlock(specialBlock));
        }
        return;
      }

      // Enter in a heading (not Shift+Enter) → next line is a paragraph
      if (!e.shiftKey) {
        let headingNode = el;
        while (headingNode && headingNode !== editorRef.current) {
          if (/^H[1-6]$/.test(headingNode.nodeName)) break;
          headingNode = headingNode.parentNode;
        }
        if (headingNode && /^H[1-6]$/.test(headingNode.nodeName)) {
          requestAnimationFrame(() => {
            document.execCommand('formatBlock', false, 'p');
            handleInput();
          });
        }
      }
    }
  }, [autoFormatCodeBlock, exitEdit, handleInput]);

  return (
    <StyledWrapper
      ref={containerRef}
      data-editing={isEditing}
      data-color-mode={displayedTheme === 'dark' ? 'dark' : 'light'}
    >
      <CodeBlockPanelGlobalStyle />
      {/* Toolbar — only visible while editing */}
      {isEditing && (
        <Toolbar
          editorRef={editorRef}
          savedRange={savedRange}
          onContentChange={handleInput}
        />
      )}

      {/* Code block panel — shown when cursor is in a <pre> */}
      {isEditing && activeCodeBlock && (
        <CodeBlockPanel
          preEl={activeCodeBlock}
          onUpdate={handleInput}
          onSelectionSync={trackSelection}
          colorMode={displayedTheme === 'dark' ? 'dark' : 'light'}
        />
      )}

      {/* Editing surface */}
      <div
        className="editor-area"
        style={{ minHeight: height }}
        onClick={!isEditing ? enterEdit : undefined}
      >
        {/* Placeholder — shown when empty and not editing */}
        {isEmpty && !isEditing && (
          <div className="editor-placeholder">
            {placeholder || 'Click to add documentation…'}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          className={`editor-content${isEditing ? ' is-editing' : ''}`}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={trackSelection}
          onKeyUp={trackSelection}
        />
      </div>
    </StyledWrapper>
  );
};

export default MarkdownEditor;
