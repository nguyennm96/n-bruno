import React, { useState, useEffect, useMemo } from 'react';
import yaml from 'js-yaml';
import LoadingState from './LoadingState';
import DocsLayout from './DocsLayout.jsx';
import { parseCollection } from '../utils/collection.js';

/**
 * PreviewViewer — rendered at /preview
 * Receives collection + settings from parent window via postMessage.
 * Used by PublishDocumentation PreviewModal in bruno-app.
 */
const PreviewViewer = () => {
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'BRUNO_DOCS_PREVIEW') {
        setPreviewData({
          collection: event.data.collection,
          settings: event.data.settings
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal to parent that we're ready to receive data
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'BRUNO_DOCS_PREVIEW_READY' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const collection = useMemo(() => {
    if (!previewData?.collection) return null;
    let raw = previewData.collection;
    if (typeof raw === 'string') {
      try {
        raw = yaml.load(raw);
      } catch {
        return null;
      }
    }
    // Already normalized object — pass through parseCollection for safety
    return parseCollection(raw);
  }, [previewData]);

  if (!previewData || !collection) {
    return <LoadingState />;
  }

  return <DocsLayout collection={collection} settings={previewData.settings} />;
};

export default PreviewViewer;
