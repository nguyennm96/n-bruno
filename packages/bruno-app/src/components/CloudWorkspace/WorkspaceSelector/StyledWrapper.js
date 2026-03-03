import styled from 'styled-components';

const StyledWrapper = styled.div`
  .workspace-selector-content {
    min-height: 300px;
    display: flex;
    flex-direction: column;
  }

  .workspace-list {
    flex: 1;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 1.5rem;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: ${(props) => props.theme.sidebar.muted};
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;

    .empty-icon {
      color: ${(props) => props.theme.sidebar.muted};
      opacity: 0.3;
      margin-bottom: 1rem;
    }

    p {
      margin: 0.25rem 0;
      color: ${(props) => props.theme.text};
    }

    .hint {
      font-size: 0.875rem;
      color: ${(props) => props.theme.sidebar.muted};
    }
  }

  .workspace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem;
    margin-bottom: 0.5rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      border-color: ${(props) => props.theme.brand};
    }

    &.selected {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      border-color: ${(props) => props.theme.brand};
      border-width: 2px;
    }
  }

  .workspace-info {
    flex: 1;
  }

  .workspace-name {
    font-weight: 500;
    font-size: 0.9375rem;
    color: ${(props) => props.theme.text};
    margin-bottom: 0.25rem;
  }

  .workspace-desc {
    font-size: 0.8125rem;
    color: ${(props) => props.theme.sidebar.muted};
  }

  .workspace-role {
    font-size: 0.75rem;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    color: ${(props) => props.theme.sidebar.muted};
    font-weight: 600;
  }

  .create-form {
    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      font-size: 0.875rem;
      color: ${(props) => props.theme.text};
    }

    .form-input {
      width: 100%;
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      border: 1px solid ${(props) => props.theme.input.border};
      border-radius: 4px;
      background-color: ${(props) => props.theme.input.bg};
      color: ${(props) => props.theme.text};
      transition: border-color 0.15s ease-in-out;

      &:focus {
        outline: none;
        border-color: ${(props) => props.theme.input.focusBorder};
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      &::placeholder {
        color: ${(props) => props.theme.sidebar.muted};
        opacity: 0.6;
      }
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
    }
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid ${(props) => props.theme.input.border};
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease-in-out;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    svg {
      flex-shrink: 0;
    }
  }

  .btn-primary {
    background-color: ${(props) => props.theme.brand};
    color: #ffffff;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  }

  .btn-secondary {
    background: transparent;
    color: ${(props) => props.theme.text};
    border: 1px solid ${(props) => props.theme.input.border};

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }
`;

export default StyledWrapper;
