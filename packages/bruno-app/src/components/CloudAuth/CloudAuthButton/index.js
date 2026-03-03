import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconUser, IconChevronDown, IconCloud, IconSettings, IconLogout } from '@tabler/icons';
import { selectIsAuthenticated, selectUser, logout } from 'providers/ReduxStore/slices/auth';
import AuthModal from '../AuthModal';
import StyledWrapper from './StyledWrapper';

const CloudAuthButton = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignIn = () => {
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await dispatch(logout());
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  if (!isAuthenticated) {
    return (
      <StyledWrapper>
        <button className="sign-in-button" onClick={handleSignIn} title="Sign In">
          <IconUser size={18} strokeWidth={1.5} />
        </button>

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <div className="user-menu-container">
        <button className="user-button" onClick={toggleUserMenu} title={`Signed in as ${user?.email}`}>
          <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="cloud-badge">
              <IconCloud size={10} strokeWidth={1.5} />
              <span>Cloud</span>
            </div>
          </div>
          <IconChevronDown size={12} strokeWidth={1.5} className={`chevron ${showUserMenu ? 'open' : ''}`} />
        </button>

        {showUserMenu && (
          <div className="user-menu">
            <div className="menu-item disabled">
              <IconSettings size={14} strokeWidth={1.5} />
              <span>Account Settings (Soon)</span>
            </div>

            <div className="menu-divider"></div>

            <div className="menu-item" onClick={handleSignOut}>
              <IconLogout size={14} strokeWidth={1.5} />
              <span>Sign Out</span>
            </div>
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default CloudAuthButton;
