import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { IconAlertTriangle } from '@tabler/icons';
import { removeCollectionFromWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';
import { findCollectionByUid } from 'utils/collections/index';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const DeleteCollection = ({ onClose, collectionUid, workspaceUid }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [confirmText, setConfirmText] = useState('');
  const collection = useSelector((state) => findCollectionByUid(state.collections.collections, collectionUid));
  const workspace = useSelector((state) => state.workspaces.workspaces.find((w) => w.uid === workspaceUid));

  const isConfirmed = confirmText.toLowerCase() === 'delete';

  const onConfirm = async () => {
    if (!collection || !workspace) {
      toast.error(t('SIDEBAR.DELETE_COLLECTION_NOT_FOUND'));
      onClose();
      return;
    }

    try {
      await dispatch(removeCollectionFromWorkspaceAction(workspace.uid, collection.uid));
      toast.success(t('SIDEBAR.DELETE_COLLECTION_SUCCESS', { name: collection.name }));
      onClose();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error(error.message || t('SIDEBAR.DELETE_COLLECTION_ERROR'));
    }
  };

  if (!collection) {
    return null;
  }

  const customHeader = (
    <div className="flex items-center gap-2">
      <IconAlertTriangle size={18} strokeWidth={1.5} className="text-red-500" />
      <span>{t('MODALS.DELETE_COLLECTION_TITLE')}</span>
    </div>
  );

  return (
    <StyledWrapper>
      <Modal
        size="sm"
        title={t('MODALS.DELETE_COLLECTION_TITLE')}
        customHeader={customHeader}
        confirmText={t('COMMON.DELETE')}
        cancelText={t('COMMON.CANCEL')}
        confirmButtonColor="danger"
        confirmDisabled={!isConfirmed}
        handleConfirm={onConfirm}
        handleCancel={onClose}
      >
        <p className="modal-description">
          {t('SIDEBAR.DELETE_COLLECTION_CONFIRM')} <strong>"{collection.name}"</strong>?
        </p>
        <div className="collection-info-card">
          <div className="collection-name">{collection.name}</div>
          <div className="collection-path">{collection.uid}</div>
        </div>
        <p className="warning-text">
          {t('SIDEBAR.DELETE_COLLECTION_WARNING')}
        </p>
        <div className="delete-confirmation">
          <label htmlFor="delete-confirm-input">
            {t('SIDEBAR.DELETE_CONFIRM_TYPE_PREFIX')} <span className="delete-keyword">{t('SIDEBAR.DELETE_KEYWORD')}</span> {t('SIDEBAR.DELETE_CONFIRM_TYPE_SUFFIX')}
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('SIDEBAR.DELETE_KEYWORD')}
            autoComplete="off"
            autoFocus
          />
        </div>
      </Modal>
    </StyledWrapper>
  );
};

export default DeleteCollection;
