import styled from 'styled-components';

const Styled = styled.div`
  .public-url-section {
    input {
      background-color: var(--color-bg-input);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      font-family: monospace;
      font-size: 0.875rem;

      &:focus {
        outline: none;
        border-color: var(--color-accent);
      }
    }

    .btn-icon {
      padding: 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background-color: var(--color-bg);
      color: var(--color-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background-color: var(--color-bg-hover);
        border-color: var(--color-accent);
      }

      &:active {
        transform: scale(0.95);
      }
    }
  }

  .visibility-section {
    label.visibility-option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--color-accent);
        background-color: var(--color-bg-hover);
      }

      input[type='radio'] {
        margin-top: 2px;
        cursor: pointer;
      }

      .font-medium {
        font-weight: 500;
        color: var(--color-text);
      }

      .text-xs {
        font-size: 0.75rem;
      }

      .text-gray-500 {
        color: var(--color-text-muted);
      }
    }

    input[type='password'] {
      background-color: var(--color-bg-input);
      border: 1px solid var(--color-border);
      color: var(--color-text);

      &:focus {
        outline: none;
        border-color: var(--color-accent);
      }
    }
  }

  .settings-section {
    label.checkbox-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background-color: var(--color-bg-hover);
        border-radius: 4px;
      }

      input[type='checkbox'] {
        cursor: pointer;
        width: 16px;
        height: 16px;
      }

      span {
        color: var(--color-text);
        font-size: 0.875rem;
      }
    }
  }

  .preview-section {
    border-top: 1px solid var(--color-border);

    .btn-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
      width: 100%;

      &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      &:active {
        transform: translateY(0);
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }

    .text-gray-500 {
      color: var(--color-text-muted);
      opacity: 0.8;
    }
  }

  .unpublish-section {
    border-top: 1px solid var(--color-border);

    .btn-danger {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: var(--color-danger);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background-color: var(--color-danger-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }

  .space-y-2 > * + * {
    margin-top: 0.5rem;
  }

  .block {
    display: block;
  }

  .text-sm {
    font-size: 0.875rem;
  }

  .font-medium {
    font-weight: 500;
  }

  .mb-2 {
    margin-bottom: 0.5rem;
  }

  .mb-4 {
    margin-bottom: 1rem;
  }

  .mt-2 {
    margin-top: 0.5rem;
  }

  .mt-4 {
    margin-top: 1rem;
  }

  .pt-4 {
    padding-top: 1rem;
  }

  .ml-8 {
    margin-left: 2rem;
  }

  .border-t {
    border-top: 1px solid var(--color-border);
  }

  .analytics-section {
    .analytics-cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-top: 0.75rem;
    }

    .analytics-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background-color: var(--color-bg-hover);
      border: 1px solid var(--color-border);
      border-radius: 6px;

      &.full-width {
        grid-column: 1 / -1;
      }
    }

    .analytics-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background-color: var(--color-accent);
      color: white;
      border-radius: 6px;
      flex-shrink: 0;
    }

    .analytics-content {
      flex: 1;
    }

    .analytics-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-bottom: 0.25rem;
    }

    .analytics-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .analytics-value-sm {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .text-blue-600 {
      color: #3b82f6;
    }
  }

  .slug-section {
    .slug-input-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .slug-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background-color: var(--color-bg-input);
      color: var(--color-text);
      font-size: 0.875rem;
      font-family: monospace;

      &:focus {
        outline: none;
        border-color: var(--color-accent);
      }
    }

    .slug-status {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;

      &.checking {
        color: var(--color-text-muted);
      }

      &.available {
        color: #10b981;
      }

      &.taken {
        color: #ef4444;
      }
    }

    .text-gray-500 {
      color: var(--color-text-muted);
      opacity: 0.8;
    }
  }

  .branding-section {
    .upload-field {
      margin-bottom: 1rem;

      .file-input {
        display: none;
      }

      .btn-upload {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background-color: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
        transition: all 0.2s;

        &:hover {
          background-color: var(--color-bg-hover);
          border-color: var(--color-accent);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .logo-preview {
        width: 40px;
        height: 40px;
        object-fit: contain;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 4px;
      }

      .text-gray-600 {
        color: var(--color-text-muted);
      }

      .text-gray-500 {
        color: var(--color-text-muted);
        opacity: 0.8;
      }

      .text-green-600 {
        color: #10b981;
      }

      .text-red-600 {
        color: #ef4444;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .space-y-3 > * + * {
      margin-top: 0.75rem;
    }
  }
`;

export default Styled;
