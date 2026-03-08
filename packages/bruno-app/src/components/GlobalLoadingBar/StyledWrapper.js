import styled from 'styled-components';

const StyledWrapper = styled.div`
  .global-loading-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10000; /* Above everything */
    height: 3px;
    background: transparent;
    pointer-events: none;

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      transition: width 0.3s ease-out;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);

      &.indeterminate {
        animation: indeterminate 1.5s infinite;
        background: linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, transparent);
      }
    }

    .loading-message {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${(props) => props.theme.bg};
      border: 1px solid ${(props) => props.theme.border?.border1};
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      font-size: ${(props) => props.theme.font.size.base};
      color: ${(props) => props.theme.text};

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid ${(props) => props.theme.border?.border1};
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .message-text {
        font-weight: 500;
      }

      .operations-count {
        opacity: 0.6;
        font-size: ${(props) => props.theme.font.size.sm};
        margin-left: 4px;
      }
    }
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export default StyledWrapper;
