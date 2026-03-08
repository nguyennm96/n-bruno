import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    color: ${(props) => props.theme.text.muted};
    margin: 0 0 10px 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    background: ${(props) => props.theme.workspace.border};
    color: ${(props) => props.theme.text.muted};

    &.pending {
      background: ${(props) => props.theme.status.warning.background};
      color: ${(props) => props.theme.status.warning.text};
    }
  }

  .invite-section {
    padding-bottom: 18px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
  }

  .invite-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .invite-fields {
    display: flex;
    gap: 6px;
  }

  .email-input {
    flex: 1;
    padding: 6px 10px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: 1px solid ${(props) => props.theme.workspace.border};
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    outline: none;
    transition: border-color ${(props) => props.theme.transition.fast};

    &:focus {
      border-color: ${(props) => props.theme.brand};
    }

    &::placeholder {
      color: ${(props) => props.theme.text.muted};
      opacity: 0.6;
    }
  }

  .role-select {
    padding: 6px 8px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: 1px solid ${(props) => props.theme.workspace.border};
    background: ${(props) => props.theme.background.surface1};
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.sm};
    outline: none;
    cursor: pointer;

    &:focus {
      border-color: ${(props) => props.theme.brand};
    }

    option {
      background: ${(props) => props.theme.background.surface1};
    }
  }

  .invite-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: none;
    background: ${(props) => props.theme.brand};
    color: white;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity ${(props) => props.theme.transition.fast};

    &:hover:not(:disabled) {
      opacity: 0.88;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .error-msg {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.status.danger.text};
  }

  .members-section,
  .invites-section {
    display: flex;
    flex-direction: column;
  }

  .state-msg {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text.muted};
    padding: 8px 0;
  }

  .members-list,
  .invites-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .member-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    transition: background ${(props) => props.theme.transition.fast};

    &:hover {
      background: ${(props) => props.theme.workspace.border}66;
    }
  }

  .member-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 700;
    flex-shrink: 0;
    color: white;
    letter-spacing: 0;
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .member-name {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 500;
    color: ${(props) => props.theme.text};
  }

  .you-badge {
    display: inline-flex;
    align-items: center;
    padding: 0 5px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 500;
    background: ${(props) => props.theme.brand}22;
    color: ${(props) => props.theme.brand};
  }

  .member-email {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.text.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-actions {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .role-select-inline {
    padding: 3px 6px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    border: 1px solid ${(props) => props.theme.workspace.border};
    background: transparent;
    color: ${(props) => props.theme.text};
    font-size: ${(props) => props.theme.font.size.xs};
    outline: none;
    cursor: pointer;

    option {
      background: ${(props) => props.theme.background.surface1};
    }
  }

  .role-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;
    letter-spacing: 0.03em;

    &.role-owner {
      background: ${(props) => props.theme.brand}22;
      color: ${(props) => props.theme.brand};
    }

    &.role-editor {
      background: ${(props) => props.theme.status.warning.background};
      color: ${(props) => props.theme.status.warning.text};
    }

    &.role-viewer {
      background: ${(props) => props.theme.workspace.border};
      color: ${(props) => props.theme.text.muted};
    }
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: ${(props) => props.theme.border.radius.sm};
    transition: background ${(props) => props.theme.transition.fast},
      color ${(props) => props.theme.transition.fast};
    opacity: 0;

    .member-row:hover & {
      opacity: 1;
    }

    &.danger {
      color: ${(props) => props.theme.text.muted};

      &:hover {
        color: ${(props) => props.theme.status.danger.text};
        background: ${(props) => props.theme.status.danger.background};
      }
    }

    &.cancel {
      color: ${(props) => props.theme.text.muted};

      &:hover {
        color: ${(props) => props.theme.status.danger.text};
        background: ${(props) => props.theme.status.danger.background};
      }
    }
  }

  .invite-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    transition: background ${(props) => props.theme.transition.fast};

    &:hover {
      background: ${(props) => props.theme.workspace.border}66;

      .icon-btn {
        opacity: 1;
      }
    }
  }

  .invite-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 700;
    flex-shrink: 0;
    background: ${(props) => props.theme.workspace.border};
    color: ${(props) => props.theme.text.muted};
    border: 1px dashed ${(props) => props.theme.workspace.border};
  }

  .invite-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .invite-email {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export default StyledWrapper;
