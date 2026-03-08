import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { IconAlertTriangle, IconDoorExit, IconTrash, IconTransferIn } from '@tabler/icons';
import {
  selectWorkspaceMembers,
  selectMembersLoading
} from 'providers/ReduxStore/slices/workspaces';
import {
  leaveWorkspaceAction,
  transferOwnershipAction
} from 'providers/ReduxStore/slices/workspaces/actions';
import { closeWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';
import { selectUser } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const DangerZone = ({ workspace, onClose }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const members = useSelector(selectWorkspaceMembers(workspace.uid));
  const loading = useSelector(selectMembersLoading(workspace.uid));

  const currentMember = members.find(
    (m) => m.userId === currentUser?.id || m.user?.email === currentUser?.email
  );
  const isOwner = currentMember?.role === 'owner';

  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const nonOwnerMembers = members.filter((m) => m.role !== 'owner');

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return;
    setIsTransferring(true);
    try {
      await dispatch(transferOwnershipAction(workspace.uid, selectedNewOwner));
      toast.success(t('WORKSPACE.OWNERSHIP_TRANSFERRED'));
      setShowTransfer(false);
      setSelectedNewOwner('');
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.TRANSFER_OWNERSHIP_ERROR'));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    setIsLeaving(true);
    try {
      await dispatch(leaveWorkspaceAction(workspace.uid));
      toast.success(t('WORKSPACE.LEFT_WORKSPACE', { name: workspace.name }));
      onClose();
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.LEAVE_WORKSPACE_ERROR'));
      setIsLeaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteInput !== workspace.name) return;
    setIsDeleting(true);
    try {
      await dispatch(closeWorkspaceAction(workspace.uid));
      toast.success(t('WORKSPACE.WORKSPACE_DELETED', { name: workspace.name }));
      onClose();
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.DELETE_WORKSPACE_ERROR'));
      setIsDeleting(false);
    }
  };

  return (
    <StyledWrapper>
      {/* Transfer Ownership — owners only */}
      {isOwner && (
        <div className="danger-card">
          <div className="danger-card-header">
            <div className="danger-card-icon transfer">
              <IconTransferIn size={16} strokeWidth={1.5} />
            </div>
            <div className="danger-card-text">
              <h4 className="danger-card-title">{t('WORKSPACE.TRANSFER_OWNERSHIP')}</h4>
              <p className="danger-card-desc">{t('WORKSPACE.TRANSFER_OWNERSHIP_DESC')}</p>
            </div>
            {!showTransfer && (
              <button
                className="action-btn secondary"
                onClick={() => setShowTransfer(true)}
                disabled={loading || nonOwnerMembers.length === 0}
                title={nonOwnerMembers.length === 0 ? t('WORKSPACE.NO_MEMBERS_TO_TRANSFER') : undefined}
              >
                {t('WORKSPACE.TRANSFER')}
              </button>
            )}
          </div>

          {showTransfer && (
            <div className="confirm-panel">
              <p className="confirm-label">{t('WORKSPACE.SELECT_NEW_OWNER')}</p>
              <div className="confirm-row">
                <select
                  className="member-select"
                  value={selectedNewOwner}
                  onChange={(e) => setSelectedNewOwner(e.target.value)}
                >
                  <option value="">{t('WORKSPACE.CHOOSE_MEMBER')}</option>
                  {nonOwnerMembers.map((m) => {
                    const label = m.user?.name
                      ? `${m.user.name} (${m.user.email})`
                      : m.user?.email || m.userId;
                    return (
                      <option key={m.userId} value={m.userId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <button
                  className="action-btn danger"
                  onClick={handleTransferOwnership}
                  disabled={!selectedNewOwner || isTransferring}
                >
                  {isTransferring ? t('WORKSPACE.TRANSFERRING') : t('WORKSPACE.CONFIRM_TRANSFER')}
                </button>
                <button
                  className="action-btn ghost"
                  onClick={() => {
                    setShowTransfer(false);
                    setSelectedNewOwner('');
                  }}
                >
                  {t('COMMON.CANCEL')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leave Workspace — non-owners only */}
      {!isOwner && (
        <div className="danger-card">
          <div className="danger-card-header">
            <div className="danger-card-icon leave">
              <IconDoorExit size={16} strokeWidth={1.5} />
            </div>
            <div className="danger-card-text">
              <h4 className="danger-card-title">{t('WORKSPACE.LEAVE_WORKSPACE')}</h4>
              <p className="danger-card-desc">{t('WORKSPACE.LEAVE_WORKSPACE_DESC')}</p>
            </div>
            {!leaveConfirm && (
              <button className="action-btn warning" onClick={() => setLeaveConfirm(true)}>
                {t('WORKSPACE.LEAVE')}
              </button>
            )}
          </div>

          {leaveConfirm && (
            <div className="confirm-panel">
              <p className="confirm-label">{t('WORKSPACE.CONFIRM_LEAVE', { name: workspace.name })}</p>
              <div className="confirm-row">
                <button
                  className="action-btn danger"
                  onClick={handleLeaveWorkspace}
                  disabled={isLeaving}
                >
                  {isLeaving ? t('WORKSPACE.LEAVING') : t('WORKSPACE.YES_LEAVE')}
                </button>
                <button className="action-btn ghost" onClick={() => setLeaveConfirm(false)}>
                  {t('COMMON.CANCEL')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Workspace — owners only */}
      {isOwner && (
        <div className="danger-card destructive">
          <div className="danger-card-header">
            <div className="danger-card-icon delete">
              <IconTrash size={16} strokeWidth={1.5} />
            </div>
            <div className="danger-card-text">
              <h4 className="danger-card-title">{t('WORKSPACE.DELETE_WORKSPACE')}</h4>
              <p className="danger-card-desc">{t('WORKSPACE.DELETE_WORKSPACE_DESC')}</p>
            </div>
            {!deleteConfirm && (
              <button className="action-btn danger" onClick={() => setDeleteConfirm(true)}>
                {t('COMMON.DELETE')}
              </button>
            )}
          </div>

          {deleteConfirm && (
            <div className="confirm-panel">
              <p className="confirm-label">
                {t('WORKSPACE.TYPE_CONFIRM_DELETE', { name: workspace.name })}
              </p>
              <div className="confirm-row">
                <input
                  className="confirm-input"
                  type="text"
                  placeholder={workspace.name}
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  autoFocus
                />
                <button
                  className="action-btn danger"
                  onClick={handleDeleteWorkspace}
                  disabled={deleteInput !== workspace.name || isDeleting}
                >
                  {isDeleting ? t('WORKSPACE.DELETING') : t('WORKSPACE.DELETE_PERMANENTLY')}
                </button>
                <button
                  className="action-btn ghost"
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDeleteInput('');
                  }}
                >
                  {t('COMMON.CANCEL')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isOwner && !currentMember && (
        <div className="empty-danger">
          <IconAlertTriangle size={18} strokeWidth={1.5} />
          <span>{t('WORKSPACE.NO_ACTIONS_AVAILABLE')}</span>
        </div>
      )}
    </StyledWrapper>
  );
};

export default DangerZone;
