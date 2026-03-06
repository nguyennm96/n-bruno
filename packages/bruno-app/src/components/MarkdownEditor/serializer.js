/**
 * Serializer utilities for the custom WYSIWYG editor.
 * markdown → HTML  :  markdown-it
 * HTML → markdown  :  turndown + custom rules
 */

import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

// ── markdown → HTML ───────────────────────────────────────────────────────────
const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

export const markdownToHtml = (markdown) => {
  if (!markdown || !markdown.trim()) return '';
  return md.render(markdown);
};

// ── HTML → markdown ───────────────────────────────────────────────────────────
const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

// Strikethrough
td.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`
});

// Fenced code blocks — preserve language class
td.addRule('fencedCodeBlock', {
  filter: (node) =>
    node.nodeName === 'PRE'
    && node.firstChild
    && node.firstChild.nodeName === 'CODE',
  replacement: (_, node) => {
    const code = node.firstChild;
    const lang = (code.getAttribute('class') || '')
      .replace(/^language-/, '')
      .trim();
    return `\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n\n`;
  }
});

// Inline code — ensure backticks
td.addRule('inlineCode', {
  filter: (node) =>
    node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE',
  replacement: (content) => `\`${content}\``
});

export const htmlToMarkdown = (html) => {
  if (!html || html === '<br>' || html.trim() === '') return '';
  return td.turndown(html).trim();
};
