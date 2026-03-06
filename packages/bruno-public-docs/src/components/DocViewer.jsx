import React, { useEffect, useRef, useState } from 'react';
import { usePublicDoc } from '../hooks/usePublicDoc';
import LoadingState from './LoadingState';
import ErrorPage from './ErrorPage';
import PasswordPrompt from './PasswordPrompt';
import yaml from 'js-yaml';

const DocViewer = ({ slug }) => {
  const { doc, loading, error, requiresPassword, verifyPassword } = usePublicDoc(slug);
  const containerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [passwordError, setPasswordError] = useState(null);

  const handlePasswordSubmit = async (password) => {
    setPasswordError(null);
    const result = await verifyPassword(password);

    if (!result.success) {
      setPasswordError(result.error);
    }

    return result;
  };

  useEffect(() => {
    if (doc && containerRef.current && window.OpenCollection) {
      // Apply custom CSS if provided
      if (doc.settings?.custom_css) {
        let styleEl = document.getElementById('custom-docs-css');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-docs-css';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = doc.settings.custom_css;
      }

      // Display custom logo if provided
      if (doc.settings?.custom_logo_url) {
        const logoEl = document.getElementById('custom-docs-logo');
        if (logoEl) {
          logoEl.src = doc.settings.custom_logo_url;
          logoEl.style.display = 'block';
        } else {
          // Create logo element
          const logo = document.createElement('img');
          logo.id = 'custom-docs-logo';
          logo.src = doc.settings.custom_logo_url;
          logo.style.cssText = 'position: fixed; top: 20px; left: 20px; max-width: 150px; max-height: 50px; z-index: 1000;';
          document.body.appendChild(logo);
        }
      }

      // Clear previous viewer instance
      if (viewerInstanceRef.current) {
        try {
          // OpenCollection might not have a destroy method, so just clear the container
          containerRef.current.innerHTML = '';
        } catch (err) {
          console.error('Error destroying previous viewer:', err);
        }
      }

      try {
        // Convert the collection JSON to OpenCollection YAML format
        const collection = doc.collection;

        // The collection from backend should already be in the right format
        // But we need to ensure it's in OpenCollection format
        let openCollectionData;

        if (typeof collection === 'string') {
          // If it's a YAML string, parse it
          openCollectionData = yaml.load(collection);
        } else {
          // If it's already an object, use it directly
          openCollectionData = collection;
        }

        // Create OpenCollection viewer instance
        viewerInstanceRef.current = new window.OpenCollection({
          target: containerRef.current,
          opencollection: openCollectionData,
          theme: 'light',
          showExamples: doc.settings?.show_examples !== false,
          showAuth: doc.settings?.show_auth !== false
        });

        console.log('Documentation viewer initialized successfully');
      } catch (err) {
        console.error('Error initializing OpenCollection viewer:', err);
      }
    }

    // Cleanup on unmount
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      viewerInstanceRef.current = null;

      // Remove custom CSS
      const styleEl = document.getElementById('custom-docs-css');
      if (styleEl) {
        styleEl.remove();
      }

      // Remove custom logo
      const logoEl = document.getElementById('custom-docs-logo');
      if (logoEl) {
        logoEl.remove();
      }
    };
  }, [doc]);

  // Show loading state
  if (loading) {
    return <LoadingState />;
  }

  // Show password prompt if required
  if (requiresPassword || (error && error.requiresPassword)) {
    return <PasswordPrompt onSubmit={handlePasswordSubmit} error={passwordError} />;
  }

  // Show error page
  if (error && !requiresPassword) {
    return <ErrorPage error={error} />;
  }

  // Render the documentation viewer
  return (
    <div
      ref={containerRef}
      id="opencollection-container"
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'auto'
      }}
    />
  );
};

export default DocViewer;
