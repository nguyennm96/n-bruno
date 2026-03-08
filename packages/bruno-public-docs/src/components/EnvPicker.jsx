import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const EnvPicker = ({ variables, extractedVars, onChange, onClose, theme }) => {
  const t = theme;
  const [local, setLocal] = useState({ ...variables });

  const allVars = [...new Set([...extractedVars, ...Object.keys(variables)])].sort();

  const handleChange = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onChange(local);
    onClose();
  };

  const handleClear = () => {
    const cleared = {};
    allVars.forEach((k) => { cleared[k] = ''; });
    setLocal(cleared);
  };

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  };

  const modalStyle = {
    background: t.bg.page,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.lg,
    width: '100%',
    maxWidth: '520px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  };

  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${t.border.default}`,
    background: t.bg.sidebar, flexShrink: 0,
  };

  const bodyStyle = {
    flex: 1, overflowY: 'auto', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  };

  const footerStyle = {
    display: 'flex', justifyContent: 'flex-end', gap: '8px',
    padding: '12px 20px', borderTop: `1px solid ${t.border.default}`,
    flexShrink: 0, background: t.bg.sidebar,
  };

  const inputRowStyle = {
    display: 'flex', flexDirection: 'column', gap: '4px',
  };

  const labelStyle = {
    fontSize: t.font.size.sm, fontWeight: 500, color: t.text.secondary,
    fontFamily: t.font.mono,
  };

  const inputStyle = {
    padding: '7px 10px',
    background: t.bg.input,
    border: `1px solid ${t.border.default}`,
    borderRadius: t.radius.base,
    color: t.text.primary,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  };

  const btnBase = {
    padding: '7px 16px', borderRadius: t.radius.base, border: 'none',
    fontWeight: 600, fontSize: t.font.size.sm, cursor: 'pointer',
  };

  return createPortal(
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: t.font.size.md, fontWeight: 700, color: t.text.primary }}>
              Environment Variables
            </div>
            <div style={{ fontSize: t.font.size.sm, color: t.text.muted, marginTop: '2px' }}>
              Set values for <code style={{ fontFamily: t.font.mono }}>{'{{'}</code>variables<code style={{ fontFamily: t.font.mono }}>{'}}'}</code> in this collection
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.text.muted, padding: '4px', display: 'flex' }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={bodyStyle}>
          {allVars.length === 0 ? (
            <div style={{ textAlign: 'center', color: t.text.muted, fontSize: t.font.size.sm, padding: '20px 0' }}>
              No <code style={{ fontFamily: t.font.mono }}>{'{{variables}}'}</code> found in this collection.
            </div>
          ) : (
            allVars.map((key) => (
              <div key={key} style={inputRowStyle}>
                <label style={labelStyle}>
                  {`{{${key}}}`}
                </label>
                <input
                  type="text"
                  value={local[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={`Value for ${key}`}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = t.text.brand || t.text.link; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
                />
              </div>
            ))
          )}
        </div>

        <div style={footerStyle}>
          <button
            style={{ ...btnBase, background: 'transparent', color: t.text.muted, border: `1px solid ${t.border.default}` }}
            onClick={handleClear}
          >
            Clear All
          </button>
          <button
            style={{ ...btnBase, background: t.text.brand || t.text.link, color: '#fff' }}
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default EnvPicker;
