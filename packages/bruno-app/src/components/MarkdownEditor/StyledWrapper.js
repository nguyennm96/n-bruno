import styled, { createGlobalStyle } from 'styled-components';

export const LangDropdownGlobalStyle = createGlobalStyle`
  .cbv-portal-dropdown {
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border-color: ${({ theme }) => theme.border.border2};
    color: ${({ theme }) => theme.requestTabs.color};
  }
  .cbv-portal-search {
    background: ${({ theme }) => theme.requestTabPanel.url.bg};
    border-color: ${({ theme }) => theme.border.border1};
    color: ${({ theme }) => theme.text};
    &:focus { border-color: ${({ theme }) => theme.tabs.active.border}; }
    &::placeholder { opacity: 0.4; font-style: italic; }
  }
  .cbv-portal-item {
    color: ${({ theme }) => theme.requestTabs.color};
    &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; }
    &.active { color: ${({ theme }) => theme.tabs.active.color}; background: ${({ theme }) => theme.tabs.active.border}22; }
  }
`;

export const TableControlsGlobalStyle = createGlobalStyle`
  /* ── Column/Row handle containers ── */
  .tc-col-handle,
  .tc-row-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  /* ── Handle button (⋮) ── */
  .tc-handle-btn {
    -webkit-appearance: none;
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0;
    padding: 0;
    cursor: pointer;
    color: ${({ theme }) => theme.text};
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0;
    opacity: 0;
    transition: opacity 0.15s, color 0.1s;
    pointer-events: auto;
    box-shadow: none !important;
    outline: none;

    &.tc-visible,
    &.tc-active { opacity: 1; }
    &:hover {
      color: ${({ theme }) => theme.tabs.active.color || theme.text};
    }
  }

  /* Keep showing handle buttons fully when their parent container is hovered */
  .tc-col-handle:hover .tc-handle-btn,
  .tc-row-handle:hover .tc-handle-btn { opacity: 1; }

  /* ── Dropdown menu ── */
  .tc-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 7px;
    padding: 4px;
    min-width: 160px;
    z-index: 9011;
    box-shadow: 0 6px 20px rgba(0,0,0,0.22);
    pointer-events: auto;
  }

  /* Row dropdown opens to the right instead of below */
  .tc-row-dropdown {
    top: 0;
    left: calc(100% + 4px);
    transform: none;
  }

  .tc-dd-item {
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
    pointer-events: auto;

    &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; }
  }

  .tc-dd-danger:hover {
    background: #e53e3e !important;
    color: #fff !important;
  }

  .tc-dd-sep {
    height: 1px;
    background: ${({ theme }) => theme.border.border1};
    margin: 3px 4px;
  }

  /* ── Add column / add row buttons ── */
  .tc-add-btn {
    background: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 5px;
    cursor: pointer;
    color: ${({ theme }) => theme.text};
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.75;
    transition: opacity 0.15s, background 0.1s;
    pointer-events: auto;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);

    &:hover { opacity: 1; background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; }
  }

  .tc-add-row-btn {
    font-size: 12px;
    gap: 4px;
    border-radius: 4px;
    opacity: 0.65;
  }
`;

