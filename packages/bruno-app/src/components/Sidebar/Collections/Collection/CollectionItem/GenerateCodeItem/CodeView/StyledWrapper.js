import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  .code-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid ${(props) => props.theme.modal.border || props.theme.input.border};
    flex-shrink: 0;
    min-height: 46px;
    background: ${(props) => props.theme.modal.bg};
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .toolbar-select {
    height: 30px;
    min-width: 180px;
    max-width: 280px;
    padding: 0 10px;
    background: ${(props) => props.theme.requestTabPanel.url.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    outline: none;
    cursor: pointer;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      box-shadow: 0 0 0 2px ${(props) => props.theme.input.focusBoxShadow};
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .interpolate-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.colors.text.muted};
    user-select: none;
    white-space: nowrap;

    input[type='checkbox'] {
      cursor: pointer;
      margin: 0;
    }

    &:hover {
      color: ${(props) => props.theme.text};
    }
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 12px;
    background: ${(props) => props.theme.button.secondary.bg};
    border: 1px solid ${(props) => props.theme.button.secondary.border};
    border-radius: 6px;
    color: ${(props) => props.theme.button.secondary.color};
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;

    &:hover {
      opacity: 0.92;
    }
  }

  .editor-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;

    /* Override CodeEditor defaults for snippet display */
    div.CodeMirror {
      height: 100% !important;
      border: none !important;
      background: ${(props) => props.theme.codemirror.bg} !important;
      font-size: ${({ theme }) => theme.font.size.base} !important;
      line-height: 1.7 !important;
    }

    /* Gutter: subtle, no background mismatch */
    .CodeMirror-gutters {
      background: ${(props) => props.theme.codemirror.bg} !important;
      border-right: 1px solid ${(props) => props.theme.input.border} !important;
    }

    /* Hide fold gutter — not needed for snippet view */
    .CodeMirror-foldgutter {
      display: none !important;
      width: 0 !important;
    }

    .CodeMirror-linenumber {
      color: ${(props) => props.theme.colors.text.muted} !important;
      font-size: ${({ theme }) => theme.font.size.xs} !important;
      padding: 0 10px 0 8px !important;
      opacity: 0.6;
    }

    .CodeMirror-lines {
      padding: 8px 0 !important;
    }

    .CodeMirror-line {
      padding: 0 16px !important;
    }

    /* Scrollbar */
    .CodeMirror-overlayscroll-vertical div,
    .CodeMirror-overlayscroll-horizontal div {
      background: ${(props) => props.theme.scrollbar?.thumb || 'rgba(128,128,128,0.3)'} !important;
      border-radius: 3px;
    }
  }
`;

export default StyledWrapper;
