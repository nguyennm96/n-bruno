import React, { useState, useMemo } from 'react';
import yaml from 'js-yaml';
import { usePublicDoc } from '../hooks/usePublicDoc';
import LoadingState from './LoadingState';
import ErrorPage from './ErrorPage';
import PasswordPrompt from './PasswordPrompt';
import DocsLayout from './DocsLayout.jsx';
import { parseCollection } from '../utils/collection.js';

const DocViewer = ({ slug }) => {
  const { doc, loading, error, requiresPassword, verifyPassword } = usePublicDoc(slug);
  const [passwordError, setPasswordError] = useState(null);

  const handlePasswordSubmit = async (password) => {
    setPasswordError(null);
    const result = await verifyPassword(password);
    if (!result.success) {
      setPasswordError(result.error);
    }
    return result;
  };

  // Parse + normalize collection data
  const collection = useMemo(() => {
    if (!doc) return null;
    let raw = doc.collection;
    if (typeof raw === 'string') {
      try {
        raw = yaml.load(raw);
      } catch {
        return null;
      }
    }
    return parseCollection(raw);
  }, [doc]);

  if (loading) return <LoadingState />;

  if (requiresPassword || (error && error.requiresPassword)) {
    return <PasswordPrompt onSubmit={handlePasswordSubmit} error={passwordError} />;
  }

  if (error && !requiresPassword) {
    return <ErrorPage error={error} />;
  }

  if (!doc || !collection) return null;

  return <DocsLayout collection={collection} settings={doc.settings} />;
};

export default DocViewer;
