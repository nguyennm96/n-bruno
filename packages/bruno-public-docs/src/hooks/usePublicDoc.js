import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Hook to fetch public documentation
 * Handles loading, error states, and password protection
 */
export const usePublicDoc = (slug) => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);

  const fetchDoc = async (token = null) => {
    setLoading(true);
    setError(null);

    try {
      const headers = {};

      // Add token if provided (for password-protected or workspace-only docs)
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else {
        // Check if we have a stored token for this slug
        const storedToken = localStorage.getItem(`doc-token-${slug}`);
        if (storedToken) {
          headers.Authorization = `Bearer ${storedToken}`;
        }
      }

      const response = await axios.get(`/api/public/docs/${slug}`, { headers });
      setDoc(response.data.data);
      setRequiresPassword(false);
      setLoading(false);
    } catch (err) {
      setLoading(false);

      // Check if password is required
      if (err.response?.status === 401) {
        const message = err.response?.data?.message || '';
        if (message.includes('Password required') || message.includes('password')) {
          setRequiresPassword(true);
          setError({ message: 'Password required', requiresPassword: true });
        } else {
          setError({ message: message || 'Authentication required' });
        }
      } else if (err.response?.status === 404) {
        setError({ message: 'Documentation not found' });
      } else if (err.response?.status === 403) {
        setError({ message: 'You do not have permission to view this documentation' });
      } else {
        setError({ message: err.message || 'Failed to load documentation' });
      }
    }
  };

  const verifyPassword = async (password) => {
    try {
      // Call the password verification endpoint
      const response = await axios.post(`/api/public/docs/${slug}/verify-password`, {
        password
      });

      const token = response.data.token;

      // Store token in localStorage
      localStorage.setItem(`doc-token-${slug}`, token);

      // Fetch the doc with the new token
      await fetchDoc(token);

      return { success: true };
    } catch (err) {
      if (err.response?.status === 401) {
        return { success: false, error: 'Invalid password' };
      }
      return { success: false, error: err.message || 'Failed to verify password' };
    }
  };

  useEffect(() => {
    if (slug) {
      fetchDoc();
    }
  }, [slug]);

  return {
    doc,
    loading,
    error,
    requiresPassword,
    verifyPassword,
    refetch: fetchDoc
  };
};
