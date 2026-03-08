import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX, IconExternalLink } from '@tabler/icons';
import styled from 'styled-components';

/**
 * PreviewModal — renders the collection using the bruno-public-docs viewer
 * loaded in an iframe at /preview route, with data sent via postMessage.
 */
const PreviewModal = ({ collection, settings, onClose }) => {
  const { t } = useTranslation();
  const iframeRef = useRef(null);
  const dataSentRef = useRef(false);

  // Detect preview URL: dev server on 3001, or same origin for production
  const previewUrl = (() => {
    try {
      const origin = window.location.origin;
      // In Electron the origin is "file://" or a custom protocol — fall back to dev server
      if (origin.startsWith('file:') || origin.startsWith('app:')) {
        return 'http://localhost:3001/preview';
      }
      // In production web, public-docs is served from the same server
      return `${origin}/preview`;
    } catch {
      return 'http://localhost:3001/preview';
    }
  })();

  const sendPreviewData = useCallback(() => {
    if (dataSentRef.current || !iframeRef.current?.contentWindow) return;
    dataSentRef.current = true;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'BRUNO_DOCS_PREVIEW',
        collection,
        settings: {
          show_examples: settings?.show_examples !== false,
          show_auth: settings?.show_auth !== false,
          custom_css: settings?.custom_css || null,
          custom_logo_url: settings?.custom_logo_url || null
        }
      },
      '*'
    );
  }, [collection, settings]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'BRUNO_DOCS_PREVIEW_READY') {
        sendPreviewData();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendPreviewData]);

  // Fallback: also send on iframe load event in case READY fires before we listen
  const handleIframeLoad = useCallback(() => {
    // Small delay to let the React app mount and register its listener
    setTimeout(sendPreviewData, 200);
  }, [sendPreviewData]);

  return (
    <StyledWrapper>
      <div className="preview-overlay" onClick={onClose}>
        <div className="preview-container" onClick={(e) => e.stopPropagation()}>
          <div className="preview-header">
            <div className="preview-title">
              <span className="preview-badge">{t('PREVIEW_MODAL.badge')}</span>
              <h2>{t('PREVIEW_MODAL.title')}</h2>
            </div>
            <div className="preview-actions">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="open-btn"
                title={t('PREVIEW_MODAL.openInNewTab')}
              >
                <IconExternalLink size={16} />
              </a>
              <button onClick={onClose} className="close-btn" title={t('PREVIEW_MODAL.closePreview')}>
                <IconX size={20} />
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="preview-iframe"
            title={t('PREVIEW_MODAL.title')}
            onLoad={handleIframeLoad}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
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
    background: ${({ theme }) => theme.colors.sidebar.bg};
    border-radius: ${({ theme }) => theme.border.radius.lg};
    width: 100%;
    max-width: 1400px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  }

  .preview-title {
    display: flex;
    align-items: center;
    gap: 10px;

    h2 {
      margin: 0;
      font-size: ${({ theme }) => theme.font.size.md};
      font-weight: 600;
      color: ${({ theme }) => theme.colors.text.primary};
    }
  }

  .preview-badge {
    background: ${({ theme }) => theme.colors.brand};
    color: white;
    padding: 3px 8px;
    border-radius: ${({ theme }) => theme.border.radius.sm};
    font-size: ${({ theme }) => theme.font.size.xs};
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .preview-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .open-btn,
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: ${({ theme }) => theme.colors.background.subtle};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    cursor: pointer;
    color: ${({ theme }) => theme.colors.text.secondary};
    transition: background-color ${({ theme }) => theme.transition.fast};
    text-decoration: none;

    &:hover {
      background: ${({ theme }) => theme.colors.background.hover};
      color: ${({ theme }) => theme.colors.text.primary};
    }
  }

  .preview-iframe {
    flex: 1;
    width: 100%;
    border: none;
    background: ${({ theme }) => theme.colors.sidebar.bg};
  }
`;

export default PreviewModal;
