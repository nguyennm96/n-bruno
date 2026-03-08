import styled from 'styled-components';

const StyledWrapper = styled.div`
  padding: 0px 4px;
  width: 100%;
  min-width: 0;

  .doc-toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 8px;
  }

  .btn-generate-ai {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-size: ${({ theme }) => theme.font?.size?.sm || '12px'};
    font-weight: 500;
    border-radius: ${({ theme }) => theme.border?.radius?.base || '6px'};
    border: 1px solid ${({ theme }) => theme.brand || '#7c3aed'};
    background: transparent;
    color: ${({ theme }) => theme.brand || '#7c3aed'};
    cursor: pointer;
    transition: background-color ${({ theme }) => theme.transition?.fast || '0.1s ease'},
                color ${({ theme }) => theme.transition?.fast || '0.1s ease'};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.brand || '#7c3aed'};
      color: #fff;
    }

    &:active:not(:disabled) {
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .doc-editor-section {
    width: 720px;
    max-width: 100%;
    min-width: 0;
  }
`;

export default StyledWrapper;
