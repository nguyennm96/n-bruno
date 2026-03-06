import React, { useState } from 'react';

const PasswordPrompt = ({ onSubmit, error }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    const result = await onSubmit(password);
    setLoading(false);

    if (!result.success) {
      // Error will be shown from parent component
      setPassword('');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconContainer}>
          <svg
            style={styles.icon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 style={styles.title}>Password Protected</h1>
        <p style={styles.message}>This documentation is password protected. Please enter the password to continue.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoFocus
            disabled={loading}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            style={{
              ...styles.button,
              ...((!password || loading) && styles.buttonDisabled)
            }}
          >
            {loading ? 'Verifying...' : 'Access Documentation'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '40px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center'
  },
  iconContainer: {
    marginBottom: '24px'
  },
  icon: {
    width: '48px',
    height: '48px',
    color: '#3b82f6',
    margin: '0 auto'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '12px'
  },
  message: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    fontWeight: '500',
    color: 'white',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed'
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    margin: '0'
  }
};

export default PasswordPrompt;
