import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconArrowLeft, IconPlus, IconFolder, IconLock, IconDots, IconCategory, IconLogin, IconUsers } from '@tabler/icons';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { showHomePage } from 'providers/ReduxStore/slices/app';
import { switchWorkspace } from 'providers/ReduxStore/slices/workspaces/actions';
import { showInFolder } from 'providers/ReduxStore/slices/collections/actions';
import { sortWorkspaces } from 'utils/workspaces';

import CreateWorkspace from 'components/WorkspaceSidebar/CreateWorkspace';
import RenameWorkspace from './RenameWorkspace';
import DeleteWorkspace from './DeleteWorkspace';
import WorkspaceSettings from 'components/WorkspaceSettings';
import StyledWrapper from './StyledWrapper';
import MenuDropdown from 'ui/MenuDropdown/index';
import Button from 'ui/Button';
import { getRevealInFolderLabel } from 'utils/common/platform';

const ManageWorkspace = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const preferences = useSelector((state) => state.app.preferences);

  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [renameWorkspaceModal, setRenameWorkspaceModal] = useState({ open: false, workspace: null });
  const [deleteWorkspaceModal, setDeleteWorkspaceModal] = useState({ open: false, workspace: null });
  const [workspaceSettingsModal, setWorkspaceSettingsModal] = useState({ open: false, workspace: null });

  const sortedWorkspaces = useMemo(() => {
    return sortWorkspaces(workspaces, preferences);
  }, [workspaces, preferences]);

  const handleBack = () => {
    dispatch(showHomePage());
  };

  const handleOpenWorkspace = (workspace) => {
    dispatch(switchWorkspace(workspace.uid));
    dispatch(showHomePage());
    toast.success(t('WORKSPACE.SWITCHED_TO', { name: workspace.name }));
  };

  const handleShowInFolder = (workspace) => {
    if (workspace.pathname) {
      dispatch(showInFolder(workspace.pathname)).catch(() => {
        toast.error(t('WORKSPACE.ERROR_OPENING_FOLDER'));
      });
    }
  };

  const handleRenameClick = (workspace) => {
    setRenameWorkspaceModal({ open: true, workspace });
  };

  const handleCloseClick = (workspace) => {
    if (workspace.type === 'default') {
      toast.error(t('WORKSPACE.CANNOT_REMOVE_DEFAULT'));
      return;
    }
    if (workspace.uid === activeWorkspaceUid) {
      toast.error(t('WORKSPACE.CANNOT_REMOVE_ACTIVE'));
      return;
    }
    setDeleteWorkspaceModal({ open: true, workspace });
  };

  return (
    <StyledWrapper>
      {createWorkspaceModalOpen && (
        <CreateWorkspace onClose={() => setCreateWorkspaceModalOpen(false)} />
      )}

      {renameWorkspaceModal.open && renameWorkspaceModal.workspace && (
        <RenameWorkspace
          workspace={renameWorkspaceModal.workspace}
          onClose={() => setRenameWorkspaceModal({ open: false, workspace: null })}
        />
      )}

      {deleteWorkspaceModal.open && deleteWorkspaceModal.workspace && (
        <DeleteWorkspace
          workspace={deleteWorkspaceModal.workspace}
          onClose={() => setDeleteWorkspaceModal({ open: false, workspace: null })}
        />
      )}

      {workspaceSettingsModal.open && workspaceSettingsModal.workspace && (
        <WorkspaceSettings
          workspace={workspaceSettingsModal.workspace}
          onClose={() => setWorkspaceSettingsModal({ open: false, workspace: null })}
        />
      )}

      <div className="manage-workspace-header">
        <div className="header-left">
          <div className="back-button" onClick={handleBack}>
            <IconArrowLeft size={18} strokeWidth={1.5} />
          </div>
          <span className="header-title">{t('WORKSPACE.MANAGE_TITLE')}</span>
        </div>
        <Button size="sm" onClick={() => setCreateWorkspaceModalOpen(true)} icon={<IconPlus size={14} strokeWidth={2} />}>
          {t('WORKSPACE.CREATE_WORKSPACE')}
        </Button>
      </div>

      <div className="workspace-list">
        {sortedWorkspaces.length === 0 ? (
          <div className="empty-state">
            <span>{t('WORKSPACE.NO_WORKSPACES_FOUND')}</span>
          </div>
        ) : (
          sortedWorkspaces.map((workspace) => {
            const isDefault = workspace.type === 'default';
            const isActive = workspace.uid === activeWorkspaceUid;

            return (
              <div key={workspace.uid} className="workspace-item">
                <div className="workspace-info">
                  <div className="workspace-name-row">
                    <span className={`workspace-icon ${isDefault ? 'default' : 'regular'}`}>
                      {isDefault ? (
                        <IconLock size={14} strokeWidth={1.5} />
                      ) : (
                        <IconCategory size={14} strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="workspace-name">{workspace.name}</span>
                    {isDefault && <span className="default-badge">{t('WORKSPACE.DEFAULT')}</span>}
                  </div>
                  {workspace.pathname && (
                    <div className="workspace-path">{workspace.pathname}</div>
                  )}
                </div>

                <div className="workspace-actions">
                  <button
                    className="action-btn"
                    onClick={() => handleOpenWorkspace(workspace)}
                  >
                    <IconLogin size={14} strokeWidth={1.5} />
                    <span>{t('WORKSPACE.OPEN')}</span>
                  </button>
                  {workspace.isCloud && (
                    <button
                      className="action-btn members"
                      onClick={() => setWorkspaceSettingsModal({ open: true, workspace })}
                    >
                      <IconUsers size={14} strokeWidth={1.5} />
                      <span>{t('WORKSPACE.MEMBERS')}</span>
                    </button>
                  )}
                  {workspace.pathname && workspace.type !== 'default' && (
                    <button
                      className="action-btn"
                      onClick={() => handleShowInFolder(workspace)}
                    >
                      <IconFolder size={14} strokeWidth={1.5} />
                      <span>{getRevealInFolderLabel()}</span>
                    </button>
                  )}
                  {!isDefault && (
                    <MenuDropdown
                      placement="bottom-end"
                      items={[
                        { id: 'rename', label: t('COMMON.RENAME'), onClick: () => handleRenameClick(workspace) },
                        { id: 'remove', label: t('WORKSPACE.REMOVE'), onClick: () => handleCloseClick(workspace) }
                      ]}
                    >
                      <button className="more-actions-btn">
                        <IconDots size={14} strokeWidth={1.5} />
                      </button>
                    </MenuDropdown>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </StyledWrapper>
  );
};

export default ManageWorkspace;
