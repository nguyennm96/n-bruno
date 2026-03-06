import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Inline table controls rendered as a portal.
 * Arrow trigger only shows when hovering a cell (not while typing).
 * Menu stays open even after mouse leaves, until dismissed.
 */
const TableControls = ({ editor }) => {
  const [info, setInfoState] = useState(null);
  const [activeCell, setActiveCellState] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const infoRef = useRef(null);
  const activeCellRef = useRef(null);
  const hideTimer = useRef(null);
  const rafRef = useRef(null);

  const setInfo = useCallback((v) => {
    const val = typeof v === 'function' ? v(infoRef.current) : v;
    infoRef.current = val;
    setInfoState(val);
  }, []);

  const setActiveCell = useCallback((v) => {
    const val = typeof v === 'function' ? v(activeCellRef.current) : v;
    activeCellRef.current = val;
    setActiveCellState(val);
  }, []);

  const extractInfo = useCallback((tableEl) => {
    const tableRect = tableEl.getBoundingClientRect();
    return { tableEl, tableRect };
  }, []);

  const extractCellInfo = useCallback((cell, tableEl) => {
    const row = cell.closest('tr');
    if (!row) return null;
    const rows = Array.from(tableEl.querySelectorAll('tr'));
    const rowIdx = rows.indexOf(row);
    if (rowIdx < 0) return null;
    const cells = Array.from(row.querySelectorAll('th, td'));
    const colIdx = cells.indexOf(cell);
    if (colIdx < 0) return null;
    return { rowIdx, colIdx, rect: cell.getBoundingClientRect() };
  }, []);

  const getCellByIndex = useCallback((tableEl, rowIdx, colIdx) => {
    const rows = tableEl.querySelectorAll('tr');
    const row = rows[Math.min(rowIdx, rows.length - 1)];
    if (!row) return null;
    const cells = row.querySelectorAll('td, th');
    return cells[Math.min(colIdx, cells.length - 1)] || null;
  }, []);

  const syncActiveCellRect = useCallback((tableEl) => {
    const current = activeCellRef.current;
    if (!current) return;
    const cell = getCellByIndex(tableEl, current.rowIdx, current.colIdx);
    if (!cell) {
      setActiveCell(null);
      return;
    }
    setActiveCell((prev) => ({
      ...prev,
      rect: cell.getBoundingClientRect()
    }));
  }, [getCellByIndex, setActiveCell]);

  const scheduleReposition = useCallback((tableEl) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      clearTimeout(hideTimer.current);
      setInfo(extractInfo(tableEl));
      syncActiveCellRect(tableEl);
    });
  }, [extractInfo, setInfo, syncActiveCellRect]);

  const scheduleHide = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!editor?.isActive('table')) {
        setInfo(null);
        setActiveCell(null);
        setIsMenuOpen(false);
        setIsHovering(false);
      }
    }, 250);
  }, [editor, setInfo, setActiveCell]);

  const getTableFromSelection = useCallback(() => {
    const { from } = editor.state.selection;
    let { node: dom } = editor.view.domAtPos(from);
    while (dom && dom.tagName !== 'TABLE') dom = dom.parentElement;
    return dom || null;
  }, [editor]);

  const getCellFromSelection = useCallback(() => {
    const { from } = editor.state.selection;
    let { node: dom } = editor.view.domAtPos(from);
    while (dom && dom.tagName !== 'TD' && dom.tagName !== 'TH') dom = dom.parentElement;
    return dom || null;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    let lastDoc = editor.state.doc;

    const onDocUpdate = () => {
      if (editor.state.doc === lastDoc) return;
      lastDoc = editor.state.doc;

      if (infoRef.current?.tableEl && editor.view.dom.contains(infoRef.current.tableEl)) {
        scheduleReposition(infoRef.current.tableEl);
        return;
      }

      if (!editor.isActive('table')) return;
      const tableEl = getTableFromSelection();
      if (tableEl) scheduleReposition(tableEl);
    };

    const onSelectionUpdate = () => {
      if (!editor.isActive('table')) {
        scheduleHide();
        return;
      }

      clearTimeout(hideTimer.current);
      cancelAnimationFrame(rafRef.current);
      const tableEl = getTableFromSelection();
      if (!tableEl) return;

      scheduleReposition(tableEl);
      // Keep activeCell in sync for menu positioning, but don't show the trigger
      // (isHovering stays false while typing — trigger only shown on mouse hover)
      const cell = getCellFromSelection();
      if (!cell) return;
      const next = extractCellInfo(cell, tableEl);
      if (next) setActiveCell(next);
    };

    const onReposition = () => {
      if (infoRef.current?.tableEl) scheduleReposition(infoRef.current.tableEl);
    };

    const editorDom = editor.view.dom;

    const onMouseOver = (e) => {
      const tableEl = e.target.closest?.('table');
      if (!tableEl) return;
      clearTimeout(hideTimer.current);
      cancelAnimationFrame(rafRef.current);
      if (infoRef.current?.tableEl !== tableEl) scheduleReposition(tableEl);

      const cell = e.target.closest?.('td, th');
      if (!cell) return;
      const next = extractCellInfo(cell, tableEl);
      if (next) {
        setActiveCell(next);
        setIsHovering(true);
      }
    };

    const onMouseOut = (e) => {
      const tableEl = e.target.closest?.('table');
      if (tableEl && !tableEl.contains(e.relatedTarget)) {
        setIsHovering(false);
        scheduleHide();
      } else if (!e.relatedTarget?.closest?.('td, th')) {
        // Moved between cells — wait for next mouseover to re-set
        setIsHovering(false);
      }
    };

    editor.on('update', onDocUpdate);
    editor.on('selectionUpdate', onSelectionUpdate);
    editorDom.addEventListener('mouseover', onMouseOver);
    editorDom.addEventListener('mouseout', onMouseOut);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);

    return () => {
      editor.off('update', onDocUpdate);
      editor.off('selectionUpdate', onSelectionUpdate);
      editorDom.removeEventListener('mouseover', onMouseOver);
      editorDom.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
      clearTimeout(hideTimer.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, extractCellInfo, getCellFromSelection, getTableFromSelection, scheduleHide, scheduleReposition, setActiveCell]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const close = (e) => {
      if (!e.target.closest('.tc-portal')) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isMenuOpen]);

  if (!info || !activeCell) return null;

  const BTN = 20;
  const GAP = 4;
  const top = activeCell.rect.top + 2;
  const left = activeCell.rect.right - BTN - 2;

  const cellPos = () => {
    const tableEl = infoRef.current?.tableEl;
    if (!tableEl) return null;
    const cell = getCellByIndex(tableEl, activeCell.rowIdx, activeCell.colIdx);
    if (!cell) return null;
    return editor.view.posAtDOM(cell, 0) + 1;
  };

  const runOnActiveCell = (cmd) => {
    const pos = cellPos();
    if (pos === null) return;
    const didRun = editor.chain().setTextSelection(pos).focus()[cmd]().run();
    if (!didRun) return;
    setIsMenuOpen(false);
    const tableEl = infoRef.current?.tableEl;
    if (tableEl) requestAnimationFrame(() => scheduleReposition(tableEl));
  };

  return createPortal(
    <div
      className="tc-portal"
      onMouseEnter={() => {
        clearTimeout(hideTimer.current);
        cancelAnimationFrame(rafRef.current);
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        if (!isMenuOpen) setIsHovering(false);
        scheduleHide();
      }}
    >
      {/* Only render trigger when hovering or menu is open */}
      {(isHovering || isMenuOpen) && (
        <div
          className="tc-portal tc-inline-handle"
          style={{ position: 'fixed', top, left, width: BTN, height: BTN, zIndex: 9010 }}
        >
          <button
            className={`tc-portal tc-handle-btn tc-visible${isMenuOpen ? ' tc-active' : ''}`}
            title="Table actions"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsMenuOpen((prev) => !prev);
            }}
          >
            ▾
          </button>

          {isMenuOpen && (
            <div className="tc-portal tc-dropdown tc-inline-dropdown" style={{ top: BTN + GAP, right: 0, left: 'auto', transform: 'none' }}>
              <button
                className="tc-portal tc-dd-item"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('addColumnBefore');
                }}
              >← Insert left
              </button>
              <button
                className="tc-portal tc-dd-item"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('addColumnAfter');
                }}
              >Insert right →
              </button>
              <button
                className="tc-portal tc-dd-item"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('addRowBefore');
                }}
              >↑ Insert above
              </button>
              <button
                className="tc-portal tc-dd-item"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('addRowAfter');
                }}
              >↓ Insert below
              </button>
              <div className="tc-portal tc-dd-sep" />
              <button
                className="tc-portal tc-dd-item tc-dd-danger"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('deleteColumn');
                }}
              >✕ Delete column
              </button>
              <button
                className="tc-portal tc-dd-item tc-dd-danger"
                onMouseDown={(e) => {
                  e.preventDefault(); runOnActiveCell('deleteRow');
                }}
              >✕ Delete row
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default TableControls;
