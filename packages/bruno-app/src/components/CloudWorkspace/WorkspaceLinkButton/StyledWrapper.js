import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: center;

  .link-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: transparent;
    border: 1px solid ${(props) => props.theme.sidebar.dragbar.border};
    border-radius: 4px;
    color: ${(props) => props.theme.text};
    cursor: pointer;
    font-size: 0.8125rem;
    transition: all 0.2s ease;

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      border-color: ${(props) => props.theme.brand};
    }

    &.linked {
      border-color: ${(props) => props.theme.brand};
      color: ${(props) => props.theme.brand};

      &:hover {
        background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      }
    }

    svg {
      flex-shrink: 0;
    }

    span {
      font-weight: 500;
    }
  }
`;

export default StyledWrapper;
