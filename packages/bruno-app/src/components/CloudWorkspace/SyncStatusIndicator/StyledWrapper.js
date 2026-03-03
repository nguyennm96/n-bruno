import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: center;

  .sync-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }

  .status-synced .icon-synced {
    color: ${(props) => props.theme.colors?.success || '#10b981'};
  }

  .status-syncing .icon-syncing {
    color: ${(props) => props.theme.colors?.info || '#3b82f6'};
    animation: spin 1s linear infinite;
  }

  .status-error .icon-error {
    color: ${(props) => props.theme.colors?.danger || '#ef4444'};
  }

  .status-offline .icon-offline {
    color: ${(props) => props.theme.sidebar.muted || '#9ca3af'};
    opacity: 0.6;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

export default StyledWrapper;
