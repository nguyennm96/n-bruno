import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * FindBar — Find & Replace bar for the MarkdownEditor.
 *
 * Props:
 *   editorRef        {Ref}   ref to the contenteditable div
 *   isOpen           {bool}  whether the bar is visible
 *   initialShowReplace {bool} open with replace section shown
 *   onClose          {fn}    called when user closes the bar
 *   onContentChange  {fn}    called after a replace operation (to serialize content)
 *
 * Imperative handle (ref):
 *   clearHighlights()  — removes all <mark> elements from the editor
 */
const FindBar = forwardRef(({
  editorRef,
  isOpen,
  initialShowReplace = false,
  onClose,
  onContentChange
}, ref) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [totalMatches, setTotalMatches] = useState(0);
  const searchInputRef = useRef(null);
  const marksRef = useRef([]);

  // ── Expose clearHighlights imperatively ──────────────────────────────────────
  const clearHighlights = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('mark.search-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    editorRef.current.normalize();
    marksRef.current = [];
    setTotalMatches(0);
    setCurrentIdx(-1);
  }, [editorRef]);

  useImperativeHandle(ref, () => ({ clearHighlights }), [clearHighlights]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => () => clearHighlights(), [clearHighlights]);

  // ── Focus + show/hide replace on open ───────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setShowReplace(initialShowReplace);
      requestAnimationFrame(() => {
        searchInputRef.current?.select();
        searchInputRef.current?.focus();
      });
    }
  }, [isOpen, initialShowReplace]);

  // ── Activate a specific match ────────────────────────────────────────────────
  const activateMark = useCallback((marks, idx) => {
    marks.forEach((m) => m.classList.remove('search-highlight-active'));
    if (marks[idx]) {
      marks[idx].classList.add('search-highlight-active');
      marks[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    setCurrentIdx(idx);
  }, []);

  // ── Apply highlights for a query ────────────────────────────────────────────
  const applyHighlights = useCallback((searchQuery, startIdx = 0) => {
    if (!editorRef.current) return;

    // Clear existing marks (unwrap them)
    editorRef.current.querySelectorAll('mark.search-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    editorRef.current.normalize();
    marksRef.current = [];

    if (!searchQuery) {
      setTotalMatches(0);
      setCurrentIdx(-1);
      return;
    }

    // TreeWalker: visit all text nodes, skip pre/code blocks
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentNode;
        while (p && p !== editorRef.current) {
          if (p.nodeName === 'PRE' || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const qLower = searchQuery.toLowerCase();
    const newMarks = [];

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      const textLower = text.toLowerCase();
      if (!textLower.includes(qLower)) return;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let idx = textLower.indexOf(qLower);

      while (idx !== -1) {
        if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = text.slice(idx, idx + searchQuery.length);
        frag.appendChild(mark);
        newMarks.push(mark);
        lastIdx = idx + searchQuery.length;
        idx = textLower.indexOf(qLower, lastIdx);
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));

      textNode.parentNode.replaceChild(frag, textNode);
    });

    marksRef.current = newMarks;
    setTotalMatches(newMarks.length);

    if (newMarks.length > 0) {
      activateMark(newMarks, Math.min(startIdx, newMarks.length - 1));
    } else {
      setCurrentIdx(-1);
    }
  }, [editorRef, activateMark]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!marksRef.current.length) return;
    activateMark(marksRef.current, (currentIdx + 1) % marksRef.current.length);
  }, [currentIdx, activateMark]);

  const goPrev = useCallback(() => {
    if (!marksRef.current.length) return;
    activateMark(marksRef.current, (currentIdx - 1 + marksRef.current.length) % marksRef.current.length);
  }, [currentIdx, activateMark]);

  // ── Input handlers ───────────────────────────────────────────────────────────
  const handleQueryChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    applyHighlights(val, 0);
  }, [applyHighlights]);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
    if (e.key === 'Escape') {
      clearHighlights();
      setQuery('');
      setReplaceQuery('');
      onClose?.();
    }
  }, [goNext, goPrev, clearHighlights, onClose]);

  // ── Replace ──────────────────────────────────────────────────────────────────
  const handleReplace = useCallback(() => {
    const marks = marksRef.current;
    if (!marks.length || currentIdx < 0) return;
    const mark = marks[currentIdx];
    if (!mark?.parentNode) return;

    const textNode = document.createTextNode(replaceQuery);
    mark.parentNode.replaceChild(textNode, mark);
    mark.parentNode.normalize();

    const newMarks = marks.filter((_, i) => i !== currentIdx);
    marksRef.current = newMarks;
    const nextTotal = newMarks.length;
    setTotalMatches(nextTotal);

    if (nextTotal > 0) {
      activateMark(newMarks, Math.min(currentIdx, nextTotal - 1));
    } else {
      setCurrentIdx(-1);
    }
    onContentChange?.();
  }, [currentIdx, replaceQuery, activateMark, onContentChange]);

  const handleReplaceAll = useCallback(() => {
    const marks = marksRef.current;
    if (!marks.length) return;
    marks.forEach((mark) => {
      if (!mark?.parentNode) return;
      mark.parentNode.replaceChild(document.createTextNode(replaceQuery), mark);
    });
    editorRef.current?.normalize();
    marksRef.current = [];
    setTotalMatches(0);
    setCurrentIdx(-1);
    onContentChange?.();
  }, [replaceQuery, editorRef, onContentChange]);

  const handleClose = useCallback(() => {
    clearHighlights();
    setQuery('');
    setReplaceQuery('');
    onClose?.();
  }, [clearHighlights, onClose]);

  if (!isOpen) return null;

  return (
    <div className="find-bar" onMouseDown={(e) => e.stopPropagation()}>
      {/* Search row */}
      <div className="find-bar-row">
        <div className="find-bar-input-wrap">
          <input
            ref={searchInputRef}
            className="find-bar-input"
            placeholder={t('MARKDOWN_EDITOR.FIND_BAR.FIND_PLACEHOLDER')}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            spellCheck={false}
          />
          {query && (
            <span className="find-bar-count">
              {totalMatches === 0 ? t('MARKDOWN_EDITOR.FIND_BAR.NO_RESULTS') : `${currentIdx + 1} / ${totalMatches}`}
            </span>
          )}
        </div>
        <button className="find-bar-icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={goPrev} title={t('MARKDOWN_EDITOR.FIND_BAR.PREVIOUS')} disabled={totalMatches === 0}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
        </button>
        <button className="find-bar-icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={goNext} title={t('MARKDOWN_EDITOR.FIND_BAR.NEXT')} disabled={totalMatches === 0}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <button
          className={`find-bar-icon-btn find-bar-toggle-replace${showReplace ? ' is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowReplace((v) => !v)}
          title={t('MARKDOWN_EDITOR.FIND_BAR.TOGGLE_REPLACE')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        <button className="find-bar-icon-btn find-bar-close-btn" onMouseDown={(e) => e.preventDefault()} onClick={handleClose} title={t('MARKDOWN_EDITOR.FIND_BAR.CLOSE')}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="find-bar-row find-bar-replace-row">
          <input
            className="find-bar-input"
            placeholder={t('MARKDOWN_EDITOR.FIND_BAR.REPLACE_PLACEHOLDER')}
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleReplace();
              }
              if (e.key === 'Escape') handleClose();
            }}
            spellCheck={false}
          />
          <button className="find-bar-action-btn" onClick={handleReplace} disabled={!totalMatches || currentIdx < 0}>
            {t('MARKDOWN_EDITOR.FIND_BAR.REPLACE')}
          </button>
          <button className="find-bar-action-btn" onClick={handleReplaceAll} disabled={!totalMatches}>
            {t('MARKDOWN_EDITOR.FIND_BAR.ALL')}
          </button>
        </div>
      )}
    </div>
  );
});

FindBar.displayName = 'FindBar';
export default FindBar;
