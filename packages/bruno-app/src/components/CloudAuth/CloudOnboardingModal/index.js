import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { createWorkspace, selectIsCreating } from 'providers/ReduxStore/slices/cloudWorkspaces';
import { setNeedsCloudOnboarding } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';

/**
 * Cloud Onboarding Modal
 * Shown when user logs in for first time and has no workspaces
 */
const CloudOnboardingModal = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isCreating = useSelector(selectIsCreating);

  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [workspaceDesc, setWorkspaceDesc] = useState('');

  const handleCreateWorkspace = async (e) => {
    e?.preventDefault();

    if (!workspaceName.trim()) {
      toast.error(t('CLOUD_ONBOARDING.workspaceNameRequired'));
      return;
    }

    try {
      await dispatch(
        createWorkspace({
          name: workspaceName.trim(),
          description: workspaceDesc.trim() || 'My first cloud workspace'
        })
      ).unwrap();

      // Close onboarding modal
      dispatch(setNeedsCloudOnboarding(false));

      // Success message shown by Redux thunk
      console.log('✅ Workspace created successfully');
    } catch (error) {
      console.error('Failed to create workspace:', error);
      // Error already shown via toast in Redux thunk
    }
  };

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title={t('CLOUD_ONBOARDING.title')} hideFooter={true}>
          <div className="onboarding-content">
            <div className="onboarding-icon">🎉</div>

            <h2>{t('CLOUD_ONBOARDING.letsGetStarted')}</h2>

            <p className="onboarding-description">
              {t('CLOUD_ONBOARDING.cloudReady')}
            </p>

            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label htmlFor="workspace-name">{t('CLOUD_ONBOARDING.workspaceName')}</label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={t('CLOUD_ONBOARDING.workspaceNamePlaceholder')}
                  autoFocus
                  disabled={isCreating}
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workspace-desc">{t('CLOUD_ONBOARDING.workspaceDescLabel')}</label>
                <textarea
                  id="workspace-desc"
                  value={workspaceDesc}
                  onChange={(e) => setWorkspaceDesc(e.target.value)}
                  placeholder={t('CLOUD_ONBOARDING.workspaceDescPlaceholder')}
                  disabled={isCreating}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="button-group">
                <Button
                  type="submit"
                  disabled={isCreating || !workspaceName.trim()}
                  className="primary"
                >
                  {isCreating ? t('CLOUD_ONBOARDING.creatingWorkspace') : t('CLOUD_ONBOARDING.createWorkspace')}
                </Button>
              </div>
            </form>

            <p className="hint">
              {t('CLOUD_ONBOARDING.hint')}
            </p>
          </div>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default CloudOnboardingModal;
