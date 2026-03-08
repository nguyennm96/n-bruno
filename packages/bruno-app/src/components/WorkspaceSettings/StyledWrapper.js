import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  .settings-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
  }

  .settings-modal {
    position: relative;
    z-index: 1;
    width: 700px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border-radius: ${(props) => props.theme.border.radius.md};
    background: ${(props) => props.theme.background.surface1};
    border: 1px solid ${(props) => props.theme.workspace.border};
    box-shadow: ${(props) => props.theme.shadow.lg};
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-bottom: 1px solid ${(props) => props.theme.workspace.border};
    flex-shrink: 0;
  }

  .header-icon {
    color: ${(props) => props.theme.text.muted};
    flex-shrink: 0;
  }

  .header-titles {
    flex: 1;
    min-width: 0;
  }

  .settings-title {
    font-size: ${(props) => props.theme.font.size.base};
    font-weight: 600;
    color: ${(props) => props.theme.text};
    margin: 0;
    line-height: 1.3;
  }

  .workspace-name {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.text.muted};
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: ${(props) => props.theme.font.size.lg};
    line-height: 1;
    color: ${(props) => props.theme.text.muted};
    border-radius: ${(props) => props.theme.border.radius.sm};
    transition: background ${(props) => props.theme.transition.fast},
      color ${(props) => props.theme.transition.fast};
    flex-shrink: 0;

    &:hover {
      color: ${(props) => props.theme.text};
      background: ${(props) => props.theme.workspace.border};
    }
  }

  .settings-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .settings-tabs {
    display: flex;
    flex-direction: column;
    width: 160px;
    flex-shrink: 0;
    padding: 10px 8px;
    gap: 2px;
    border-right: 1px solid ${(props) => props.theme.workspace.border};
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: ${(props) => props.theme.border.radius.sm};
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text.muted};
    text-align: left;
    transition: background ${(props) => props.theme.transition.fast},
      color ${(props) => props.theme.transition.fast};

    &:hover {
      background: ${(props) => props.theme.workspace.border};
      color: ${(props) => props.theme.text};
    }

    &.active {
      background: ${(props) => props.theme.workspace.border};
      color: ${(props) => props.theme.text};
      font-weight: 500;
    }

    &.danger {
      color: ${(props) => props.theme.status.danger.text}bb;

      &:hover,
      &.active {
        background: ${(props) => props.theme.status.danger.background};
        color: ${(props) => props.theme.status.danger.text};
      }
    }
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px;

    &::-webkit-scrollbar {
      width: 5px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${(props) => props.theme.workspace.border};
      border-radius: 999px;
    }
  }
`;

export default StyledWrapper;
