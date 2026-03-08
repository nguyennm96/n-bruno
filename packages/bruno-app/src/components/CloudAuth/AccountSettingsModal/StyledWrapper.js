import styled from 'styled-components';

const StyledWrapper = styled.div`
  .profile-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Avatar ── */
  .avatar-section {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .avatar-wrapper {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;

    &:hover .avatar-overlay {
      opacity: 1;
    }
  }

  .avatar-preview {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background-color: ${({ theme }) => theme.background?.surface1 || theme.sidebar?.bg || '#2d2d2d'};
    border: 2px solid ${({ theme }) => theme.border?.border1 || 'rgba(255,255,255,0.1)'};
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-letter {
      font-size: 1.75rem;
      font-weight: 600;
      color: ${({ theme }) => theme.text};
      text-transform: uppercase;
      line-height: 1;
    }
  }

  .avatar-overlay {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.transition?.base || '0.15s ease'};
    color: #fff;
  }

  .avatar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .avatar-hint {
    font-size: ${({ theme }) => theme.font?.size?.xs || '11px'};
    color: ${({ theme }) => theme.textSubtle || theme.text};
    opacity: 0.6;
    margin: 0;
  }

  .btn-remove-avatar {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: ${({ theme }) => theme.font?.size?.xs || '11px'};
    color: ${({ theme }) => theme.status?.danger?.text || '#e53e3e'};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity ${({ theme }) => theme.transition?.fast || '0.1s ease'};

    &:hover {
      opacity: 1;
    }
  }

  .avatar-error {
    font-size: ${({ theme }) => theme.font?.size?.xs || '11px'};
    color: ${({ theme }) => theme.status?.danger?.text || '#e53e3e'};
    margin: 0;
  }

  /* ── Form ── */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    font-size: ${({ theme }) => theme.font?.size?.sm || '12px'};
    font-weight: 500;
    color: ${({ theme }) => theme.text};
  }

  .form-input {
    padding: 0.5rem 0.75rem;
    font-size: ${({ theme }) => theme.font?.size?.base || '13px'};
    border: 1px solid ${({ theme }) => theme.input?.border || theme.border?.border1 || 'rgba(255,255,255,0.1)'};
    border-radius: ${({ theme }) => theme.border?.radius?.base || '6px'};
    background-color: ${({ theme }) => theme.input?.bg || theme.background?.surface1 || '#1e1e1e'};
    color: ${({ theme }) => theme.text};
    transition: border-color ${({ theme }) => theme.transition?.base || '0.15s ease'};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.brand || theme.input?.focusBorder || '#7c3aed'};
    }

    &.input-error {
      border-color: ${({ theme }) => theme.status?.danger?.border || '#e53e3e'};
    }

    &.read-only {
      cursor: default;
      opacity: 0.6;
      background-color: ${({ theme }) => theme.background?.surface2 || theme.background?.surface1 || '#1e1e1e'};

      &:focus {
        border-color: ${({ theme }) => theme.input?.border || theme.border?.border1 || 'rgba(255,255,255,0.1)'};
      }
    }
  }

  .field-error {
    font-size: ${({ theme }) => theme.font?.size?.xs || '11px'};
    color: ${({ theme }) => theme.status?.danger?.text || '#e53e3e'};
  }

  /* ── Footer ── */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid ${({ theme }) => theme.border?.border1 || 'rgba(255,255,255,0.08)'};
  }
`;

export default StyledWrapper;
