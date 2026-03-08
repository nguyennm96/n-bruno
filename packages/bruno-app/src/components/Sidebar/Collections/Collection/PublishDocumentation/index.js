import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from 'components/Modal';
import {
  IconCheck, IconCopy, IconLoader2, IconExternalLink,
  IconGlobe, IconLock, IconUsers, IconEye,
  IconUserCheck, IconClock, IconPlayerPlay, IconUpload,
  IconTrash
} from '@tabler/icons';
import toast from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';
import PreviewModal from './PreviewModal';
import Skeleton from 'ui/Skeleton';
import { getBrunoApi } from 'services/brunoApi';
import { transformCollectionToSaveToExportAsFile } from 'utils/collections';
import { cloneDeep } from 'lodash';

const PublishDocumentation = ({ onClose, collectionUid, collection }) => {
  const { t } = useTranslation();
  const [statusLoading, setStatusLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [docsStatus, setDocsStatus] = useState(null);

  // Form state
  const [activeTab, setActiveTab] = useState('settings');
  const [visibility, setVisibility] = useState('public');
  const [password, setPassword] = useState('');
  const [showExamples, setShowExamples] = useState(true);
  const [showAuth, setShowAuth] = useState(true);

  // Branding
  const [customCssName, setCustomCssName] = useState('');
  const [customCssContent, setCustomCssContent] = useState('');
  const [customLogo, setCustomLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingCss, setUploadingCss] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Slug (only pre-publish)
  const [customSlug, setCustomSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // UI state
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  // ── Load current docs status ────────────────────────────────
  useEffect(() => {
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const api = getBrunoApi();
        if (!api) return;
        const status = await api.collections.getDocsStatus(collectionUid);
        setDocsStatus(status);

        if (status.enabled) {
          // Pre-fill form from saved settings
          setVisibility(status.visibility_type ?? 'public');
          setShowExamples(status.settings?.show_examples !== false);
          setShowAuth(status.settings?.show_auth !== false);
          if (status.settings?.custom_logo_url) {
            setLogoPreview(status.settings.custom_logo_url);
            setCustomLogo('uploaded');
          }
          if (status.settings?.custom_css) {
            setCustomCssName('Custom CSS applied');
            setCustomCssContent(status.settings.custom_css);
          }
        }
      } catch (error) {
        console.error('Failed to load docs status:', error);
      } finally {
        setStatusLoading(false);
      }
    };

    loadStatus();
  }, [collectionUid]);

  // ── Publish ──────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error(t('COLLECTION.PUBLISH_DOCS.API_NOT_INIT')); return;
      }

      let visibilityData;
      if (visibility === 'public') {
        visibilityData = { type: 'public' };
      } else if (visibility === 'password') {
        if (!password) {
          toast.error(t('COLLECTION.PUBLISH_DOCS.PASSWORD_REQUIRED'));
          setLoading(false);
          return;
        }
        visibilityData = { type: 'password', hash: password };
      } else if (visibility === 'workspaceMembers') {
        visibilityData = { type: 'workspaceMembers' };
      }

      const publishData = {
        visibility: visibilityData,
        settings: { show_examples: showExamples, show_auth: showAuth }
      };
      if (customSlug.trim()) {
        publishData.custom_slug = customSlug.trim();
      }

      const result = await api.collections.publishDocs(collectionUid, publishData);
      setDocsStatus({ enabled: true, slug: result.slug, public_url: result.public_url, published_at: result.published_at });
      toast.success(t('COLLECTION.PUBLISH_DOCS.PUBLISH_SUCCESS'));
    } catch (error) {
      console.error('Failed to publish docs:', error);
      toast.error(error.response?.data?.message || t('COLLECTION.PUBLISH_DOCS.PUBLISH_FAILED'));
    } finally {
      setLoading(false);
    }
  }, [collectionUid, visibility, password, showExamples, showAuth, customSlug]);

  // ── Update ───────────────────────────────────────────────────
  const handleUpdate = useCallback(async () => {
    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error(t('COLLECTION.PUBLISH_DOCS.API_NOT_INIT')); return;
      }

      let visibilityData;
      if (visibility === 'public') {
        visibilityData = { type: 'public' };
      } else if (visibility === 'password') {
        if (!password) {
          toast.error(t('COLLECTION.PUBLISH_DOCS.PASSWORD_REQUIRED'));
          setLoading(false);
          return;
        }
        visibilityData = { type: 'password', hash: password };
      } else if (visibility === 'workspaceMembers') {
        visibilityData = { type: 'workspaceMembers' };
      }

      await api.collections.updateDocs(collectionUid, {
        visibility: visibilityData,
        settings: { show_examples: showExamples, show_auth: showAuth }
      });
      toast.success(t('COLLECTION.PUBLISH_DOCS.UPDATE_SUCCESS'));
    } catch (error) {
      console.error('Failed to update docs:', error);
      toast.error(error.response?.data?.message || t('COLLECTION.PUBLISH_DOCS.UPDATE_FAILED'));
    } finally {
      setLoading(false);
    }
  }, [collectionUid, visibility, password, showExamples, showAuth]);

  // ── Unpublish ────────────────────────────────────────────────
  const handleUnpublish = useCallback(async () => {
    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error(t('COLLECTION.PUBLISH_DOCS.API_NOT_INIT')); return;
      }
      await api.collections.unpublishDocs(collectionUid);
      setDocsStatus({ enabled: false });
      setShowUnpublishConfirm(false);
      toast.success(t('COLLECTION.PUBLISH_DOCS.UNPUBLISH_SUCCESS'));
      onClose();
    } catch (error) {
      console.error('Failed to unpublish docs:', error);
      toast.error(error.response?.data?.message || t('COLLECTION.PUBLISH_DOCS.UNPUBLISH_FAILED'));
    } finally {
      setLoading(false);
    }
  }, [collectionUid, onClose]);

  const copyUrl = useCallback(() => {
    if (docsStatus?.public_url) {
      navigator.clipboard.writeText(docsStatus.public_url);
      setCopied(true);
      toast.success(t('COLLECTION.PUBLISH_DOCS.URL_COPIED'));
      setTimeout(() => setCopied(false), 2000);
    }
  }, [docsStatus]);

  const openDocs = useCallback(() => {
    if (docsStatus?.public_url) {
      window.open(docsStatus.public_url, '_blank');
    }
  }, [docsStatus]);

  // ── CSS Upload ────────────────────────────────────────────────
  const handleCssUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.css')) {
      toast.error(t('COLLECTION.PUBLISH_DOCS.CSS_INVALID_TYPE')); return;
    }
    if (file.size > 100 * 1024) {
      toast.error(t('COLLECTION.PUBLISH_DOCS.CSS_TOO_LARGE')); return;
    }

    // Read content for preview
    const reader = new FileReader();
    reader.onloadend = () => setCustomCssContent(reader.result);
    reader.readAsText(file);

    setUploadingCss(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error(t('COLLECTION.PUBLISH_DOCS.API_NOT_INIT')); return;
      }
      const formData = new FormData();
      formData.append('css', file);
      await api.client.getClient().post(
        `/api/collections/${collectionUid}/docs/upload-css`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setCustomCssName(file.name);
      toast.success(t('COLLECTION.PUBLISH_DOCS.CSS_UPLOAD_SUCCESS'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('COLLECTION.PUBLISH_DOCS.CSS_UPLOAD_FAILED'));
    } finally {
      setUploadingCss(false);
    }
  }, [collectionUid]);

  // ── Logo Upload ───────────────────────────────────────────────
  const handleLogoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('COLLECTION.PUBLISH_DOCS.LOGO_INVALID_TYPE')); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('COLLECTION.PUBLISH_DOCS.LOGO_TOO_LARGE')); return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error(t('COLLECTION.PUBLISH_DOCS.API_NOT_INIT')); return;
      }
      const formData = new FormData();
      formData.append('logo', file);
      await api.client.getClient().post(
        `/api/collections/${collectionUid}/docs/upload-logo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setCustomLogo(file.name);
      toast.success(t('COLLECTION.PUBLISH_DOCS.LOGO_UPLOAD_SUCCESS'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('COLLECTION.PUBLISH_DOCS.LOGO_UPLOAD_FAILED'));
    } finally {
      setUploadingLogo(false);
    }
  }, [collectionUid]);

  const removeCss = useCallback(async () => {
    try {
      const api = getBrunoApi();
      await api.client.getClient().delete(`/api/collections/${collectionUid}/docs/custom-css`);
      setCustomCssName('');
      setCustomCssContent('');
      toast.success(t('COLLECTION.PUBLISH_DOCS.CSS_REMOVED'));
    } catch { toast.error(t('COLLECTION.PUBLISH_DOCS.CSS_REMOVE_FAILED')); }
  }, [collectionUid]);

  const removeLogo = useCallback(async () => {
    try {
      const api = getBrunoApi();
      await api.client.getClient().delete(`/api/collections/${collectionUid}/docs/custom-logo`);
      setCustomLogo(null);
      setLogoPreview(null);
      toast.success(t('COLLECTION.PUBLISH_DOCS.LOGO_REMOVED'));
    } catch { toast.error(t('COLLECTION.PUBLISH_DOCS.LOGO_REMOVE_FAILED')); }
  }, [collectionUid]);

  // ── Slug check ────────────────────────────────────────────────
  const checkSlugAvailability = useCallback(async (slug) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null); return;
    }
    setCheckingSlug(true);
    try {
      const api = getBrunoApi();
      const response = await api.client.getClient().get(
        `/api/collections/docs/check-slug/${encodeURIComponent(slug)}`
      );
      setSlugAvailable(response.data.available);
    } catch { setSlugAvailable(null); } finally { setCheckingSlug(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (customSlug) checkSlugAvailability(customSlug); }, 500);
    return () => clearTimeout(timer);
  }, [customSlug, checkSlugAvailability]);

  // ── Preview ───────────────────────────────────────────────────
  const handlePreview = useCallback(() => {
    try {
      const collectionCopy = cloneDeep(collection);
      const transformedCollection = transformCollectionToSaveToExportAsFile(collectionCopy);
      setPreviewData({
        collection: transformedCollection,
        settings: {
          show_examples: showExamples,
          show_auth: showAuth,
          custom_css: customCssContent || null,
          custom_logo_url: logoPreview || null
        }
      });
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error(t('COLLECTION.PUBLISH_DOCS.PREVIEW_FAILED'));
    }
  }, [collection, showExamples, showAuth, customCssContent, logoPreview]);

  // ── Helpers ───────────────────────────────────────────────────
  const isPublished = docsStatus?.enabled;
  const publishedAt = docsStatus?.published_at
    ? new Date(docsStatus.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <>
      {showPreview && previewData && (
        <PreviewModal
          collection={previewData.collection}
          settings={previewData.settings}
          onClose={() => setShowPreview(false)}
        />
      )}

      <Modal
        size="md"
        title={isPublished ? t('COLLECTION.PUBLISH_DOCS.TITLE_MANAGE') : t('COLLECTION.PUBLISH_DOCS.TITLE_PUBLISH')}
        confirmText={isPublished ? t('COLLECTION.PUBLISH_DOCS.SAVE_CHANGES') : t('COLLECTION.PUBLISH_DOCS.PUBLISH')}
        cancelText={isPublished ? t('COLLECTION.PUBLISH_DOCS.CLOSE') : t('COLLECTION.PUBLISH_DOCS.CANCEL')}
        handleConfirm={isPublished ? handleUpdate : handlePublish}
        handleCancel={onClose}
        disableConfirm={loading || statusLoading}
      >
        <StyledWrapper className="w-[560px]">

          {statusLoading ? (
            <div className="skeleton-row">
              <Skeleton height="36px" />
              <Skeleton height="22px" width="60%" />
              <Skeleton height="80px" />
              <Skeleton height="80px" />
              <Skeleton height="80px" />
            </div>
          ) : (
            <>
              {/* ── Published Status Bar ─── */}
              {isPublished && (
                <div className="published-bar">
                  <span className="published-dot" />
                  <span className="published-label">{t('COLLECTION.PUBLISH_DOCS.LIVE')}</span>
                  {publishedAt && <span className="published-date">{t('COLLECTION.PUBLISH_DOCS.PUBLISHED_DATE', { date: publishedAt })}</span>}
                </div>
              )}

              {/* ── Public URL ─── */}
              {isPublished && docsStatus.public_url && (
                <div className="public-url-section mb-4">
                  <label className="section-label">{t('COLLECTION.PUBLISH_DOCS.PUBLIC_URL')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={docsStatus.public_url}
                      readOnly
                    />
                    <button onClick={copyUrl} className="btn-icon" title={t('COLLECTION.PUBLISH_DOCS.COPY_URL')}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </button>
                    <button onClick={openDocs} className="btn-icon" title={t('COLLECTION.PUBLISH_DOCS.OPEN_NEW_TAB')}>
                      <IconExternalLink size={16} />
                    </button>
                  </div>
                  {docsStatus.slug && (
                    <div className="slug-display">
                      <span className="slug-label">{t('COLLECTION.PUBLISH_DOCS.SLUG_LABEL')}</span>
                      <span className="slug-value">{docsStatus.slug}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Bar ─── */}
              <div className="tab-bar">
                <button
                  className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  {t('COLLECTION.PUBLISH_DOCS.SETTINGS_TAB')}
                </button>
                <button
                  className={`tab-btn ${activeTab === 'branding' ? 'active' : ''}`}
                  onClick={() => setActiveTab('branding')}
                >
                  {t('COLLECTION.PUBLISH_DOCS.BRANDING_TAB')}
                </button>
                {isPublished && (
                  <button
                    className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                  >
                    {t('COLLECTION.PUBLISH_DOCS.ANALYTICS_TAB')}
                  </button>
                )}
              </div>

              {/* ── Settings Tab ─── */}
              {activeTab === 'settings' && (
                <>
                  {/* Custom Slug (only pre-publish) */}
                  {!isPublished && (
                    <div className="slug-section mb-4">
                      <label className="section-label">{t('COLLECTION.PUBLISH_DOCS.CUSTOM_SLUG_LABEL')}</label>
                      <div className="slug-input-wrapper">
                        <input
                          type="text"
                          placeholder={t('COLLECTION.PUBLISH_DOCS.SLUG_PLACEHOLDER')}
                          value={customSlug}
                          onChange={(e) => setCustomSlug(e.target.value)}
                          className="slug-input"
                        />
                        {checkingSlug && (
                          <span className="slug-status checking">
                            <IconLoader2 size={14} />
                            {t('COLLECTION.PUBLISH_DOCS.CHECKING')}
                          </span>
                        )}
                        {!checkingSlug && slugAvailable === true && customSlug && (
                          <span className="slug-status available">
                            <IconCheck size={14} /> {t('COLLECTION.PUBLISH_DOCS.AVAILABLE')}
                          </span>
                        )}
                        {!checkingSlug && slugAvailable === false && customSlug && (
                          <span className="slug-status taken">✗ {t('COLLECTION.PUBLISH_DOCS.TAKEN')}</span>
                        )}
                      </div>
                      <p className="field-hint">{t('COLLECTION.PUBLISH_DOCS.SLUG_HINT')}</p>
                    </div>
                  )}

                  {/* Visibility */}
                  <div className="visibility-section mb-4">
                    <label className="section-label">{t('COLLECTION.PUBLISH_DOCS.VISIBILITY_LABEL')}</label>
                    <div className="space-y-2">
                      {[
                        { value: 'public', icon: <IconGlobe size={16} />, label: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_PUBLIC'), desc: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_PUBLIC_DESC') },
                        { value: 'password', icon: <IconLock size={16} />, label: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_PASSWORD'), desc: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_PASSWORD_DESC') },
                        { value: 'workspaceMembers', icon: <IconUsers size={16} />, label: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_WORKSPACE'), desc: t('COLLECTION.PUBLISH_DOCS.VISIBILITY_WORKSPACE_DESC') }
                      ].map(({ value, icon, label, desc }) => (
                        <label key={value} className={`visibility-option ${visibility === value ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="visibility"
                            value={value}
                            checked={visibility === value}
                            onChange={(e) => setVisibility(e.target.value)}
                          />
                          <div className="flex items-center gap-2">
                            {icon}
                            <div>
                              <div className="option-name">{label}</div>
                              <div className="option-desc">{desc}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {visibility === 'password' && (
                      <div className="mt-3 ml-7">
                        <input
                          type="password"
                          placeholder={isPublished ? t('COLLECTION.PUBLISH_DOCS.PASSWORD_PLACEHOLDER_CHANGE') : t('COLLECTION.PUBLISH_DOCS.PASSWORD_PLACEHOLDER')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Content Settings */}
                  <div className="settings-section mb-4">
                    <label className="section-label">{t('COLLECTION.PUBLISH_DOCS.CONTENT_SETTINGS')}</label>
                    <div className="space-y-1">
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={showExamples}
                          onChange={(e) => setShowExamples(e.target.checked)}
                        />
                        <span>{t('COLLECTION.PUBLISH_DOCS.SHOW_EXAMPLES')}</span>
                      </label>
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={showAuth}
                          onChange={(e) => setShowAuth(e.target.checked)}
                        />
                        <span>{t('COLLECTION.PUBLISH_DOCS.SHOW_AUTH')}</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* ── Branding Tab ─── */}
              {activeTab === 'branding' && (
                <div className="branding-section">
                  {/* Custom Logo */}
                  <div className="upload-field">
                    <span className="field-label">{t('COLLECTION.PUBLISH_DOCS.CUSTOM_LOGO')}</span>
                    <p className="field-hint">{t('COLLECTION.PUBLISH_DOCS.CUSTOM_LOGO_HINT')}</p>
                    <div className="upload-row">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="file-input"
                        id="logo-upload"
                      />
                      <label htmlFor="logo-upload" className="btn-upload" style={{ cursor: uploadingLogo ? 'not-allowed' : 'pointer' }}>
                        {uploadingLogo ? <IconLoader2 size={14} className="animate-spin" /> : <><IconUpload size={14} /> {t('COLLECTION.PUBLISH_DOCS.UPLOAD_LOGO')}</>}
                      </label>
                      {logoPreview && (
                        <>
                          <img src={logoPreview} alt={t('COLLECTION.PUBLISH_DOCS.LOGO_PREVIEW_ALT')} className="logo-preview" />
                          <span className="status-text"><IconCheck size={12} /> {t('COLLECTION.PUBLISH_DOCS.LOGO_SET')}</span>
                          <button onClick={removeLogo} className="btn-remove">{t('COLLECTION.PUBLISH_DOCS.REMOVE')}</button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Custom CSS */}
                  <div className="upload-field">
                    <span className="field-label">{t('COLLECTION.PUBLISH_DOCS.CUSTOM_CSS')}</span>
                    <p className="field-hint">{t('COLLECTION.PUBLISH_DOCS.CUSTOM_CSS_HINT')}</p>
                    <div className="upload-row">
                      <input
                        type="file"
                        accept=".css"
                        onChange={handleCssUpload}
                        disabled={uploadingCss}
                        className="file-input"
                        id="css-upload"
                      />
                      <label htmlFor="css-upload" className="btn-upload" style={{ cursor: uploadingCss ? 'not-allowed' : 'pointer' }}>
                        {uploadingCss ? <IconLoader2 size={14} className="animate-spin" /> : <><IconUpload size={14} /> {t('COLLECTION.PUBLISH_DOCS.UPLOAD_CSS')}</>}
                      </label>
                      {customCssName && (
                        <>
                          <span className="status-text"><IconCheck size={12} /> {customCssName}</span>
                          <button onClick={removeCss} className="btn-remove">{t('COLLECTION.PUBLISH_DOCS.REMOVE')}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Analytics Tab ─── */}
              {activeTab === 'analytics' && isPublished && docsStatus?.analytics && (
                <div className="analytics-section">
                  <div className="analytics-cards">
                    <div className="analytics-card">
                      <div className="analytics-icon"><IconEye size={16} /></div>
                      <div>
                        <div className="analytics-label">{t('COLLECTION.PUBLISH_DOCS.TOTAL_VIEWS')}</div>
                        <div className="analytics-value">{docsStatus.analytics.views || 0}</div>
                      </div>
                    </div>
                    <div className="analytics-card">
                      <div className="analytics-icon"><IconUserCheck size={16} /></div>
                      <div>
                        <div className="analytics-label">{t('COLLECTION.PUBLISH_DOCS.UNIQUE_VISITORS')}</div>
                        <div className="analytics-value">{docsStatus.analytics.unique_visitors || 0}</div>
                      </div>
                    </div>
                    {docsStatus.analytics.last_viewed && (
                      <div className="analytics-card full-width">
                        <div className="analytics-icon"><IconClock size={16} /></div>
                        <div>
                          <div className="analytics-label">{t('COLLECTION.PUBLISH_DOCS.LAST_VIEWED')}</div>
                          <div className="analytics-value-sm">
                            {new Date(docsStatus.analytics.last_viewed).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Preview Button ─── */}
              <div className="preview-section mt-4">
                <button onClick={handlePreview} className="btn-preview">
                  <IconPlayerPlay size={15} />
                  {t('COLLECTION.PUBLISH_DOCS.PREVIEW')}
                </button>
                <p className="preview-hint">{t('COLLECTION.PUBLISH_DOCS.PREVIEW_HINT')}</p>
              </div>

              {/* ── Unpublish ─── */}
              {isPublished && (
                <div className="unpublish-section mt-3">
                  {!showUnpublishConfirm ? (
                    <button
                      onClick={() => setShowUnpublishConfirm(true)}
                      disabled={loading}
                      className="btn-danger"
                    >
                      <IconTrash size={15} />
                      {t('COLLECTION.PUBLISH_DOCS.UNPUBLISH')}
                    </button>
                  ) : (
                    <div className="confirm-box">
                      <p>
                        <strong>{t('COLLECTION.PUBLISH_DOCS.UNPUBLISH_CONFIRM_TITLE')}</strong><br />
                        {t('COLLECTION.PUBLISH_DOCS.UNPUBLISH_CONFIRM_DESC')}
                      </p>
                      <div className="confirm-actions">
                        <button
                          onClick={handleUnpublish}
                          disabled={loading}
                          className="btn-confirm-danger"
                        >
                          {loading ? <IconLoader2 size={14} /> : t('COLLECTION.PUBLISH_DOCS.YES_UNPUBLISH')}
                        </button>
                        <button
                          onClick={() => setShowUnpublishConfirm(false)}
                          className="btn-cancel"
                        >
                          {t('COLLECTION.PUBLISH_DOCS.CANCEL')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </StyledWrapper>
      </Modal>
    </>
  );
};

export default PublishDocumentation;
