import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { pluralizeWord } from 'utils/common';
import { IconAlertTriangle, IconDeviceFloppy } from '@tabler/icons';
import { clearAllSaveTransientRequestModals } from 'providers/ReduxStore/slices/collections';
import { closeTabs } from 'providers/ReduxStore/slices/collections/actions';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import SaveTransientRequest from './index';

const SaveTransientRequestContainer = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const modals = useSelector((state) => state.collections.saveTransientRequestModals);
  const [openItemUid, setOpenItemUid] = useState(null);

  // Reset openItemUid if the modal no longer exists in the array
  useEffect(() => {
    if (openItemUid && !modals.find((modal) => modal.item.uid === openItemUid)) {
      setOpenItemUid(null);
    }
  }, [modals, openItemUid]);

  const handleDiscardAll = () => {
    // Close all tabs for the transient requests (this will also delete the transient files)
    const tabUids = modals.map((modal) => modal.item.uid);
    dispatch(closeTabs({ tabUids }));

    // Clear all modals
    dispatch(clearAllSaveTransientRequestModals());

    // Show success message
    toast.success(t('SAVE_REQUEST.DISCARDED_SUCCESS', { count: modals.length, requestWord: pluralizeWord('request', modals.length) }));
  };

  const handleCancel = () => {
    // Clear all modals on close
    dispatch(clearAllSaveTransientRequestModals());
  };

  const handleOpenSpecificModal = (itemUid) => {
    setOpenItemUid(itemUid);
  };

  // If a specific modal is open, show it
  if (openItemUid) {
    const modalToOpen = modals.find((modal) => modal.item.uid === openItemUid);
    if (modalToOpen) {
      return (
        <SaveTransientRequest
          item={modalToOpen.item}
          collection={modalToOpen.collection}
          isOpen={true}
        />
      );
    }
  }

  // Show list of multiple modals
  return (
    <Modal
      size="md"
      title={t('SAVE_REQUEST.UNSAVED_TRANSIENT_TITLE')}
      hideFooter={true}
      disableEscapeKey={true}
      disableCloseOnOutsideClick={true}
      handleCancel={handleCancel}
    >
      <div className="flex items-center">
        <IconAlertTriangle size={32} strokeWidth={1.5} className="text-yellow-600" />
        <h1 className="ml-2 text-lg font-medium">{t('SAVE_REQUEST.UNSAVED_TRANSIENT_HEADING')}</h1>
      </div>
      <p className="mt-4">
        {t('SAVE_REQUEST.REQUESTS_NEED_SAVING', { count: modals.length, requestWord: pluralizeWord('request', modals.length) })}
      </p>

      <div className="mt-4">
        <p className="text-sm font-medium mb-2">
          {t('SAVE_REQUEST.TRANSIENT_REQUESTS_LABEL', { count: modals.length, requestWord: pluralizeWord('Request', modals.length) })}
        </p>
        <p className="text-xs text-orange-600 mb-3">
          {t('SAVE_REQUEST.REQUESTS_NEED_SAVING_WARNING')}
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {modals.map((modal) => {
            const { item, collection } = modal;
            return (
              <div
                key={item.uid}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex flex-col flex-1 min-w-0 mr-3">
                  <span className="text-sm text-gray-700 truncate">{item.name}</span>
                  <span className="text-xs text-gray-500 truncate">
                    {collection.name}
                  </span>
                </div>
                <Button
                  color="primary"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenSpecificModal(item.uid)}
                  icon={<IconDeviceFloppy size={14} strokeWidth={1.5} />}
                >
                  {t('COMMON.SAVE')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-4 border-t">
        <Button color="danger" onClick={handleDiscardAll}>
          {t('SAVE_REQUEST.DISCARD_ALL')}
        </Button>
      </div>
    </Modal>
  );
};

export default SaveTransientRequestContainer;
