import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { IconUser, IconChevronDown, IconSettings, IconLogout } from '@tabler/icons';
import { selectIsAuthenticated, selectUser, logout } from 'providers/ReduxStore/slices/auth';
import AuthModal from '../AuthModal';
import AccountSettingsModal from '../AccountSettingsModal';
import StyledWrapper from './StyledWrapper';

const CloudAuthButton = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleSignIn = () => setShowAuthModal(true);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await dispatch(logout());
  };

  const handleOpenAccountSettings = () => {
    setShowUserMenu(false);
    setShowAccountModal(true);
  };

  if (!isAuthenticated) {
    return (
      <StyledWrapper>
        <button className="sign-in-button" onClick={handleSignIn} title={t('CLOUD_AUTH.SIGN_IN_TO_BRUNO_CLOUD')}>
          <IconUser size={18} strokeWidth={1.5} />
        </button>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </StyledWrapper>
    );
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase();

  return (
    <StyledWrapper>
      <div className="user-menu-container" ref={menuRef}>
        <button className="user-button" onClick={() => setShowUserMenu((v) => !v)} title={`Signed in as ${user?.email}`}>
          <div className="user-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name || t('CLOUD_AUTH.AVATAR')} className="avatar-img" />
            ) : (
              <span className="avatar-initials">{initials}</span>
            )}
          </div>
          <IconChevronDown size={12} strokeWidth={1.5} className={`chevron ${showUserMenu ? 'open' : ''}`} />
        </button>

        {showUserMenu && (
          <div className="user-menu">
            <div className="menu-user-info">
              <div className="menu-user-name">{user?.name || t('CLOUD_AUTH.USER')}</div>
              <div className="menu-user-email">{user?.email}</div>
            </div>
            <div className="menu-divider" />
            <button className="menu-item" onClick={handleOpenAccountSettings}>
              <IconSettings size={14} strokeWidth={1.5} />
              <span>{t('CLOUD_AUTH.ACCOUNT_SETTINGS')}</span>
            </button>
            <div className="menu-divider" />
            <button className="menu-item menu-item-danger" onClick={handleSignOut}>
              <IconLogout size={14} strokeWidth={1.5} />
              <span>{t('CLOUD_AUTH.SIGN_OUT')}</span>
            </button>
          </div>
        )}
      </div>

      {showAccountModal && <AccountSettingsModal onClose={() => setShowAccountModal(false)} />}
    </StyledWrapper>
  );
};

export default CloudAuthButton;