/* ── Shared method badge — used by Documentation components ─────────────── */
export const MethodBadgeGlobalStyle = createGlobalStyle`
  .method-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-code, 'JetBrains Mono', monospace);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    min-width: 40px;
    padding: 3px 8px;
    border-radius: 4px;
    background-color: ${({ theme }) => theme.border.border0};
    flex-shrink: 0;
  }

  .method-get     { color: ${({ theme }) => theme.request.methods.get}; }
  .method-post    { color: ${({ theme }) => theme.request.methods.post}; }
  .method-put     { color: ${({ theme }) => theme.request.methods.put}; }
  .method-delete  { color: ${({ theme }) => theme.request.methods.delete}; }
  .method-patch   { color: ${({ theme }) => theme.request.methods.patch}; }
  .method-head    { color: ${({ theme }) => theme.request.methods.head}; }
  .method-options { color: ${({ theme }) => theme.request.methods.options}; }
  .method-grpc    { color: ${({ theme }) => theme.request.grpc}; }
  .method-ws      { color: ${({ theme }) => theme.request.ws}; }
  .method-graphql { color: ${({ theme }) => theme.request.gql}; }
`;

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
  min-width: 0;
  border-radius: 8px;

  &:not([data-editing='true']):hover {
    cursor: text;
  }

  @keyframes toolbarFadeIn {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .md-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 1px;
    padding: 3px 8px;
    background-color: ${({ theme }) => theme.requestTabs.bg}e8;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 7px 7px 0 0;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 10;
    overflow: visible;
    margin-bottom: 10px;

    &.is-readonly {
      visibility: hidden;
      pointer-events: none;
    }
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
    &:disabled {
      opacity: 0.28;
      cursor: default;
      pointer-events: none;
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

  /* ── Bubble menu ── */
  .bubble-menu {
    display: flex;
    align-items: center;
    gap: 2px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border2};
    border-radius: 7px;
    padding: 3px 5px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
    animation: toolbarFadeIn 0.1s ease;
  }

  .bubble-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    height: 26px;
    min-width: 26px;
    padding: 0 6px;
    border-radius: 4px;
    color: ${({ theme }) => theme.requestTabs.color};
    font-size: 12px;
    font-weight: 600;
    opacity: 0.75;
    transition: opacity 0.1s, background 0.1s;

    &:hover { opacity: 1; background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; }
    &.is-active { opacity: 1; color: ${({ theme }) => theme.tabs.active.color}; background: ${({ theme }) => theme.tabs.active.border}22; }
  }

  .bubble-btn-italic { font-style: italic; }
  .bubble-btn-strike { text-decoration: line-through; }
  .bubble-btn-code { font-family: var(--font-code, monospace); font-size: 11px; }

  .bubble-divider {
    width: 1px;
    height: 14px;
    background: ${({ theme }) => theme.border.border1};
    margin: 0 2px;
    opacity: 0.6;
    align-self: center;
  }

  .editor-area {
    position: relative;
    padding: 14px 16px;
    border-radius: 0 0 7px 7px;
  }

  .source-editor-wrapper {
    position: relative;
  }

  .source-editor {
    width: 100%;
    box-sizing: border-box;
    padding: 14px 16px;
    font-family: var(--font-code, 'JetBrains Mono', monospace);
    font-size: 13px;
    line-height: 1.7;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${({ theme }) => theme.text};
    caret-color: ${({ theme }) => theme.tabs.active.border};
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 200px;
  }

  .editor-status-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 3px 12px 4px;
    font-size: 11px;
    color: ${({ theme }) => theme.text};
    opacity: 0.38;
    border-top: 1px solid ${({ theme }) => theme.border.border1};
    user-select: none;
    border-radius: 0 0 7px 7px;
  }

  .editor-resize-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 10px;
    cursor: ns-resize;
    opacity: 0.3;
    transition: opacity 0.15s;
    border-radius: 0 0 7px 7px;

    &:hover { opacity: 0.7; }

    &::before {
      content: '';
      display: block;
      width: 32px;
      height: 3px;
      border-radius: 2px;
      background-color: ${({ theme }) => theme.border.border2};
    }
  }

  .toolbar-spacer {
    flex: 1;
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

  /* ── Tiptap ProseMirror editor content ── */
  .editor-content .ProseMirror,
  .ProseMirror {
    outline: none;
    min-height: 40px;
    min-width: 0;
    font-size: 14px;
    line-height: 1.7;
    color: ${({ theme }) => theme.text};
    caret-color: ${({ theme }) => theme.tabs.active.border};
    word-break: break-word;

    /* Tiptap placeholder */
    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: ${({ theme }) => theme.text};
      opacity: 0.38;
      pointer-events: none;
      height: 0;
    }

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

    blockquote {
      border-left: 3px solid ${({ theme }) => theme.tabs.active.border};
      margin: 12px 0;
      padding: 4px 16px;
      opacity: 0.85;
    }

    /* Tiptap wraps tables in .tableWrapper — allow horizontal scroll if table exceeds editor width */
    .tableWrapper {
      overflow-x: auto;
      margin: 12px 0;
      max-width: 100%;
    }

    table {
      border-collapse: collapse;
      margin: 0;
      th, td {
        border: 1px solid ${({ theme }) => theme.border.border1};
        padding: 7px 12px;
        text-align: left;
        vertical-align: top;
        min-width: 80px;  /* matches cellMinWidth plugin config */
        /* Prevent content from pushing cells wider than their allocated space */
        word-break: break-word;
        overflow-wrap: anywhere;
        /* No position:relative — avoids Chrome layout bug with border-collapse:collapse */
      }
      th {
        background-color: ${({ theme }) => theme.requestTabs.bg};
        font-weight: 600;
        font-size: 0.9em;
      }
      /* Cell selection highlight — inset box-shadow needs no position:relative */
      .selectedCell {
        box-shadow: inset 0 0 0 9999px ${({ theme }) => theme.tabs.active.border}22;
      }
      /* Resize handle — position:fixed takes it out of flow completely,
         so DOM insertion by columnResizing plugin causes zero table reflow */
      .column-resize-handle {
        position: fixed !important;
        width: 0 !important;
        height: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
      }
      /* The handle div is inserted before <p> content, breaking p:first-child.
         Reset margins inside cells to prevent the 6px jump. */
      td p, th p { margin: 0; }
      td p + p, th p + p { margin-top: 4px; }
    }

    &.resize-cursor { cursor: col-resize; }

    a {
      color: ${({ theme }) => theme.textLink};
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    img { max-width: 100%; border-radius: 6px; }
    ul, ol { padding-left: 24px; }
    li { margin: 3px 0; }
    hr {
      border: none;
      border-top: 1px solid ${({ theme }) => theme.border.border1};
      margin: 16px 0;
    }

    /* Task list */
    ul[data-type='taskList'] {
      padding-left: 4px;
      li[data-type='taskItem'] {
        display: flex;
        align-items: baseline;
        gap: 6px;
        list-style: none;
        margin: 3px 0;

        label {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          cursor: pointer;
          input[type='checkbox'] {
            accent-color: ${({ theme }) => theme.tabs.active.border};
            cursor: pointer;
          }
        }
        > div { flex: 1; }
      }
    }

    ::selection { background-color: ${({ theme }) => theme.tabs.active.border}33; }
  }

  /* ── Code block NodeView ── */
  .tiptap-code-block {
    margin: 12px 0;
    border-radius: 6px;
    border: 1px solid ${({ theme }) => theme.border.border1};
    /* No overflow:hidden — dropdown must escape the container */
    position: relative;

    pre {
      margin: 0;
      border-radius: 0 0 6px 6px;
      padding: 14px 16px;
      overflow-x: auto;
      overflow-y: auto;
      max-height: 480px;
      border: none;

      code {
        background: none;
        padding: 0;
        font-family: var(--font-code, 'JetBrains Mono', monospace);
        font-size: 0.88em;
        outline: none;
      }
    }

    .cbv-panel {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 8px;
      height: 32px;
      border-bottom: 1px solid ${({ theme }) => theme.border.border1};
      background-color: ${({ theme }) => theme.requestTabs.bg};
      border-radius: 6px 6px 0 0;
      user-select: none;
    }

    .cbv-spacer { flex: 1; }

    .cbv-lang-selector { position: relative; }

    .cbv-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      color: ${({ theme }) => theme.requestTabs.color};
      font-size: 11.5px;
      padding: 2px 7px;
      border-radius: 4px;
      height: 22px;
      white-space: nowrap;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
      opacity: 0.8;

      &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; opacity: 1; }
      &:disabled { cursor: not-allowed; opacity: 0.35; }
    }

    .cbv-lang-btn {
      font-weight: 500;
      gap: 3px;
      min-width: 80px;
      justify-content: space-between;
    }

    .cbv-lang-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 10000;
      background-color: ${({ theme }) => theme.requestTabs.bg};
      border: 1px solid ${({ theme }) => theme.border.border2};
      border-radius: 6px;
      padding: 4px;
      width: 180px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    }

    .cbv-lang-search {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 8px;
      margin-bottom: 4px;
      background: ${({ theme }) => theme.requestTabPanel.url.bg};
      border: 1px solid ${({ theme }) => theme.border.border1};
      border-radius: 4px;
      font-size: 12px;
      color: ${({ theme }) => theme.text};
      outline: none;
      &:focus { border-color: ${({ theme }) => theme.tabs.active.border}; }
      &::placeholder { opacity: 0.4; }
    }

    .cbv-lang-list {
      max-height: 220px;
      overflow-y: auto;
    }

    .cbv-lang-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      color: ${({ theme }) => theme.requestTabs.color};
      white-space: nowrap;
      &:hover { background: ${({ theme }) => theme.requestTabs.icon.hoverBg}; color: ${({ theme }) => theme.text}; }
      &.active { color: ${({ theme }) => theme.tabs.active.color}; font-weight: 600; }
    }
  }

  /* ── Dark mode: code blocks ── */
  &[data-color-mode='dark'] .tiptap-code-block pre {
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
  &[data-color-mode='light'] .tiptap-code-block pre {
    background-color: #f6f8fa;
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
