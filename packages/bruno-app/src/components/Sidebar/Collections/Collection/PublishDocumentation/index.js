import React, { useState, useEffect, useCallback } from 'react';
import Modal from 'components/Modal';
import { IconBook, IconCheck, IconCopy, IconLoader2, IconExternalLink, IconGlobe, IconLock, IconUsers, IconChartLine, IconEye, IconUserCheck, IconClock, IconPlayerPlay } from '@tabler/icons';
import toast from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';
import PreviewModal from './PreviewModal';
import { getBrunoApi } from 'services/brunoApi';
import { brunoToOpenCollection } from '@usebruno/converters';
import { transformCollectionToSaveToExportAsFile } from 'utils/collections';
import { cloneDeep } from 'lodash';

const PublishDocumentation = ({ onClose, collectionUid, collection }) => {
  const [loading, setLoading] = useState(false);
  const [docsStatus, setDocsStatus] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [password, setPassword] = useState('');
  const [showExamples, setShowExamples] = useState(true);
  const [showAuth, setShowAuth] = useState(true);
  const [copied, setCopied] = useState(false);
  const [customCss, setCustomCss] = useState('');
  const [customLogo, setCustomLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingCss, setUploadingCss] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Load current docs status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const api = getBrunoApi();
        if (!api) {
          toast.error('Bruno Cloud API not initialized');
          return;
        }

        const status = await api.collections.getDocsStatus(collectionUid);
        setDocsStatus(status);

        // Set initial form values if docs are already published
        if (status.enabled) {
          // We can't pre-fill password as it's hashed
          setShowExamples(true); // Default to true
          setShowAuth(true);
        }
      } catch (error) {
        console.error('Failed to load docs status:', error);
      }
    };

    loadStatus();
  }, [collectionUid]);

  const handlePublish = useCallback(async () => {
    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error('Bruno Cloud API not initialized');
        return;
      }

      // Build visibility object
      let visibilityData;
      if (visibility === 'public') {
        visibilityData = { type: 'public' };
      } else if (visibility === 'password') {
        if (!password) {
          toast.error('Password is required for password-protected docs');
          setLoading(false);
          return;
        }
        visibilityData = { type: 'password', hash: password }; // Backend will hash it
      } else if (visibility === 'workspaceMembers') {
        visibilityData = { type: 'workspaceMembers' };
      }

      const settings = {
        show_examples: showExamples,
        show_auth: showAuth
      };

      const publishData = {
        visibility: visibilityData,
        settings
      };

      // Add custom slug if provided
      if (customSlug && customSlug.trim()) {
        publishData.custom_slug = customSlug.trim();
      }

      const result = await api.collections.publishDocs(collectionUid, publishData);

      setDocsStatus({
        enabled: true,
        slug: result.slug,
        public_url: result.public_url
      });

      toast.success('Documentation published successfully!');
    } catch (error) {
      console.error('Failed to publish docs:', error);
      toast.error(error.response?.data?.message || 'Failed to publish documentation');
    } finally {
      setLoading(false);
    }
  }, [collectionUid, visibility, password, showExamples, showAuth]);

  const handleUpdate = useCallback(async () => {
    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error('Bruno Cloud API not initialized');
        return;
      }

      // Build visibility object
      let visibilityData;
      if (visibility === 'public') {
        visibilityData = { type: 'public' };
      } else if (visibility === 'password') {
        if (!password) {
          toast.error('Password is required for password-protected docs');
          setLoading(false);
          return;
        }
        visibilityData = { type: 'password', hash: password };
      } else if (visibility === 'workspaceMembers') {
        visibilityData = { type: 'workspaceMembers' };
      }

      const settings = {
        show_examples: showExamples,
        show_auth: showAuth
      };

      await api.collections.updateDocs(collectionUid, {
        visibility: visibilityData,
        settings
      });

      toast.success('Documentation updated successfully!');
    } catch (error) {
      console.error('Failed to update docs:', error);
      toast.error(error.response?.data?.message || 'Failed to update documentation');
    } finally {
      setLoading(false);
    }
  }, [collectionUid, visibility, password, showExamples, showAuth]);

  const handleUnpublish = useCallback(async () => {
    if (!confirm('Are you sure you want to unpublish this documentation? The public URL will no longer work.')) {
      return;
    }

    setLoading(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error('Bruno Cloud API not initialized');
        return;
      }

      await api.collections.unpublishDocs(collectionUid);
      setDocsStatus({ enabled: false });
      toast.success('Documentation unpublished successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to unpublish docs:', error);
      toast.error(error.response?.data?.message || 'Failed to unpublish documentation');
    } finally {
      setLoading(false);
    }
  }, [collectionUid, onClose]);

  const copyUrl = useCallback(() => {
    if (docsStatus?.public_url) {
      navigator.clipboard.writeText(docsStatus.public_url);
      setCopied(true);
      toast.success('URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [docsStatus]);

  const openDocs = useCallback(() => {
    if (docsStatus?.public_url) {
      window.open(docsStatus.public_url, '_blank');
    }
  }, [docsStatus]);

  const handleCssUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.css')) {
      toast.error('Please upload a CSS file');
      return;
    }

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      toast.error('CSS file too large (max 100KB)');
      return;
    }

    setUploadingCss(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error('Bruno Cloud API not initialized');
        return;
      }

      const formData = new FormData();
      formData.append('css', file);

      // Use axios directly for multipart upload
      const response = await api.client.getClient().post(
        `/api/collections/${collectionUid}/docs/upload-css`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setCustomCss(file.name);
      toast.success('Custom CSS uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload CSS:', error);
      toast.error(error.response?.data?.message || 'Failed to upload CSS');
    } finally {
      setUploadingCss(false);
    }
  }, [collectionUid]);

  const handleLogoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo too large (max 2MB)');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const api = getBrunoApi();
      if (!api) {
        toast.error('Bruno Cloud API not initialized');
        return;
      }

      const formData = new FormData();
      formData.append('logo', file);

      // Use axios directly for multipart upload
      await api.client.getClient().post(
        `/api/collections/${collectionUid}/docs/upload-logo`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setCustomLogo(file.name);
      toast.success('Custom logo uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload logo:', error);
      toast.error(error.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }, [collectionUid]);

  const removeCss = useCallback(async () => {
    try {
      const api = getBrunoApi();
      await api.client.getClient().delete(`/api/collections/${collectionUid}/docs/custom-css`);
      setCustomCss('');
      toast.success('Custom CSS removed');
    } catch (error) {
      toast.error('Failed to remove CSS');
    }
  }, [collectionUid]);

  const removeLogo = useCallback(async () => {
    try {
      const api = getBrunoApi();
      await api.client.getClient().delete(`/api/collections/${collectionUid}/docs/custom-logo`);
      setCustomLogo(null);
      setLogoPreview(null);
      toast.success('Custom logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    }
  }, [collectionUid]);

  // Check slug availability
  const checkSlugAvailability = useCallback(async (slug) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    try {
      const api = getBrunoApi();
      const response = await api.client.getClient().get(
        `/api/collections/docs/check-slug/${encodeURIComponent(slug)}`
      );
      setSlugAvailable(response.data.available);
    } catch (error) {
      console.error('Failed to check slug:', error);
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  }, []);

  // Debounced slug check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customSlug) {
        checkSlugAvailability(customSlug);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customSlug, checkSlugAvailability]);

  // Handle preview
  const handlePreview = useCallback(() => {
    try {
      // Convert collection to OpenCollection format
      const collectionCopy = cloneDeep(collection);
      const transformedCollection = transformCollectionToSaveToExportAsFile(collectionCopy);
      const openCollection = brunoToOpenCollection(transformedCollection);

      // Prepare settings
      const previewSettings = {
        show_examples: showExamples,
        show_auth: showAuth,
        custom_css: customCss,
        custom_logo_url: logoPreview
      };

      setPreviewData({
        collection: openCollection,
        settings: previewSettings
      });
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      toast.error('Failed to generate preview');
    }
  }, [collection, showExamples, showAuth, customCss, logoPreview]);

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
        title={`${docsStatus?.enabled ? 'Update' : 'Publish'} Documentation`}
        confirmText={docsStatus?.enabled ? 'Update' : 'Publish'}
        cancelText={docsStatus?.enabled ? 'Close' : 'Cancel'}
        handleConfirm={docsStatus?.enabled ? handleUpdate : handlePublish}
        handleCancel={onClose}
        disableConfirm={loading}
      >
        <StyledWrapper className="w-[550px]">
          {/* Public URL Display (if published) */}
          {docsStatus?.enabled && docsStatus?.public_url && (
            <div className="public-url-section mb-4">
              <label className="block text-sm font-medium mb-2">Public URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={docsStatus.public_url}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
                <button
                  onClick={copyUrl}
                  className="btn-icon"
                  title="Copy URL"
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </button>
                <button
                  onClick={openDocs}
                  className="btn-icon"
                  title="Open in new tab"
                >
                  <IconExternalLink size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Analytics Section (if published) */}
          {docsStatus?.enabled && docsStatus?.analytics && (
            <div className="analytics-section mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Analytics</label>
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <IconChartLine size={12} />
                  {showAnalytics ? 'Hide' : 'Show'} Details
                </button>
              </div>

              {showAnalytics && (
                <div className="analytics-cards">
                  <div className="analytics-card">
                    <div className="analytics-icon">
                      <IconEye size={16} />
                    </div>
                    <div className="analytics-content">
                      <div className="analytics-label">Total Views</div>
                      <div className="analytics-value">{docsStatus.analytics.views || 0}</div>
                    </div>
                  </div>

                  <div className="analytics-card">
                    <div className="analytics-icon">
                      <IconUserCheck size={16} />
                    </div>
                    <div className="analytics-content">
                      <div className="analytics-label">Unique Visitors</div>
                      <div className="analytics-value">{docsStatus.analytics.unique_visitors || 0}</div>
                    </div>
                  </div>

                  {docsStatus.analytics.last_viewed && (
                    <div className="analytics-card full-width">
                      <div className="analytics-icon">
                        <IconClock size={16} />
                      </div>
                      <div className="analytics-content">
                        <div className="analytics-label">Last Viewed</div>
                        <div className="analytics-value-sm">
                          {new Date(docsStatus.analytics.last_viewed).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Slug (only when not published yet) */}
          {!docsStatus?.enabled && (
            <div className="slug-section mb-4">
              <label className="block text-sm font-medium mb-2">
                Custom URL Slug (Optional)
              </label>
              <div className="slug-input-wrapper">
                <input
                  type="text"
                  placeholder="my-awesome-api"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="slug-input"
                />
                {checkingSlug && (
                  <span className="slug-status checking">
                    <IconLoader2 size={14} className="animate-spin" />
                    Checking...
                  </span>
                )}
                {!checkingSlug && slugAvailable === true && customSlug && (
                  <span className="slug-status available">
                    <IconCheck size={14} />
                    Available
                  </span>
                )}
                {!checkingSlug && slugAvailable === false && customSlug && (
                  <span className="slug-status taken">
                    ✗ Already taken
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate from collection name. Letters, numbers, and hyphens only.
              </p>
            </div>
          )}

          {/* Visibility Settings */}
          <div className="visibility-section mb-4">
            <label className="block text-sm font-medium mb-2">
              Who can access this documentation?
            </label>

            <div className="space-y-2">
              <label className="visibility-option">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === 'public'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <IconGlobe size={16} />
                  <div>
                    <div className="font-medium">Public</div>
                    <div className="text-xs text-gray-500">Anyone with the link can view</div>
                  </div>
                </div>
              </label>

              <label className="visibility-option">
                <input
                  type="radio"
                  name="visibility"
                  value="password"
                  checked={visibility === 'password'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <IconLock size={16} />
                  <div>
                    <div className="font-medium">Password Protected</div>
                    <div className="text-xs text-gray-500">Requires password to access</div>
                  </div>
                </div>
              </label>

              {visibility === 'password' && (
                <div className="ml-8 mt-2">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              )}

              <label className="visibility-option">
                <input
                  type="radio"
                  name="visibility"
                  value="workspaceMembers"
                  checked={visibility === 'workspaceMembers'}
                  onChange={(e) => setVisibility(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <IconUsers size={16} />
                  <div>
                    <div className="font-medium">Workspace Members Only</div>
                    <div className="text-xs text-gray-500">Only workspace members can view</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Documentation Settings */}
          <div className="settings-section mb-4">
            <label className="block text-sm font-medium mb-2">Documentation Settings</label>

            <div className="space-y-2">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={showExamples}
                  onChange={(e) => setShowExamples(e.target.checked)}
                />
                <span>Show example requests/responses</span>
              </label>

              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={showAuth}
                  onChange={(e) => setShowAuth(e.target.checked)}
                />
                <span>Show authentication details</span>
              </label>
            </div>
          </div>

          {/* Custom Branding Section */}
          <div className="branding-section mb-4">
            <label className="block text-sm font-medium mb-2">Custom Branding (Optional)</label>

            <div className="space-y-3">
              {/* Custom CSS Upload */}
              <div className="upload-field">
                <label className="text-sm text-gray-600">Custom CSS</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="file"
                    accept=".css"
                    onChange={handleCssUpload}
                    disabled={uploadingCss}
                    className="file-input"
                    id="css-upload"
                  />
                  <label
                    htmlFor="css-upload"
                    className="btn-upload"
                  >
                    {uploadingCss ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      'Upload CSS'
                    )}
                  </label>
                  {customCss && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600">{customCss}</span>
                      <button
                        onClick={removeCss}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Max 100KB. Override default styles.</p>
              </div>

              {/* Custom Logo Upload */}
              <div className="upload-field">
                <label className="text-sm text-gray-600">Custom Logo</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="file-input"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="btn-upload"
                  >
                    {uploadingLogo ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      'Upload Logo'
                    )}
                  </label>
                  {logoPreview && (
                    <div className="flex items-center gap-2">
                      <img src={logoPreview} alt="Logo preview" className="logo-preview" />
                      <button
                        onClick={removeLogo}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Max 2MB. PNG, JPG, or SVG.</p>
              </div>
            </div>
          </div>

          {/* Preview Button */}
          <div className="preview-section mt-4 pt-4 border-t">
            <button
              onClick={handlePreview}
              className="btn-preview text-sm"
            >
              <IconPlayerPlay size={16} />
              Preview Documentation
            </button>
            <p className="text-xs text-gray-500 mt-2">
              See how your documentation will look before publishing
            </p>
          </div>

          {/* Unpublish Button (if published) */}
          {docsStatus?.enabled && (
            <div className="unpublish-section mt-4 pt-4 border-t">
              <button
                onClick={handleUnpublish}
                disabled={loading}
                className="btn-danger text-sm"
              >
                {loading ? <IconLoader2 size={16} className="animate-spin" /> : 'Unpublish Documentation'}
              </button>
            </div>
          )}
        </StyledWrapper>
      </Modal>
    </>
  );
};

export default PublishDocumentation;
