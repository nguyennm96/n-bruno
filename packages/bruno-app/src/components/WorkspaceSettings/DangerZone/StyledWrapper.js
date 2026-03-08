import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;

  .danger-card {
    border: 1px solid ${(props) => props.theme.workspace.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    overflow: hidden;
    transition: border-color ${(props) => props.theme.transition.fast};

    &.destructive {
      border-color: ${(props) => props.theme.status.danger.border}33;

      &:hover {
        border-color: ${(props) => props.theme.status.danger.border}66;
      }
    }
  }

  .danger-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
  }

  .danger-card-icon {
    width: 32px;
    height: 32px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;

    &.transfer {
      background: ${(props) => props.theme.brand}22;
      color: ${(props) => props.theme.brand};
    }

    &.leave {
      background: ${(props) => props.theme.status.warning.background};
      color: ${(props) => props.theme.status.warning.text};
    }

    &.delete {
      background: ${(props) => props.theme.status.danger.background};
      color: ${(props) => props.theme.status.danger.text};
    }
  }

  .danger-card-text {
    flex: 1;
    min-width: 0;
  }

  .danger-card-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
    margin: 0 0 3px 0;
  }

  .danger-card-desc {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.text.muted};
    margin: 0;
    line-height: 1.5;
  }

  .confirm-panel {
    padding: 12px 16px 14px;
    border-top: 1px solid ${(props) => props.theme.workspace.border};
    background: ${(props) => props.theme.background.surface1}88;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm-label {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.text.muted};
    margin: 0;

    strong {
      color: ${(props) => props.theme.text};
      font-weight: 600;
    }
  }

  .confirm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .member-select,
  .confirm-input {
    flex: 1;
    min-width: 0;
    padding: 5px 9px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: 1px solid ${(props) => props.theme.workspace.border};
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    outline: none;

    &:focus {
      border-color: ${(props) => props.theme.brand};
    }

    option {
      background: ${(props) => props.theme.background.surface1};
    }
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    border: 1px solid transparent;
    transition: background ${(props) => props.theme.transition.fast},
      color ${(props) => props.theme.transition.fast},
      border-color ${(props) => props.theme.transition.fast};

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.secondary {
      border-color: ${(props) => props.theme.workspace.border};
      background: none;
      color: ${(props) => props.theme.text.muted};
      margin-left: auto;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        background: ${(props) => props.theme.workspace.border};
        color: ${(props) => props.theme.text};
      }
    }

    &.warning {
      border-color: ${(props) => props.theme.status.warning.border}88;
      background: none;
      color: ${(props) => props.theme.status.warning.text};
      margin-left: auto;
      flex-shrink: 0;

      &:hover:not(:disabled) {
        background: ${(props) => props.theme.status.warning.background};
      }
    }

    &.danger {
      background: none;
      border-color: ${(props) => props.theme.status.danger.border}88;
      color: ${(props) => props.theme.status.danger.text};

      &:hover:not(:disabled) {
        background: ${(props) => props.theme.status.danger.background};
        border-color: ${(props) => props.theme.status.danger.border};
      }

      /* auto-push to right when used as the sole action in header */
      &:only-child {
        margin-left: auto;
        flex-shrink: 0;
      }
    }

    &.ghost {
      background: none;
      border-color: transparent;
      color: ${(props) => props.theme.text.muted};

      &:hover:not(:disabled) {
        background: ${(props) => props.theme.workspace.border};
        color: ${(props) => props.theme.text};
      }
    }
  }

  .empty-danger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 20px;
    color: ${(props) => props.theme.text.muted};
    font-size: ${(props) => props.theme.font.size.sm};
  }
`;

export default StyledWrapper;
