import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid ${(props) => props.theme.modal.border || props.theme.input.border};
  background: ${(props) => props.theme.sidebar.bg || props.theme.modal.bg};

  .search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px;
    border-bottom: 1px solid ${(props) => props.theme.modal.border || props.theme.input.border};
    flex-shrink: 0;

    background: ${(props) => props.theme.modal.bg};
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .search-icon {
    color: ${(props) => props.theme.colors.text.muted};
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    min-width: 0;
    height: 28px;
    background: ${(props) => props.theme.requestTabPanel.url.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    outline: none;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    padding: 0 10px;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      box-shadow: 0 0 0 2px ${(props) => props.theme.input.focusBoxShadow};
    }

    &::placeholder {
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .language-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 6px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${(props) => props.theme.scrollbar?.thumb || 'rgba(128,128,128,0.3)'};
      border-radius: 2px;
    }
  }

  .category-group {
    margin-bottom: 8px;
  }

  .category-header {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${(props) => props.theme.colors.text.muted};
    padding: 4px 8px;
    user-select: none;
  }

  .lang-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 30px;
    padding: 0 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    transition: all 0.12s ease;
    margin-bottom: 3px;

    &:hover {
      background: ${(props) => props.theme.dropdown.hoverBg || props.theme.sidebar.collection.item.hoverBg};
      border-color: ${(props) => props.theme.input.border};
    }

    &.active {
      background: ${(props) => props.theme.requestTabPanel.url.bg};
      border-color: ${(props) => props.theme.input.focusBorder};
      color: ${(props) => props.theme.text};
      font-weight: 500;
    }
  }

  .lang-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .client-name {
    font-size: 10px;
    color: ${(props) => props.theme.colors.text.muted};
    white-space: nowrap;
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid ${(props) => props.theme.input.border};
    background: ${(props) => props.theme.requestTabPanel.url.bg};
  }

  .no-results {
    padding: 16px 10px;
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
    text-align: center;
  }
`;

export default StyledWrapper;
