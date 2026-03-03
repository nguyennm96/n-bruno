import styled from 'styled-components';

const StyledWrapper = styled.div`
  .loading,
  .empty {
    padding: 1rem;
    text-align: center;
    color: ${(props) => props.theme.sidebar.muted};
    font-size: 0.875rem;
  }

  .members-list {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 4px;
    overflow: hidden;
  }

  .members-header {
    padding: 0.75rem 1rem;
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    font-weight: 600;
    font-size: 0.8125rem;
    color: ${(props) => props.theme.text};
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }

  .member-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: ${(props) => props.theme.brand};
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: ${(props) => props.theme.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-email {
    font-size: 0.75rem;
    color: ${(props) => props.theme.sidebar.muted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-role {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    font-size: 0.75rem;
    font-weight: 600;
    color: ${(props) => props.theme.sidebar.muted};
    flex-shrink: 0;

    .role-icon {
      flex-shrink: 0;

      &.owner {
        color: ${(props) => props.theme.colors?.warning || '#f59e0b'};
      }

      &.editor {
        color: ${(props) => props.theme.colors?.info || '#3b82f6'};
      }

      &.viewer {
        color: ${(props) => props.theme.sidebar.muted};
      }
    }
  }
`;

export default StyledWrapper;
