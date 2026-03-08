import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: block;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.background.surface1} 25%,
    ${({ theme }) => theme.background.surface2} 50%,
    ${({ theme }) => theme.background.surface1} 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
  border-radius: ${({ theme, $borderRadius }) => $borderRadius || theme.border.radius.base};
  width: ${({ $width }) => $width || '100%'};
  height: ${({ $height }) => $height || '1rem'};
  flex-shrink: 0;
`;

export default StyledWrapper;
