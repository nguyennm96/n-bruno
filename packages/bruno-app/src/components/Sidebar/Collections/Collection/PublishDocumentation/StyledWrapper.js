import styled from 'styled-components';

const Styled = styled.div`
  /* ── Tab Navigation ─────────────────────────────────────── */
  .tab-bar {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid ${({ theme }) => theme.border.border1};
    margin-bottom: 16px;
  }

  .tab-btn {
    padding: 6px 14px;
    font-size: ${({ theme }) => theme.font.size.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text.muted};
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color ${({ theme }) => theme.transition.fast},
                border-color ${({ theme }) => theme.transition.fast};
    margin-bottom: -1px;

    &:hover {
      color: ${({ theme }) => theme.text};
    }

    &.active {
      color: ${({ theme }) => theme.brand};
      border-bottom-color: ${({ theme }) => theme.brand};
    }
  }

  /* ── Published Info Bar ──────────────────────────────────── */
  .published-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: ${({ theme }) => theme.border.radius.base};
    margin-bottom: 14px;

    .published-dot {
      width: 8px;
      height: 8px;
      background: ${({ theme }) => theme.colors.text.green};
      border-radius: 999px;
      flex-shrink: 0;
    }

    .published-label {
      font-size: ${({ theme }) => theme.font.size.xs};
      font-weight: 600;
      color: ${({ theme }) => theme.colors.text.green};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .published-date {
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      margin-left: auto;
    }
  }

  /* ── Public URL Section ───────────────────────────────────── */
  .public-url-section {
    input {
      background: ${({ theme }) => theme.input.bg};
      border: 1px solid ${({ theme }) => theme.input.border};
      color: ${({ theme }) => theme.text};
      font-family: monospace;
      font-size: ${({ theme }) => theme.font.size.sm};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      padding: 6px 10px;
      width: 100%;

      &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.input.focusBorder};
      }
    }

    .btn-icon {
      padding: 6px;
      border: 1px solid ${({ theme }) => theme.border.border1};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      background: ${({ theme }) => theme.sidebar.bg};
      color: ${({ theme }) => theme.sidebar.muted};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color ${({ theme }) => theme.transition.fast};
      flex-shrink: 0;

      &:hover {
        background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
        color: ${({ theme }) => theme.text};
      }

      &:active {
        transform: scale(0.97);
      }
    }
  }

  /* ── Slug Display (read-only after publish) ──────────────── */
  .slug-display {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;

    .slug-label {
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      flex-shrink: 0;
    }

    .slug-value {
      font-size: ${({ theme }) => theme.font.size.xs};
      font-family: monospace;
      color: ${({ theme }) => theme.text};
      background: ${({ theme }) => theme.sidebar.collection.item.bg};
      border: 1px solid ${({ theme }) => theme.border.border0};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      padding: 2px 6px;
    }
  }

  /* ── Visibility Section ───────────────────────────────────── */
  .visibility-section {
    label.visibility-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      border: 1px solid ${({ theme }) => theme.border.border1};
      border-radius: ${({ theme }) => theme.border.radius.base};
      cursor: pointer;
      transition: border-color ${({ theme }) => theme.transition.fast},
                  background-color ${({ theme }) => theme.transition.fast};

      &:hover {
        border-color: ${({ theme }) => theme.brand};
        background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
      }

      &.selected {
        border-color: ${({ theme }) => theme.brand};
      }

      input[type='radio'] {
        margin-top: 2px;
        cursor: pointer;
        accent-color: ${({ theme }) => theme.brand};
      }

      .option-name {
        font-size: ${({ theme }) => theme.font.size.sm};
        font-weight: 500;
        color: ${({ theme }) => theme.text};
      }

      .option-desc {
        font-size: ${({ theme }) => theme.font.size.xs};
        color: ${({ theme }) => theme.colors.text.muted};
        margin-top: 1px;
      }
    }

    input[type='password'] {
      background: ${({ theme }) => theme.input.bg};
      border: 1px solid ${({ theme }) => theme.input.border};
      color: ${({ theme }) => theme.text};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      padding: 6px 10px;
      font-size: ${({ theme }) => theme.font.size.sm};
      width: 100%;

      &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.input.focusBorder};
      }
    }
  }

  /* ── Settings (checkboxes) ────────────────────────────────── */
  .settings-section {
    label.checkbox-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: ${({ theme }) => theme.border.radius.sm};
      transition: background-color ${({ theme }) => theme.transition.fast};

      &:hover {
        background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
      }

      input[type='checkbox'] {
        cursor: pointer;
        width: 15px;
        height: 15px;
        accent-color: ${({ theme }) => theme.brand};
        flex-shrink: 0;
      }

      span {
        color: ${({ theme }) => theme.text};
        font-size: ${({ theme }) => theme.font.size.sm};
      }
    }
  }

  /* ── Preview Button ────────────────────────────────────────── */
  .preview-section {
    border-top: 1px solid ${({ theme }) => theme.border.border1};
    padding-top: 12px;

    .btn-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      background: ${({ theme }) => theme.brand};
      color: white;
      border: none;
      border-radius: ${({ theme }) => theme.border.radius.sm};
      cursor: pointer;
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      transition: opacity ${({ theme }) => theme.transition.fast};
      width: 100%;

      &:hover {
        opacity: 0.88;
      }

      &:active {
        transform: scale(0.97);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .preview-hint {
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      text-align: center;
      margin-top: 6px;
    }
  }

  /* ── Unpublish Section ─────────────────────────────────────── */
  .unpublish-section {
    border-top: 1px solid ${({ theme }) => theme.border.border1};
    padding-top: 12px;

    .btn-danger {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 14px;
      background: transparent;
      color: ${({ theme }) => theme.colors.text.danger};
      border: 1px solid ${({ theme }) => theme.colors.text.danger};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      cursor: pointer;
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      transition: background-color ${({ theme }) => theme.transition.fast};

      &:hover {
        background: ${({ theme }) => theme.colors.bg.danger}22;
      }

      &:active {
        transform: scale(0.97);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .confirm-box {
      padding: 10px 12px;
      background: ${({ theme }) => theme.colors.bg.danger}15;
      border: 1px solid ${({ theme }) => theme.colors.text.danger}44;
      border-radius: ${({ theme }) => theme.border.radius.base};

      p {
        font-size: ${({ theme }) => theme.font.size.sm};
        color: ${({ theme }) => theme.text};
        margin-bottom: 10px;
      }

      .confirm-actions {
        display: flex;
        gap: 8px;

        .btn-confirm-danger {
          padding: 5px 14px;
          background: ${({ theme }) => theme.colors.text.danger};
          color: white;
          border: none;
          border-radius: ${({ theme }) => theme.border.radius.sm};
          cursor: pointer;
          font-size: ${({ theme }) => theme.font.size.sm};
          font-weight: 500;
          transition: opacity ${({ theme }) => theme.transition.fast};

          &:hover { opacity: 0.85; }
          &:disabled { opacity: 0.5; cursor: not-allowed; }
        }

        .btn-cancel {
          padding: 5px 14px;
          background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
          color: ${({ theme }) => theme.text};
          border: 1px solid ${({ theme }) => theme.border.border1};
          border-radius: ${({ theme }) => theme.border.radius.sm};
          cursor: pointer;
          font-size: ${({ theme }) => theme.font.size.sm};
          transition: background-color ${({ theme }) => theme.transition.fast};

          &:hover {
            background: ${({ theme }) => theme.sidebar.collection.item.bg};
          }
        }
      }
    }
  }

  /* ── Analytics Section ─────────────────────────────────────── */
  .analytics-section {
    .analytics-cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .analytics-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
      border: 1px solid ${({ theme }) => theme.border.border1};
      border-radius: ${({ theme }) => theme.border.radius.base};

      &.full-width {
        grid-column: 1 / -1;
      }
    }

    .analytics-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      background: ${({ theme }) => theme.brand};
      color: white;
      border-radius: ${({ theme }) => theme.border.radius.sm};
      flex-shrink: 0;
    }

    .analytics-label {
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      margin-bottom: 2px;
    }

    .analytics-value {
      font-size: 1.4rem;
      font-weight: 600;
      color: ${({ theme }) => theme.text};
    }

    .analytics-value-sm {
      font-size: ${({ theme }) => theme.font.size.sm};
      font-weight: 500;
      color: ${({ theme }) => theme.text};
    }
  }

  /* ── Slug Input (pre-publish) ──────────────────────────────── */
  .slug-section {
    .slug-input-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .slug-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid ${({ theme }) => theme.input.border};
      border-radius: ${({ theme }) => theme.border.radius.sm};
      background: ${({ theme }) => theme.input.bg};
      color: ${({ theme }) => theme.text};
      font-size: ${({ theme }) => theme.font.size.sm};
      font-family: monospace;

      &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.input.focusBorder};
      }
    }

    .slug-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: ${({ theme }) => theme.font.size.xs};
      font-weight: 500;
      white-space: nowrap;

      &.checking { color: ${({ theme }) => theme.colors.text.muted}; }
      &.available { color: ${({ theme }) => theme.colors.text.green}; }
      &.taken { color: ${({ theme }) => theme.colors.text.danger}; }
    }

    .field-hint {
      font-size: ${({ theme }) => theme.font.size.xs};
      color: ${({ theme }) => theme.colors.text.muted};
      margin-top: 4px;
    }
  }

  /* ── Branding Section ─────────────────────────────────────── */
  .branding-section {
    .upload-field {
      .field-label {
        display: block;
        font-size: ${({ theme }) => theme.font.size.sm};
        font-weight: 500;
        color: ${({ theme }) => theme.text};
        margin-bottom: 6px;
      }

      .field-hint {
        font-size: ${({ theme }) => theme.font.size.xs};
        color: ${({ theme }) => theme.colors.text.muted};
        margin-bottom: 8px;
      }

      .file-input {
        display: none;
      }

      .upload-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .btn-upload {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: ${({ theme }) => theme.sidebar.bg};
        border: 1px solid ${({ theme }) => theme.border.border1};
        border-radius: ${({ theme }) => theme.border.radius.sm};
        cursor: pointer;
        font-size: ${({ theme }) => theme.font.size.sm};
        font-weight: 500;
        color: ${({ theme }) => theme.text};
        transition: background-color ${({ theme }) => theme.transition.fast},
                    border-color ${({ theme }) => theme.transition.fast};

        &:hover {
          background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
          border-color: ${({ theme }) => theme.brand};
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .logo-preview {
        width: 36px;
        height: 36px;
        object-fit: contain;
        border: 1px solid ${({ theme }) => theme.border.border1};
        border-radius: ${({ theme }) => theme.border.radius.sm};
        padding: 3px;
      }

      .status-text {
        font-size: ${({ theme }) => theme.font.size.xs};
        color: ${({ theme }) => theme.colors.text.green};
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .btn-remove {
        background: none;
        border: none;
        cursor: pointer;
        font-size: ${({ theme }) => theme.font.size.xs};
        color: ${({ theme }) => theme.colors.text.danger};
        padding: 2px 0;
        text-decoration: underline;

        &:hover { opacity: 0.75; }
      }
    }

    .divider {
      height: 1px;
      background: ${({ theme }) => theme.border.border0};
      margin: 14px 0;
    }
  }

  /* ── Generic Utilities ─────────────────────────────────────── */
  .section-label {
    display: block;
    font-size: ${({ theme }) => theme.font.size.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.text};
    margin-bottom: 6px;
  }

  .muted {
    color: ${({ theme }) => theme.colors.text.muted};
    font-size: ${({ theme }) => theme.font.size.xs};
  }

  .skeleton-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`;

export default Styled;
