import styled from 'styled-components';

const StyledWrapper = styled.div`
  .onboarding-content {
    padding: 24px;
    text-align: center;

    .onboarding-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h2 {
      margin: 16px 0;
      font-size: 24px;
      font-weight: 600;
      color: ${(props) => props.theme.colors.text.primary};
    }

    .onboarding-description {
      margin-bottom: 24px;
      color: ${(props) => props.theme.colors.text.muted};
      line-height: 1.6;
    }

    .form-group {
      margin-bottom: 16px;
      text-align: left;

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: ${(props) => props.theme.colors.text.primary};
        font-size: ${(props) => props.theme.font.size.md};
      }

      input,
      textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid ${(props) => props.theme.colors.border.default};
        border-radius: 6px;
        background: ${(props) => props.theme.colors.bg.secondary};
        color: ${(props) => props.theme.colors.text.primary};
        font-family: inherit;
        font-size: ${(props) => props.theme.font.size.md};
        transition: border-color 0.2s, background-color 0.2s;

        &:hover {
          border-color: ${(props) => props.theme.colors.border.hover};
        }

        &:focus {
          outline: none;
          border-color: ${(props) => props.theme.colors.primary};
          background: ${(props) => props.theme.colors.bg.primary};
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        &::placeholder {
          color: ${(props) => props.theme.colors.text.muted};
        }
      }

      textarea {
        resize: vertical;
        min-height: 80px;
        line-height: 1.5;
      }
    }

    .button-group {
      margin-top: 24px;
      display: flex;
      gap: 12px;
      justify-content: center;

      button {
        padding: 10px 24px;
        border-radius: 6px;
        font-weight: 500;
        font-size: ${(props) => props.theme.font.size.md};
        transition: all 0.2s;

        &.primary {
          background: ${(props) => props.theme.colors.primary};
          color: white;
          border: none;
          cursor: pointer;

          &:hover:not(:disabled) {
            background: ${(props) => props.theme.colors.primaryHover};
            transform: translateY(-2px);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        }
      }
    }

    .hint {
      margin-top: 16px;
      font-size: ${(props) => props.theme.font.size.base};
      color: ${(props) => props.theme.colors.text.muted};
      line-height: 1.5;
    }
  }
`;

export default StyledWrapper;
