import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:not([data-editing='true']):hover {
    border-color: ${({ theme }) => theme.border.border1};
    cursor: text;
  }

  &[data-editing='true'] {
    border-color: ${({ theme }) => theme.border.border2};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.tabs.active.border}1a;
  }

  @keyframes toolbarFadeIn {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .md-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1px;
    padding: 4px 8px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 7px 7px 0 0;
    user-select: none;
    animation: toolbarFadeIn 0.1s ease;
    overflow: visible;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    border: none;
    cursor: pointer;
    height: 28px;
    padding: 0 7px;
    border-radius: 5px;
    color: ${({ theme }) => theme.requestTabs.color};
    opacity: 0.7;
    transition: opacity 0.1s, background 0.1s, color 0.1s;
    line-height: 1;
    white-space: nowrap;

    &:hover {
      opacity: 1;
      background-color: ${({ theme }) => theme.requestTabs.icon.hoverBg};
    }
    &:focus-visible {
      opacity: 1;
      outline: none;
      box-shadow: 0 0 0 2px ${({ theme }) => theme.tabs.active.border}33;
    }
    &.is-active {
      opacity: 1;
      color: ${({ theme }) => theme.tabs.active.color};
      background-color: ${({ theme }) => theme.tabs.active.border}22;
    }
  }

  .toolbar-label {
    font-size: 12px;
    font-weight: 700;
    font-family: serif;
    line-height: 1;
  }

  .toolbar-divider {
    width: 1px;
    height: 14px;
    background-color: ${({ theme }) => theme.border.border1};
    margin: 0 3px;
    opacity: 0.7;
    flex-shrink: 0;
    align-self: center;
  }

  .toolbar-dropdown { position: relative; }
  .toolbar-btn-dropdown { gap: 3px; padding-right: 5px; }

  .toolbar-dropdown-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    z-index: 1000;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 7px;
    padding: 4px;
    min-width: 148px;
    max-width: min(220px, calc(100vw - 24px));
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  }

  .toolbar-dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12.5px;
    padding: 6px 10px;
    border-radius: 5px;
    color: ${({ theme }) => theme.requestTabs.color};
    white-space: nowrap;
    &:hover {
      background-color: ${({ theme }) => theme.requestTabs.icon.hoverBg};
      color: ${({ theme }) => theme.text};
    }
    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px ${({ theme }) => theme.tabs.active.border};
    }
  }

  .toolbar-popover {
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    z-index: 1000;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 8px;
    padding: 14px;
    width: min(260px, calc(100vw - 24px));
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 10px;

    &.align-right {
      left: auto;
      right: 0;
    }
  }

  .popover-title {
    font-size: 12px;
    font-weight: 600;
    color: ${({ theme }) => theme.text};
    padding-bottom: 8px;
    border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    margin-bottom: -2px;
  }

  .popover-row { display: flex; flex-direction: column; gap: 4px; }

  .popover-label {
    font-size: 11px;
    color: ${({ theme }) => theme.text};
    opacity: 0.55;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .popover-input {
    background-color: ${({ theme }) => theme.requestTabPanel.url.bg};
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 5px;
    padding: 0 9px;
    height: 32px;
    font-size: 12.5px;
    color: ${({ theme }) => theme.text};
    outline: none;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.12s, box-shadow 0.12s;

    &:focus {
      border-color: ${({ theme }) => theme.tabs.active.border};
      box-shadow: 0 0 0 2px ${({ theme }) => theme.tabs.active.border}2a;
    }
    &::placeholder {
      opacity: 0.3;
      font-style: italic;
    }
  }

  .popover-actions {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }

  .popover-btn {
    flex: 1;
    height: 32px;
    border-radius: 5px;
    font-size: 12.5px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.1s, background 0.1s;
    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px ${({ theme }) => theme.tabs.active.border}33;
    }
  }

  .popover-cancel {
    background: transparent;
    border: 1px solid ${({ theme }) => theme.border.border2};
    color: ${({ theme }) => theme.text};
    opacity: 0.75;
    &:hover { opacity: 1; }
  }

  .popover-submit {
    background-color: ${({ theme }) => theme.tabs.active.border};
    border: none;
    color: #fff;
    &:hover { opacity: 0.88; }
  }

  .editor-area {
    position: relative;
    padding: 14px 16px;
    border-radius: 0 0 7px 7px;
  }

  .editor-placeholder {
    position: absolute;
    top: 14px;
    left: 16px;
    color: ${({ theme }) => theme.text};
    opacity: 0.38;
    font-size: 14px;
    pointer-events: none;
    user-select: none;
    line-height: 1.7;
  }

  .editor-content {
    outline: none;
    min-height: 40px;
    font-size: 14px;
    line-height: 1.7;
    color: ${({ theme }) => theme.text};
    caret-color: ${({ theme }) => theme.tabs.active.border};
    word-break: break-word;

    &.is-editing { cursor: text; }
    &:not(.is-editing) { cursor: pointer; }

    h1, h2, h3, h4, h5, h6 {
      color: ${({ theme }) => theme.text};
      border-bottom: 1px solid ${({ theme }) => theme.border.border1};
      padding-bottom: 6px;
      margin: 20px 0 8px;
      line-height: 1.3;
      font-weight: 600;
    }
    h1 { font-size: 1.7em; }
    h2 { font-size: 1.4em; }
    h3 { font-size: 1.2em; }

    p { margin: 6px 0; }
    p:first-child { margin-top: 0; }
    p:last-child { margin-bottom: 0; }

    code:not(pre > code) {
      background-color: ${({ theme }) => theme.border.border0};
      color: ${({ theme }) => theme.text};
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.88em;
      font-family: var(--font-code, 'JetBrains Mono', monospace);
    }

    pre {
      border-radius: 6px;
      padding: 14px 16px;
      overflow-x: auto;
      margin: 12px 0;
      code {
        background: none;
        padding: 0;
        font-family: var(--font-code, 'JetBrains Mono', monospace);
        font-size: 0.88em;
      }
    }

    blockquote {
      border-left: 3px solid ${({ theme }) => theme.tabs.active.border};
      margin: 12px 0;
      padding: 4px 16px;
      opacity: 0.85;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      th, td {
        border: 1px solid ${({ theme }) => theme.border.border1};
        padding: 7px 12px;
        text-align: left;
        vertical-align: top;
        min-width: 60px;
      }
      th {
        background-color: ${({ theme }) => theme.requestTabs.bg};
        font-weight: 600;
        font-size: 0.9em;
      }
    }

    a {
      color: ${({ theme }) => theme.textLink};
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    img { max-width: 100%; border-radius: 6px; }
    iframe { max-width: 100%; border-radius: 6px; }
    ul, ol { padding-left: 24px; }
    li { margin: 3px 0; }

    hr {
      border: none;
      border-top: 1px solid ${({ theme }) => theme.border.border1};
      margin: 16px 0;
    }

    ::selection { background-color: ${({ theme }) => theme.tabs.active.border}33; }
  }

  /* ── Dark mode: code blocks ── */
  &[data-color-mode='dark'] .editor-content pre {
    background-color: #1e1e2e;
    code { color: #cdd6f4; }

    .hljs-comment, .hljs-quote { color: #6c7086; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #cba6f7; }
    .hljs-name, .hljs-tag { color: #89b4fa; }
    .hljs-attribute { color: #89dceb; }
    .hljs-string, .hljs-doctag { color: #a6e3a1; }
    .hljs-variable, .hljs-literal, .hljs-number { color: #fab387; }
    .hljs-type, .hljs-class .hljs-title { color: #f9e2af; }
    .hljs-title, .hljs-section { color: #89b4fa; font-weight: bold; }
    .hljs-meta, .hljs-deletion { color: #f38ba8; }
    .hljs-addition { color: #a6e3a1; }
  }

  /* ── Light mode: code blocks ── */
  &[data-color-mode='light'] .editor-content pre {
    background-color: #f6f8fa;
    border: 1px solid #e1e4e8;
    code { color: #24292f; }

    .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #d73a49; }
    .hljs-name, .hljs-tag { color: #22863a; }
    .hljs-attribute { color: #005cc5; }
    .hljs-string, .hljs-doctag { color: #032f62; }
    .hljs-variable, .hljs-literal, .hljs-number { color: #005cc5; }
    .hljs-type, .hljs-class .hljs-title { color: #6f42c1; }
    .hljs-title, .hljs-section { color: #6f42c1; font-weight: bold; }
    .hljs-meta { color: #e36209; }
    .hljs-deletion { color: #b31d28; background-color: #ffeef0; }
    .hljs-addition { color: #22863a; background-color: #f0fff4; }
  }
`;

export default StyledWrapper;

// ── CodeBlockPanel global styles (portal renders to document.body) ──────────
import { createGlobalStyle } from 'styled-components';

export const CodeBlockPanelGlobalStyle = createGlobalStyle`
  .code-block-panel {
    position: fixed;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 34px;
    padding: 0 8px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 6px 6px 0 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
    font-size: 11.5px;
    color: ${({ theme }) => theme.requestTabs.color};
    pointer-events: all;
    user-select: none;
    animation: toolbarFadeIn 0.12s ease;
  }

  .cbp-lang-selector { position: relative; }

  .cbp-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: ${({ theme }) => theme.requestTabs.color};
    font-size: 11.5px;
    padding: 3px 8px;
    border-radius: 4px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    transition: background 0.1s, color 0.1s, border-color 0.1s, opacity 0.1s;
    &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; }
    &:focus-visible {
      outline: none;
      border-color: ${({ theme }) => theme.tabs.active.border};
      box-shadow: 0 0 0 2px ${({ theme }) => theme.tabs.active.border}2a;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }

  .cbp-lang-btn {
    font-weight: 500;
    gap: 2px;
    min-width: 90px;
    justify-content: space-between;
  }

  .cbp-lang-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 6px;
    padding: 4px;
    min-width: 150px;
    max-height: 280px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    z-index: 10000;
  }

  .cbp-lang-item {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 4px;
    color: ${({ theme }) => theme.requestTabs.color};
    white-space: nowrap;
    &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; }
    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px ${({ theme }) => theme.tabs.active.border};
    }
    &.active { color: ${({ theme }) => theme.tabs.active.color}; font-weight: 600; }
  }

  .cbp-spacer { flex: 1; }

  .cbp-hint {
    font-size: 10.5px;
    opacity: 0.35;
    padding-left: 4px;
    white-space: nowrap;
  }
 
`;
