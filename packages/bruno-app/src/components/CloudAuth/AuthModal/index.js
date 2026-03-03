import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { login, register, selectAuthError, selectIsAuthLoading } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';

const AuthModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectIsAuthLoading);
  const authError = useSelector(selectAuthError);

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const isLoginMode = mode === 'login';

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Register-specific validation
    if (!isLoginMode) {
      if (!formData.name) {
        newErrors.name = 'Name is required';
      }

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
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (isLoginMode) {
        await dispatch(
          login({
            email: formData.email,
            password: formData.password
          })
        ).unwrap();
      } else {
        await dispatch(
          register({
            email: formData.email,
            password: formData.password,
            name: formData.name
          })
        ).unwrap();
      }

      // Success - close modal
      onClose();
    } catch (error) {
      // Error is already displayed via toast in Redux action
      console.error('Auth error:', error);
    }
  };

  const toggleMode = () => {
    setMode(isLoginMode ? 'register' : 'login');
    setFormData({
      email: '',
      password: '',
      name: '',
      confirmPassword: ''
    });
    setErrors({});
  };

  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="sm"
          title={isLoginMode ? 'Sign In to AhaMan Cloud' : 'Create AhaMan Cloud Account'}
          handleCancel={onClose}
          hideFooter={true}
        >
          <form onSubmit={handleSubmit} className="auth-form">
            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Name *
                </label>
                <input
                  id="name"
                  type="text"
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isLoading}
                  autoFocus={!isLoginMode}
                />
                {errors.name && <div className="error-message">{errors.name}</div>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email *
              </label>
              <input
                id="email"
                type="email"
                className={`form-input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isLoading}
                autoFocus={isLoginMode}
              />
              {errors.email && <div className="error-message">{errors.email}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password *
              </label>
              <input
                id="password"
                type="password"
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                placeholder={isLoginMode ? 'Enter your password' : 'Min 8 characters'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                disabled={isLoading}
              />
              {errors.password && <div className="error-message">{errors.password}</div>}
            </div>

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  disabled={isLoading}
                />
                {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
              </div>
            )}

            {authError && <div className="error-message auth-error">{authError}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
                {isLoading ? 'Please wait...' : isLoginMode ? 'Sign In' : 'Create Account'}
              </button>
            </div>

            <div className="form-footer">
              <span className="toggle-mode">
                {isLoginMode ? 'Don\'t have an account?' : 'Already have an account?'}{' '}
                <button type="button" className="link-button" onClick={toggleMode} disabled={isLoading}>
                  {isLoginMode ? 'Sign Up' : 'Sign In'}
                </button>
              </span>
            </div>

            {isLoginMode && (
              <div className="forgot-password">
                <button type="button" className="link-button text-sm" disabled>
                  Forgot password? (Coming soon)
                </button>
              </div>
            )}
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default AuthModal;
