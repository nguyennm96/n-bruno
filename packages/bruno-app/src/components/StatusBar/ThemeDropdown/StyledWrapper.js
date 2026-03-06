import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  .theme-menu {
    padding: 8px;
    background: ${(props) => props.theme.dropdown.bg};
    border: 1px solid ${(props) => props.theme.dropdown.border};
    border-radius: 6px;
    box-shadow: ${(props) => props.theme.dropdown.shadow};
  }

  .menu-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${(props) => props.theme.dropdown.mutedText};
    padding: 2px 4px 8px 4px;
  }

  .mode-buttons {
    display: flex;
    gap: 4px;
  }

  .mode-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid ${(props) => props.theme.dropdown.separator};
    border-radius: 5px;
    background: transparent;
    color: ${(props) => props.theme.dropdown.mutedText};
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      background: ${(props) => props.theme.dropdown.hoverBg};
      color: ${(props) => props.theme.dropdown.color};
    }

    &.active {
      background: ${(props) => rgba(props.theme.dropdown.selectedColor, 0.1)};
      border-color: ${(props) => props.theme.dropdown.selectedColor};
      color: ${(props) => props.theme.dropdown.selectedColor};
    }
  }
`;

export default StyledWrapper;
