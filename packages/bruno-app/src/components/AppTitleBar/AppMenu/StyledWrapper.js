import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;

  .shortcut {
    font-size: ${(props) => props.theme.font.size.xs};
    color: ${(props) => props.theme.dropdown.mutedText};
  }
`;

export default StyledWrapper;
