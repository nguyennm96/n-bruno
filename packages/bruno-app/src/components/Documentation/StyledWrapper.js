import styled from 'styled-components';

const StyledWrapper = styled.div`
  padding: 8px 4px;

  /* ── Request Header ─────────────────────────────────────────────────── */
  .doc-request-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 6px;
    margin-bottom: 16px;
    font-family: var(--font-code, 'JetBrains Mono', monospace);
  }

  .doc-method {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    min-width: 40px;
    text-align: center;
    padding: 3px 8px;
    border-radius: 4px;
    background-color: ${({ theme }) => theme.border.border0};
  }

  .method-get    { color: ${({ theme }) => theme.request.methods.get}; }
  .method-post   { color: ${({ theme }) => theme.request.methods.post}; }
  .method-put    { color: ${({ theme }) => theme.request.methods.put}; }
  .method-delete { color: ${({ theme }) => theme.request.methods.delete}; }
  .method-patch  { color: ${({ theme }) => theme.request.methods.patch}; }
  .method-head   { color: ${({ theme }) => theme.request.methods.head}; }
  .method-options{ color: ${({ theme }) => theme.request.methods.options}; }
  .method-grpc   { color: ${({ theme }) => theme.request.grpc}; }
  .method-ws     { color: ${({ theme }) => theme.request.ws}; }
  .method-graphql{ color: ${({ theme }) => theme.request.gql}; }

  .doc-url {
    font-size: 13px;
    color: ${({ theme }) => theme.text};
    word-break: break-all;
  }

  .doc-url-empty {
    opacity: 0.4;
    font-style: italic;
  }

  /* ── Editor Section ─────────────────────────────────────────────────── */
  .doc-editor-section {
    margin-bottom: 20px;
  }

  /* ── Params/Headers Tables ──────────────────────────────────────────── */
  .doc-section {
    margin-top: 20px;
  }

  .doc-section-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.text};
    opacity: 0.5;
    margin-bottom: 8px;
  }

  .doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 6px;
    overflow: hidden;

    th {
      background-color: ${({ theme }) => theme.requestTabs.bg};
      color: ${({ theme }) => theme.text};
      opacity: 0.7;
      font-weight: 600;
      text-align: left;
      padding: 7px 12px;
      border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid ${({ theme }) => theme.border.border0};
      color: ${({ theme }) => theme.text};
      vertical-align: top;

      &:last-child { border-bottom: none; }
    }

    tr:last-child td { border-bottom: none; }

    tr.disabled-row {
      opacity: 0.4;
    }

    code {
      font-family: var(--font-code, 'JetBrains Mono', monospace);
      font-size: 11px;
      background-color: ${({ theme }) => theme.border.border0};
      padding: 2px 5px;
      border-radius: 3px;
    }

    .doc-value {
      font-family: var(--font-code, 'JetBrains Mono', monospace);
      font-size: 11px;
      word-break: break-all;
    }

    .doc-desc {
      opacity: 0.65;
      font-style: italic;
    }
  }
`;

export default StyledWrapper;
