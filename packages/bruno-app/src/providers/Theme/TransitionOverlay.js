import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.background.base}cc;
  backdrop-filter: blur(4px);
`;

const Ring = styled.div`
  width: 36px;
  height: 36px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.brand};
  border-radius: 50%;
`;

const TransitionOverlay = () => (
  <Overlay>
    <Ring className="animate-spin" />
  </Overlay>
);

export default TransitionOverlay;
