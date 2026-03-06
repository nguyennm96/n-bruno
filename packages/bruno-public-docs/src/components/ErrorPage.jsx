import React from 'react';

const ErrorPage = ({ error }) => {
  return (
    <div style={styles.container}>
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h1 style={styles.title}>Documentation Not Available</h1>
      <p style={styles.message}>{error?.message || 'An error occurred while loading the documentation'}</p>
      <a href="https://www.usebruno.com" style={styles.link}>
        Go to Bruno Homepage
      </a>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    textAlign: 'center',
    padding: '20px'
  },
  iconContainer: {
    marginBottom: '24px'
  },
  icon: {
    width: '64px',
    height: '64px',
    color: '#ef4444'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '12px'
  },
  message: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '24px',
    maxWidth: '500px'
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '500',
    padding: '10px 20px',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    transition: 'all 0.2s'
  }
};

export default ErrorPage;
