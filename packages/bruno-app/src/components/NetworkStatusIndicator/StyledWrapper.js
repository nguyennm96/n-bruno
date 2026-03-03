import styled from 'styled-components';

const StyledWrapper = styled.div`
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: default;
    transition: background-color 0.2s;

    .status-icon {
      font-size: 0.875rem;
      line-height: 1;
    }

    .status-text {
      line-height: 1;
    }
  }

  .status-online {
    background-color: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .status-offline {
    background-color: ${(props) => props.theme.bg.secondary};
    color: ${(props) => props.theme.text.muted};
  }

  .status-syncing {
    background-color: rgba(59, 130, 246, 0.1);
    color: #2563eb;

    .status-icon {
      animation: spin 1s linear infinite;
    }
  }

  .pending-count {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(251, 191, 36, 0.1);
    color: #d97706;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: default;

    .count {
      font-weight: 600;
    }

    .label {
      font-weight: 400;
    }
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
