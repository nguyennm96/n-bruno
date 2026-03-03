import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  .auth-form {
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

      &.input-error {
        border-color: ${(props) => props.theme.status?.danger?.border || '#dc3545'};
      }

      &::placeholder {
        color: ${(props) => props.theme.input.placeholder?.color || props.theme.sidebar.muted};
        opacity: ${(props) => props.theme.input.placeholder?.opacity || 0.6};
      }
    }

    .error-message {
      margin-top: 0.375rem;
      font-size: 0.75rem;
      color: ${(props) => props.theme.status?.danger?.text || '#dc3545'};
    }

    .auth-error {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background-color: ${(props) => props.theme.status?.danger?.background || rgba('#dc3545', 0.15)};
      border: 1px solid ${(props) => props.theme.status?.danger?.border || '#dc3545'};
      border-radius: 4px;
      color: ${(props) => props.theme.status?.danger?.text || '#dc3545'};
      text-align: center;
    }

    .form-actions {
      margin-top: 1.5rem;
    }

    .btn {
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
    }

    .btn-primary {
      background-color: ${(props) => props.theme.brand};
      color: #ffffff;

      &:hover:not(:disabled) {
        background-color: ${(props) => rgba(props.theme.brand, 0.85)};
      }
    }

    .btn-block {
      width: 100%;
      display: block;
    }

    .form-footer {
      margin-top: 1.25rem;
      text-align: center;
      font-size: 0.875rem;
      color: ${(props) => props.theme.sidebar.muted};
    }

    .toggle-mode {
      display: inline-block;
    }

    .link-button {
      background: none;
      border: none;
      padding: 0;
      color: ${(props) => props.theme.brand};
      cursor: pointer;
      font-size: inherit;
      font-weight: 500;
      text-decoration: none;

      &:hover:not(:disabled) {
        text-decoration: underline;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .forgot-password {
      margin-top: 1rem;
      text-align: center;

      .link-button {
        font-size: 0.8125rem;
        color: ${(props) => props.theme.sidebar.muted};
      }
    }

    .text-sm {
      font-size: 0.8125rem;
    }
  }
`;

export default StyledWrapper;
