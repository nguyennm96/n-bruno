import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  margin-bottom: 3px;
  flex-shrink: 0;
  border-left: 1px solid ${(props) => props.theme.requestTabs.bottomBorder};
`;

export default StyledWrapper;
