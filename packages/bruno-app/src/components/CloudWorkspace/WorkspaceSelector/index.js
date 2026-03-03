import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { IconPlus, IconCloud } from '@tabler/icons';
import {
  fetchWorkspaces,
  createWorkspace,
  linkCollection,
  selectWorkspaces,
  selectIsLoading,
  selectIsCreating,
  selectIsLinking
} from 'providers/ReduxStore/slices/cloudWorkspaces';
import StyledWrapper from './StyledWrapper';

/**
 * Modal to select or create workspace and link collection
 */
const WorkspaceSelector = ({ collectionPath, collectionName, onClose, onSelect }) => {
  const dispatch = useDispatch();
  const workspaces = useSelector(selectWorkspaces);
  const isLoading = useSelector(selectIsLoading);
  const isCreating = useSelector(selectIsCreating);
  const isLinking = useSelector(selectIsLinking);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);

  useEffect(() => {
    // Fetch workspaces on mount
    dispatch(fetchWorkspaces());
  }, [dispatch]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();

    if (!newWorkspaceName.trim()) return;

    try {
      const result = await dispatch(
        createWorkspace({
          name: newWorkspaceName.trim(),
          description: newWorkspaceDesc.trim()
        })
      ).unwrap();

      // Auto-select newly created workspace
      setSelectedWorkspaceId(result.id);
      setShowCreateForm(false);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
    } catch (error) {
      // Error already shown via toast in Redux action
      console.error('Failed to create workspace:', error);
    }
  };

  const handleLinkToWorkspace = async () => {
    if (!selectedWorkspaceId) return;

    try {
      await dispatch(
        linkCollection({
          workspaceId: selectedWorkspaceId,
          collectionPath,
          collectionName
        })
      ).unwrap();

      onSelect?.(selectedWorkspaceId);
      onClose();
    } catch (error) {
      console.error('Failed to link collection:', error);
    }
  };

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title="Link to Cloud Workspace" handleCancel={onClose} hideFooter={true}>
          <div className="workspace-selector-content">
            {!showCreateForm ? (
              <>
                <div className="workspace-list">
                  {isLoading ? (
                    <div className="loading">Loading workspaces...</div>
                  ) : workspaces.length === 0 ? (
                    <div className="empty-state">
                      <IconCloud size={48} strokeWidth={1} className="empty-icon" />
                      <p>No workspaces yet</p>
                      <p className="hint">Create your first workspace to start syncing</p>
                    </div>
                  ) : (
                    workspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className={`workspace-item ${selectedWorkspaceId === workspace.id ? 'selected' : ''}`}
                        onClick={() => setSelectedWorkspaceId(workspace.id)}
                      >
                        <div className="workspace-info">
                          <div className="workspace-name">{workspace.name}</div>
                          {workspace.description && <div className="workspace-desc">{workspace.description}</div>}
                        </div>
                        <div className="workspace-role">{workspace.role}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="actions">
                  <button className="btn btn-secondary" onClick={() => setShowCreateForm(true)} disabled={isCreating}>
                    <IconPlus size={14} strokeWidth={1.5} />
                    <span>Create New Workspace</span>
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleLinkToWorkspace}
                    disabled={!selectedWorkspaceId || isLinking}
                  >
                    {isLinking ? 'Linking...' : 'Link to Workspace'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="create-form">
                <div className="form-group">
                  <label htmlFor="workspace-name" className="form-label">
                    Workspace Name *
                  </label>
                  <input
                    id="workspace-name"
                    type="text"
                    className="form-input"
                    placeholder="My Team Workspace"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="workspace-desc" className="form-label">
                    Description (optional)
                  </label>
                  <textarea
                    id="workspace-desc"
                    className="form-input form-textarea"
                    placeholder="Workspace for our team's API collections"
                    value={newWorkspaceDesc}
                    onChange={(e) => setNewWorkspaceDesc(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn btn-primary" disabled={!newWorkspaceName.trim() || isCreating}>
                    {isCreating ? 'Creating...' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default WorkspaceSelector;
