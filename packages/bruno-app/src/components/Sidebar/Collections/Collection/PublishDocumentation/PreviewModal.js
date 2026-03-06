import React, { useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons';
import styled from 'styled-components';

const PreviewModal = ({ collection, settings, onClose }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (collection && containerRef.current && window.OpenCollection) {
      try {
        // Apply custom CSS if provided
        if (settings?.custom_css) {
          let styleEl = document.getElementById('preview-custom-css');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'preview-custom-css';
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = settings.custom_css;
        }

        // Display custom logo if provided
        if (settings?.custom_logo_url) {
          const logoEl = document.getElementById('preview-custom-logo');
          if (logoEl) {
            logoEl.src = settings.custom_logo_url;
            logoEl.style.display = 'block';
          } else {
            // Create logo element
            const logo = document.createElement('img');
            logo.id = 'preview-custom-logo';
            logo.src = settings.custom_logo_url;
            logo.style.cssText = 'position: fixed; top: 20px; left: 20px; max-width: 150px; max-height: 50px; z-index: 1000;';
            containerRef.current.appendChild(logo);
          }
        }

        // Render OpenCollection viewer
        new window.OpenCollection({
          target: containerRef.current,
          opencollection: collection,
          theme: 'light',
          showExamples: settings?.show_examples !== false,
          showAuth: settings?.show_auth !== false
        });
      } catch (err) {
        console.error('Error initializing preview:', err);
      }
    }

    // Cleanup
    return () => {
      const styleEl = document.getElementById('preview-custom-css');
      if (styleEl) {
        styleEl.remove();
      }
      const logoEl = document.getElementById('preview-custom-logo');
      if (logoEl) {
        logoEl.remove();
      }
    };
  }, [collection, settings]);

  return (
    <StyledWrapper>
      <div className="preview-overlay" onClick={onClose}>
        <div className="preview-container" onClick={(e) => e.stopPropagation()}>
          <div className="preview-header">
            <div className="preview-title">
              <span className="preview-badge">PREVIEW</span>
              <h2>Documentation Preview</h2>
            </div>
            <button onClick={onClose} className="close-btn" title="Close preview">
              <IconX size={20} />
            </button>
          </div>
          <div
            ref={containerRef}
            className="preview-content"
          />
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .preview-container {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 1400px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
  }

  .preview-title {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }
  }

  .preview-badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: #f3f4f6;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;

    &:hover {
      background: #e5e7eb;
      color: #111827;
    }
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: #f9fafb;
  }
`;

export default PreviewModal;
