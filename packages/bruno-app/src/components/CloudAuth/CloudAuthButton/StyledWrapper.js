import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  margin-right: 0.5rem;

  .sign-in-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: ${({ theme }) => theme.border.radius.base};
    color: ${({ theme }) => theme.text};
    cursor: pointer;
    transition: background-color ${({ theme }) => theme.transition.fast};

    &:hover {
      background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
    }

    svg { flex-shrink: 0; }
  }

  .user-menu-container {
    position: relative;
  }

  .user-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    background: transparent;
    border: none;
    border-radius: ${({ theme }) => theme.border.radius.base};
    color: ${({ theme }) => theme.text};
    cursor: pointer;
    transition: background-color ${({ theme }) => theme.transition.fast};

    &:hover {
      background: ${({ theme }) => theme.sidebar.collection.item.hoverBg};
    }
  }

  .user-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: ${({ theme }) => theme.brand};
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: ${({ theme }) => theme.font.size.xs};
    flex-shrink: 0;
    overflow: hidden;

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      font-size: ${({ theme }) => theme.font.size.xs};
      font-weight: 600;
    }
  }

  .chevron {
    flex-shrink: 0;
    opacity: 0.6;
    transition: transform ${({ theme }) => theme.transition.base};

    &.open { transform: rotate(180deg); }
  }

  .user-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 200px;
    background: ${({ theme }) => theme.dropdown.bg};
    border: 1px solid ${({ theme }) => theme.dropdown.border};
    border-radius: ${({ theme }) => theme.border.radius.md};
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    z-index: 10000;
    overflow: hidden;
  }

  .menu-user-info {
    padding: 10px 14px 9px;
  }

  .menu-user-name {
    font-size: ${({ theme }) => theme.font.size.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-user-email {
    font-size: ${({ theme }) => theme.font.size.xs};
    color: ${({ theme }) => theme.sidebar?.muted || theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 8px 14px;
    font-size: ${({ theme }) => theme.font.size.sm};
    color: ${({ theme }) => theme.dropdown.color};
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background-color ${({ theme }) => theme.transition.fast};

    &:hover {
      background: ${({ theme }) => theme.dropdown.hoverBg};
    }

    &.menu-item-danger {
      color: ${({ theme }) => theme.colors?.text?.danger || '#e53e3e'};
    }

    svg { flex-shrink: 0; }
    span { flex: 1; }
  }

  .menu-divider {
    height: 1px;
    background: ${({ theme }) => theme.dropdown.border};
    margin: 0;
  }
`;

export default StyledWrapper;
