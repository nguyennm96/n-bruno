import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Generates the global CSS for markdown content based on the current theme.
 * Called once in DocsLayout and injected as a global <style> tag.
 */
export function buildMarkdownCss(t) {
  return `
    .md-content { color: ${t.text.primary}; font-family: ${t.font.sans}; font-size: ${t.font.size.md}; line-height: 1.7; }
    .md-content h1 { font-size: ${t.font.size['3xl']}; font-weight: 700; margin: 24px 0 12px; color: ${t.text.primary}; border-bottom: 1px solid ${t.border.default}; padding-bottom: 8px; }
    .md-content h2 { font-size: ${t.font.size['2xl']}; font-weight: 600; margin: 20px 0 10px; color: ${t.text.primary}; }
    .md-content h3 { font-size: ${t.font.size.xl}; font-weight: 600; margin: 16px 0 8px; color: ${t.text.primary}; }
    .md-content h4 { font-size: ${t.font.size.lg}; font-weight: 600; margin: 14px 0 6px; color: ${t.text.secondary}; }
    .md-content p { margin: 8px 0; }
    .md-content a { color: ${t.text.link}; text-decoration: none; }
    .md-content a:hover { text-decoration: underline; }
    .md-content code { background: ${t.bg.codeInline}; color: ${t.text.codeInline}; padding: 2px 6px; border-radius: ${t.radius.sm}; font-family: ${t.font.mono}; font-size: ${t.font.size.sm}; }
    .md-content pre { background: ${t.bg.code}; color: ${t.text.code}; padding: 16px; border-radius: ${t.radius.md}; overflow-x: auto; margin: 12px 0; }
    .md-content pre code { background: none; color: inherit; padding: 0; font-size: ${t.font.size.sm}; }
    .md-content blockquote { border-left: 3px solid ${t.border.focus}; margin: 12px 0; padding: 8px 14px; background: ${t.bg.hover}; border-radius: 0 ${t.radius.base} ${t.radius.base} 0; color: ${t.text.secondary}; }
    .md-content ul, .md-content ol { margin: 8px 0; padding-left: 24px; }
    .md-content li { margin: 4px 0; }
    .md-content table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: ${t.font.size.base}; }
    .md-content th { text-align: left; padding: 8px 12px; background: ${t.bg.tableHeader}; color: ${t.text.secondary}; font-weight: 600; border: 1px solid ${t.border.table}; font-size: ${t.font.size.sm}; text-transform: uppercase; letter-spacing: 0.4px; }
    .md-content td { padding: 8px 12px; border: 1px solid ${t.border.table}; vertical-align: top; }
    .md-content tr:nth-child(even) td { background: ${t.bg.tableRowAlt}; }
    .md-content hr { border: none; border-top: 1px solid ${t.border.default}; margin: 20px 0; }
    .md-content strong { font-weight: 600; color: ${t.text.primary}; }
    .md-content em { font-style: italic; }
  `;
}

const MarkdownContent = ({ content }) => {
  const html = useMemo(() => {
    if (!content) return '';
    return marked(content);
  }, [content]);

  if (!html) return null;

  return (
    <div
      className="md-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownContent;
