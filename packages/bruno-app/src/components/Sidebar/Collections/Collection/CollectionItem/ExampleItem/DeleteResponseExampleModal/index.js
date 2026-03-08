import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import { useDispatch } from 'react-redux';
import { deleteResponseExample } from 'providers/ReduxStore/slices/collections';
import { saveRequest, closeTabs } from 'providers/ReduxStore/slices/collections/actions';

const DeleteResponseExampleModal = ({ onClose, example, item, collection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const onConfirm = (e) => {
    e.stopPropagation();
    dispatch(closeTabs({ tabUids: [example.uid] }));
    dispatch(deleteResponseExample({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid: example.uid
    }));
    dispatch(saveRequest(item.uid, collection.uid, true))
      .then(() => {
        onClose();
      });
  };

  return (
    <Portal>
      <Modal
        size="sm"
        title={t('RESPONSE_EXAMPLE.DELETE_TITLE')}
        confirmText={t('RESPONSE_EXAMPLE.DELETE_CONFIRM')}
        handleConfirm={onConfirm}
        handleCancel={onClose}
        confirmButtonColor="danger"
      >
        {t('RESPONSE_EXAMPLE.DELETE_MESSAGE')} <span className="font-medium">{example.name}</span>?
      </Modal>
    </Portal>
  );
};

export default DeleteResponseExampleModal;
