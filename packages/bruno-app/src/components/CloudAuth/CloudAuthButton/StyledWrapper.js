import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  margin-right: 0.5rem;

  /* Sign In Button */
  .sign-in-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: ${(props) => props.theme.text};
    cursor: pointer;

    svg {
      flex-shrink: 0;
    }
  }

  /* User Menu Container */
  .user-menu-container {
    position: relative;
  }

  /* User Button */
  .user-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: ${(props) => props.theme.text};
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    }
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: ${(props) => props.theme.brand};
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.6875rem;
    flex-shrink: 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    text-align: left;
    min-width: 0;
  }

  .user-name {
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .cloud-badge {
    display: none; /* Hide cloud badge in titlebar for compact design */
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;
    margin-left: 0.125rem;

    &.open {
      transform: rotate(180deg);
    }
  }

  /* User Menu Dropdown */
  .user-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 200px;
    background: ${(props) => props.theme.dropdown.bg};
    border: 1px solid ${(props) => props.theme.dropdown.border};
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    padding: 0.25rem 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    color: ${(props) => props.theme.dropdown.color};
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover:not(.disabled) {
      background: ${(props) => props.theme.dropdown.hoverBg};
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    svg {
      flex-shrink: 0;
    }

    span {
      flex: 1;
    }
  }

  .menu-divider {
    height: 1px;
    background: ${(props) => props.theme.dropdown.border};
    margin: 0.25rem 0;
  }
`;

export default StyledWrapper;
