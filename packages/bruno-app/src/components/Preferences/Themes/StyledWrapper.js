import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  .appearance-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
  }

  .section-header {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.text};
    margin-bottom: 4px;
  }

  .theme-mode-selector {
    display: flex;
    gap: 8px;
  }

  .theme-mode-option {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    padding: 6px 12px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    background: transparent;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }

    &.selected {
      border-color: ${(props) => props.theme.accents.primary};
      background: ${(props) => rgba(props.theme.accents.primary, 0.07)};
      color: ${(props) => props.theme.accents.primary};
      cursor: default;
    }
  }

  .theme-variant-section {
    margin-top: 4px;
  }

  .theme-variant-label {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
    margin-bottom: 12px;
  }

  .theme-variants {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .theme-variant-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    border: 2px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.md};
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 90px;

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }

    &.selected {
      border-color: ${(props) => props.theme.accents.primary};
      background: ${(props) => rgba(props.theme.accents.primary, 0.07)};
      cursor: default;
    }
  }

  .theme-preview {
    width: 60px;
    height: 40px;
    border-radius: ${(props) => props.theme.border.radius.sm};
    margin-bottom: 8px;
    display: flex;
    overflow: hidden;
  }

  .theme-preview-sidebar {
    width: 15px;
    height: 100%;
  }

  .theme-preview-main {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 4px;
    gap: 3px;
  }

  .theme-preview-line {
    height: 4px;
    border-radius: 2px;
    width: 80%;
  }

  .theme-variant-name {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.text};
    text-align: center;
  }

  .section-divider {
    height: 1px;
    background: ${(props) => props.theme.input.border};
    margin: 4px 0;
  }
`;

export default StyledWrapper;
