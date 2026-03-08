import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Portal from 'components/Portal/index';
import Modal from 'components/Modal/index';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { IconFolder, IconCloud } from '@tabler/icons';
import { closeWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';

const DeleteWorkspace = ({ onClose, workspace }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [isDeleting, setIsDeleting] = useState(false);

  const isCloud = workspace?.isCloud === true;

  const onConfirm = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      await dispatch(closeWorkspaceAction(workspace.uid));
      onClose();
    } catch (error) {
      toast.error(error?.message || t('WORKSPACE.DELETE_ERROR'));
      setIsDeleting(false);
    }
  };

  return (
    <Portal>
      <Modal
        size="sm"
        title={isCloud ? t('WORKSPACE.DELETE_TITLE') : t('WORKSPACE.REMOVE_TITLE')}
        confirmText={isDeleting ? (isCloud ? t('WORKSPACE.DELETING') : t('WORKSPACE.REMOVING')) : (isCloud ? t('COMMON.DELETE') : t('COMMON.REMOVE'))}
        handleConfirm={onConfirm}
        handleCancel={onClose}
        confirmDisabled={isDeleting}
        confirmButtonColor="danger"
      >
        <div className="flex items-center">
          {isCloud ? (
            <IconCloud size={18} strokeWidth={1.5} />
          ) : (
            <IconFolder size={18} strokeWidth={1.5} />
          )}
          <span className="ml-2 mr-4 font-semibold">{workspace?.name}</span>
        </div>
        <div className="mt-4">
          Are you sure you want to {isCloud ? 'delete' : 'remove'} workspace <span className="font-semibold">{workspace?.name}</span>?
        </div>
        {isCloud ? (
          <div className="mt-4 text-yellow-600">
            This will permanently delete the workspace and all its collections from the cloud.
          </div>
        ) : (
          <>
            {workspace?.pathname && (
              <div className="break-words text-xs mt-1">{workspace.pathname}</div>
            )}
            <div className="mt-4">
              The workspace will still be available in the file system and can be re-opened later.
            </div>
          </>
        )}
      </Modal>
    </Portal>
  );
};

export default DeleteWorkspace;
