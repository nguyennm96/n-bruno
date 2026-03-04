import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  const dispatch = useDispatch();
  const isCreating = useSelector(selectIsCreating);

  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [workspaceDesc, setWorkspaceDesc] = useState('');

  const handleCreateWorkspace = async (e) => {
    e?.preventDefault();

    if (!workspaceName.trim()) {
      toast.error('Workspace name is required');
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
        <Modal size="md" title="Welcome to Bruno Cloud! ☁️" hideFooter={true}>
          <div className="onboarding-content">
            <div className="onboarding-icon">🎉</div>

            <h2>Let's get you started</h2>

            <p className="onboarding-description">
              Your cloud account is ready! Create your first workspace to start syncing your API collections across devices.
            </p>

            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label htmlFor="workspace-name">Workspace Name</label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., My API, Backend Team, etc."
                  autoFocus
                  disabled={isCreating}
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="workspace-desc">Description (optional)</label>
                <textarea
                  id="workspace-desc"
                  value={workspaceDesc}
                  onChange={(e) => setWorkspaceDesc(e.target.value)}
                  placeholder="e.g., For our REST API project"
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
                  {isCreating ? 'Creating workspace...' : 'Create Workspace'}
                </Button>
              </div>
            </form>

            <p className="hint">
              💡 You can create additional workspaces later from the workspace selector.
            </p>
          </div>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default CloudOnboardingModal;
