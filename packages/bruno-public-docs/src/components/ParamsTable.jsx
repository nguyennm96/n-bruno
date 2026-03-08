import React from 'react';

const ParamsTable = ({ items, title, theme }) => {
  if (!items || items.length === 0) return null;

  const t = theme;

  const sectionStyle = {
    marginBottom: '24px',
  };

  const titleStyle = {
    fontSize: t.font.size.sm,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: t.text.muted,
    marginBottom: '10px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: t.font.size.base,
    border: `1px solid ${t.border.table}`,
    borderRadius: t.radius.base,
    overflow: 'hidden',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '8px 14px',
    background: t.bg.tableHeader,
    color: t.text.muted,
    fontWeight: 600,
    fontSize: t.font.size.xs,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${t.border.table}`,
  };

  const tdStyle = {
    padding: '9px 14px',
    borderBottom: `1px solid ${t.border.table}`,
    verticalAlign: 'top',
    color: t.text.primary,
  };

  const tdMonoStyle = {
    ...tdStyle,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    color: t.text.link,
  };

  const tdValueStyle = {
    ...tdStyle,
    fontFamily: t.font.mono,
    fontSize: t.font.size.sm,
    color: t.text.secondary,
  };

  const tdDescStyle = {
    ...tdStyle,
    fontSize: t.font.size.sm,
    color: t.text.secondary,
  };

  return (
    <div style={sectionStyle}>
      {title && <div style={titleStyle}>{title}</div>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? t.bg.tableRow : t.bg.tableRowAlt }}>
              <td style={tdMonoStyle}>{item.name}</td>
              <td style={tdValueStyle}>{item.value || <span style={{ color: t.text.muted, fontStyle: 'italic' }}>—</span>}</td>
              <td style={tdDescStyle}>{item.description || <span style={{ color: t.text.muted }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ParamsTable;
