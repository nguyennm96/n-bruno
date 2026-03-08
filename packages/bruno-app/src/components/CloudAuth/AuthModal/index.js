import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { IconEye, IconEyeOff } from '@tabler/icons';
import toast from 'react-hot-toast';
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  loginWithOAuth,
  selectAuthError,
  selectIsAuthLoading
} from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';

// ── SVG icons for OAuth providers ────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
  </svg>
);

const GitHubIcon = ({ theme }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

// ── AuthModal ─────────────────────────────────────────────────────────────────

const AuthModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectIsAuthLoading);
  const authError = useSelector(selectAuthError);

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgotPassword' | 'resetPassword'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
    otp: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [rpLoading, setRpLoading] = useState(false);
  const [rpError, setRpError] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState(null);
  const { t } = useTranslation();

  const isLoginMode = mode === 'login';

  // ── OAuth callback listener ───────────────────────────────────────────────
  useEffect(() => {
    const { ipcRenderer } = window;
    if (!ipcRenderer) return;

    const handleOauthCallback = async (event, { code, provider, error }) => {
      setOauthLoadingProvider(null);
      if (error) {
        toast.error(`OAuth failed: ${error}`);
        return;
      }
      if (!code) return;
      try {
        await dispatch(loginWithOAuth({ provider, code })).unwrap();
        onClose();
      } catch {
        // error toast handled inside the thunk
      }
    };

    ipcRenderer.on('oauth:callback', handleOauthCallback);
    return () => ipcRenderer.removeListener('oauth:callback', handleOauthCallback);
  }, [dispatch, onClose]);

  // ── Social login ──────────────────────────────────────────────────────────
  const handleSocialLogin = useCallback(async (provider) => {
    const { ipcRenderer } = window;
    if (!ipcRenderer) {
      toast.error('OAuth login is only available in the desktop app');
      return;
    }
    setOauthLoadingProvider(provider);
    try {
      const serverUrl = import.meta.env?.VITE_BRUNO_SERVER_URL || 'http://localhost:8080';
      await ipcRenderer.invoke('auth:start-oauth-flow', { provider, serverUrl });
      // Result will arrive via 'oauth:callback' IPC event (handled by useEffect above)
    } catch (err) {
      setOauthLoadingProvider(null);
      toast.error(err.message || `Failed to start ${provider} login`);
    }
  }, []);

  // ── Form validation ───────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Minimum 8 characters';
    }
    if (!isLoginMode) {
      if (!formData.name) newErrors.name = 'Name is required';
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validateForm()) return;
    try {
      if (isLoginMode) {
        await dispatch(login({ email: formData.email, password: formData.password })).unwrap();
      } else {
        await dispatch(register({ email: formData.email, password: formData.password, name: formData.name })).unwrap();
      }
      onClose();
    } catch {
      // error handled by thunk
    }
  };

  const toggleMode = () => {
    setMode(isLoginMode ? 'register' : 'login');
    setFormData({ email: '', password: '', name: '', confirmPassword: '', otp: '', newPassword: '', confirmNewPassword: '' });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setFpError('');
    const email = formData.email.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setFpError('Please enter a valid email address');
      return;
    }
    setFpLoading(true);
    const result = await dispatch(forgotPassword({ email }));
    setFpLoading(false);
    if (forgotPassword.rejected.match(result)) {
      setFpError(result.payload || 'Something went wrong');
      return;
    }
    setOtpEmail(email);
    setFormData((prev) => ({ ...prev, otp: '', newPassword: '', confirmNewPassword: '' }));
    setMode('resetPassword');
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setRpError('');
    const { otp, newPassword, confirmNewPassword } = formData;
    if (!otp || otp.length !== 6) {
      setRpError('Please enter the 6-digit OTP');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setRpError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRpError('Passwords do not match');
      return;
    }
    setRpLoading(true);
    const result = await dispatch(resetPassword({ email: otpEmail, otp, newPassword }));
    setRpLoading(false);
    if (resetPassword.rejected.match(result)) {
      setRpError(result.payload || t('CLOUD_AUTH.RESET_FAILED'));
      return;
    }
    toast.success(t('CLOUD_AUTH.RESET_SUCCESS'));
    setMode('login');
    setFormData((prev) => ({ ...prev, email: otpEmail, password: '' }));
  };

  // ── Forgot password view ──────────────────────────────────────────────────
  if (mode === 'forgotPassword') {
    return (
      <Portal>
        <StyledWrapper>
          <Modal size="sm" title={t('CLOUD_AUTH.FORGOT_PASSWORD')} handleCancel={onClose} hideFooter>
            <form onSubmit={handleForgotSubmit} className="auth-form">
              <p className="auth-info-text">
                {t('CLOUD_AUTH.FORGOT_PASSWORD_HINT')}
              </p>
              <div className="form-group">
                <label htmlFor="fp-email" className="form-label">{t('CLOUD_AUTH.EMAIL')}</label>
                <input
                  id="fp-email"
                  type="email"
                  className="form-input"
                  placeholder={t('CLOUD_AUTH.EMAIL_PLACEHOLDER')}
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={fpLoading}
                  autoFocus
                />
              </div>
              {fpError && <div className="error-message auth-error">{fpError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-block" disabled={fpLoading}>
                  {fpLoading ? t('CLOUD_AUTH.SENDING') : t('CLOUD_AUTH.SEND_OTP')}
                </button>
              </div>
              <div className="form-footer">
                <button type="button" className="link-button" onClick={() => setMode('login')}>
                  {t('CLOUD_AUTH.BACK_TO_SIGN_IN')}
                </button>
              </div>
            </form>
          </Modal>
        </StyledWrapper>
      </Portal>
    );
  }

  // ── Reset password view ───────────────────────────────────────────────────
  if (mode === 'resetPassword') {
    return (
      <Portal>
        <StyledWrapper>
          <Modal size="sm" title={t('CLOUD_AUTH.RESET_PASSWORD')} handleCancel={onClose} hideFooter>
            <form onSubmit={handleResetSubmit} className="auth-form">
              <p className="auth-info-text">
                {t('CLOUD_AUTH.RESET_PASSWORD_HINT')} <strong>{otpEmail}</strong> and choose a new password.
              </p>
              <div className="form-group">
                <label htmlFor="rp-otp" className="form-label">{t('CLOUD_AUTH.OTP_CODE')}</label>
                <input
                  id="rp-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="form-input otp-input"
                  placeholder="123456"
                  value={formData.otp}
                  onChange={(e) => handleInputChange('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={rpLoading}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="rp-password" className="form-label">{t('CLOUD_AUTH.NEW_PASSWORD')}</label>
                <input
                  id="rp-password"
                  type="password"
                  className="form-input"
                  placeholder={t('CLOUD_AUTH.PASSWORD_MIN_PLACEHOLDER')}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                  disabled={rpLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="rp-confirm" className="form-label">{t('CLOUD_AUTH.CONFIRM_NEW_PASSWORD')}</label>
                <input
                  id="rp-confirm"
                  type="password"
                  className="form-input"
                  placeholder={t('CLOUD_AUTH.REENTER_PASSWORD_PLACEHOLDER')}
                  value={formData.confirmNewPassword}
                  onChange={(e) => handleInputChange('confirmNewPassword', e.target.value)}
                  disabled={rpLoading}
                />
              </div>
              {rpError && <div className="error-message auth-error">{rpError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-block" disabled={rpLoading}>
                  {rpLoading ? t('CLOUD_AUTH.RESETTING') : t('CLOUD_AUTH.RESET_PASSWORD')}
                </button>
              </div>
              <div className="form-footer">
                <button type="button" className="link-button" onClick={() => setMode('forgotPassword')}>
                  {t('CLOUD_AUTH.BACK')}
                </button>
              </div>
            </form>
          </Modal>
        </StyledWrapper>
      </Portal>
    );
  }

  // ── Login / Register view ─────────────────────────────────────────────────
  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="sm"
          title={isLoginMode ? t('CLOUD_AUTH.SIGN_IN_TITLE') : t('CLOUD_AUTH.REGISTER_TITLE')}
          handleCancel={onClose}
          hideFooter
        >
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Social login */}
            <div className="social-section">
              <button
                type="button"
                className="social-btn social-btn-google"
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading || oauthLoadingProvider !== null}
              >
                <GoogleIcon />
                <span>{t('CLOUD_AUTH.CONTINUE_WITH_GOOGLE')}</span>
                {oauthLoadingProvider === 'google' && <span className="social-loading-indicator" />}
              </button>
              <button
                type="button"
                className="social-btn social-btn-github"
                onClick={() => handleSocialLogin('github')}
                disabled={isLoading || oauthLoadingProvider !== null}
              >
                <GitHubIcon />
                <span>{t('CLOUD_AUTH.CONTINUE_WITH_GITHUB')}</span>
                {oauthLoadingProvider === 'github' && <span className="social-loading-indicator" />}
              </button>
            </div>

            <div className="divider">{t('CLOUD_AUTH.OR')}</div>

            {/* Name field (register only) */}
            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="name" className="form-label">{t('CLOUD_AUTH.NAME')}</label>
                <input
                  id="name"
                  type="text"
                  className={`form-input${errors.name ? ' input-error' : ''}`}
                  placeholder={t('CLOUD_AUTH.NAME_PLACEHOLDER')}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isLoading}
                  autoFocus={!isLoginMode}
                />
                {errors.name && <div className="error-message">{errors.name}</div>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">{t('CLOUD_AUTH.EMAIL')}</label>
              <input
                id="email"
                type="email"
                className={`form-input${errors.email ? ' input-error' : ''}`}
                placeholder={t('CLOUD_AUTH.EMAIL_PLACEHOLDER')}
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isLoading}
                autoFocus={isLoginMode}
              />
              {errors.email && <div className="error-message">{errors.email}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t('CLOUD_AUTH.PASSWORD')}</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input${errors.password ? ' input-error' : ''}`}
                  placeholder={isLoginMode ? t('CLOUD_AUTH.PASSWORD_PLACEHOLDER') : t('CLOUD_AUTH.PASSWORD_MIN_PLACEHOLDER')}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                </button>
              </div>
              {errors.password && <div className="error-message">{errors.password}</div>}
            </div>

            {isLoginMode && (
              <div className="forgot-password">
                <button type="button" className="link-button" onClick={() => setMode('forgotPassword')}>
                  {t('CLOUD_AUTH.FORGOT_PASSWORD_LINK')}
                </button>
              </div>
            )}

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">{t('CLOUD_AUTH.CONFIRM_PASSWORD')}</label>
                <div className="password-field">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`form-input${errors.confirmPassword ? ' input-error' : ''}`}
                    placeholder={t('CLOUD_AUTH.REENTER_PASSWORD_PLACEHOLDER')}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                  </button>
                </div>
                {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
              </div>
            )}

            {authError && <div className="error-message auth-error">{authError}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading || oauthLoadingProvider !== null}>
                {isLoading ? t('CLOUD_AUTH.PLEASE_WAIT') : isLoginMode ? t('CLOUD_AUTH.SIGN_IN') : t('CLOUD_AUTH.CREATE_ACCOUNT')}
              </button>
            </div>

            <div className="form-footer">
              {isLoginMode ? t('CLOUD_AUTH.NO_ACCOUNT') : t('CLOUD_AUTH.HAS_ACCOUNT')}{' '}
              <button type="button" className="link-button" onClick={toggleMode} disabled={isLoading}>
                {isLoginMode ? t('CLOUD_AUTH.SIGN_UP') : t('CLOUD_AUTH.SIGN_IN')}
              </button>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default AuthModal;
