import styled from 'styled-components';

const StyledWrapper = styled.div`
  .auth-form {
    /* ── Social login buttons ─────────────────────────────────── */
    .social-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 1.25rem;
    }

    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 0.6rem 1rem;
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      border-radius: ${({ theme }) => theme.border.radius.base};
      cursor: pointer;
      transition: background-color ${({ theme }) => theme.transition.fast},
                  border-color ${({ theme }) => theme.transition.fast};
      position: relative;

      svg {
        flex-shrink: 0;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:active:not(:disabled) {
        transform: scale(0.98);
        transition: transform ${({ theme }) => theme.transition.fast};
      }
    }

    .social-btn-google {
      background-color: ${({ theme }) => theme.sidebar.bg};
      border: 1px solid ${({ theme }) => theme.border.border1};
      color: ${({ theme }) => theme.text};

      &:hover:not(:disabled) {
        background-color: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
        border-color: ${({ theme }) => theme.border.border0};
      }
    }

    .social-btn-github {
      background-color: ${({ theme }) => theme.sidebar.bg};
      border: 1px solid ${({ theme }) => theme.border.border1};
      color: ${({ theme }) => theme.text};

      &:hover:not(:disabled) {
        background-color: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
        border-color: ${({ theme }) => theme.border.border0};
      }
    }

    .social-loading-indicator {
      position: absolute;
      right: 12px;
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── OR divider ───────────────────────────────────────────── */
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 1.1rem 0;
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors?.text?.muted || theme.sidebar?.muted};

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background-color: ${({ theme }) => theme.border.border1};
      }
    }

    /* ── Form fields ──────────────────────────────────────────── */
    .form-group {
      margin-bottom: 1rem;
    }

    .form-label {
      display: block;
      margin-bottom: 5px;
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      color: ${({ theme }) => theme.text};
    }

    .form-input {
      width: 100%;
      padding: 0.55rem 0.75rem;
      font-size: ${({ theme }) => theme.font.size.sm};
      border: 1px solid ${({ theme }) => theme.input.border};
      border-radius: ${({ theme }) => theme.border.radius.base};
      background-color: ${({ theme }) => theme.input.bg};
      color: ${({ theme }) => theme.text};
      transition: border-color ${({ theme }) => theme.transition.base};

      &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.input.focusBorder};
        box-shadow: 0 0 0 2px ${({ theme }) => theme.brand}22;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      &.input-error {
        border-color: ${({ theme }) => theme.colors?.status?.danger?.border || '#e53e3e'};
      }

      &::placeholder {
        color: ${({ theme }) => theme.input?.placeholder?.color || theme.sidebar?.muted};
        opacity: 0.6;
      }
    }

    .password-field {
      position: relative;

      .form-input {
        padding-right: 2.5rem;
      }

      .toggle-password {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: ${({ theme }) => theme.sidebar?.muted || theme.text};
        opacity: 0.6;
        padding: 2px;
        display: flex;
        align-items: center;

        &:hover { opacity: 1; }
      }
    }

    /* ── Error messages ───────────────────────────────────────── */
    .error-message {
      margin-top: 4px;
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors?.text?.danger || '#e53e3e'};
    }

    .auth-error {
      margin-bottom: 1rem;
      padding: 0.65rem 0.875rem;
      background-color: ${({ theme }) => (theme.colors?.bg?.danger || '#fee2e2') + '33'};
      border: 1px solid ${({ theme }) => theme.colors?.status?.danger?.border || '#fc8181'};
      border-radius: ${({ theme }) => theme.border.radius.base};
      color: ${({ theme }) => theme.colors?.text?.danger || '#e53e3e'};
      font-size: ${({ theme }) => theme.font.size.sm};
      text-align: center;
    }

    /* ── Submit button ────────────────────────────────────────── */
    .form-actions {
      margin-top: 1.25rem;
    }

    .btn {
      padding: 0.6rem 1.25rem;
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      border: none;
      border-radius: ${({ theme }) => theme.border.radius.base};
      cursor: pointer;
      transition: background-color ${({ theme }) => theme.transition.fast};

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      &:active:not(:disabled) {
        transform: scale(0.98);
      }
    }

    .btn-primary {
      background-color: ${({ theme }) => theme.brand};
      color: #ffffff;

      &:hover:not(:disabled) {
        opacity: 0.88;
      }
    }

    .btn-block {
      width: 100%;
    }

    /* ── Footer links ─────────────────────────────────────────── */
    .form-footer {
      margin-top: 1.1rem;
      text-align: center;
      font-size: ${({ theme }) => theme.font.size.sm};
      color: ${({ theme }) => theme.sidebar?.muted || theme.text};
    }

    .link-button {
      background: none;
      border: none;
      padding: 0;
      color: ${({ theme }) => theme.brand};
      cursor: pointer;
      font-size: inherit;
      font-weight: 500;

      &:hover:not(:disabled) {
        text-decoration: underline;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .forgot-password {
      margin-top: 0.75rem;
      text-align: right;

      .link-button {
        font-size: ${({ theme }) => theme.font.size.xs};
        color: ${({ theme }) => theme.sidebar?.muted || theme.text};
        font-weight: 400;
      }
    }

    .auth-info-text {
      font-size: ${({ theme }) => theme.font.size.sm};
      color: ${({ theme }) => theme.sidebar?.muted || theme.text};
      margin-bottom: 1rem;
      line-height: 1.6;
    }

    .otp-input {
      letter-spacing: 0.3em;
      font-size: ${({ theme }) => theme.font.size.lg};
      text-align: center;
    }
  }
`;

export default StyledWrapper;
