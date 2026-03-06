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
`;

export default StyledWrapper;
