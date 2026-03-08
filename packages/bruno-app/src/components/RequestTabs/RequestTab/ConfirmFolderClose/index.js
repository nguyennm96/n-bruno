import React from 'react';
import { IconAlertTriangle } from '@tabler/icons';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { useTranslation } from 'react-i18next';

const ConfirmFolderClose = ({ folder, onCancel, onCloseWithoutSave, onSaveAndClose }) => {
  const { t } = useTranslation();
  return (
    <Modal
      size="md"
      title={t('REQUEST_TAB.UNSAVED_CHANGES_TITLE')}
      confirmText="Save and Close"
      cancelText="Close without saving"
      disableEscapeKey={true}
      disableCloseOnOutsideClick={true}
      closeModalFadeTimeout={150}
      handleCancel={onCancel}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      hideFooter={true}
    >
      <div className="flex items-center font-normal">
        <IconAlertTriangle size={32} strokeWidth={1.5} className="text-yellow-600" />
        <h1 className="ml-2 text-lg font-medium">{t('REQUEST_TAB.HOLD_ON')}</h1>
      </div>
      <div className="font-normal mt-4">
        {t('REQUEST_TAB.FOLDER_UNSAVED_CHANGES', { name: folder.name })}
      </div>

      <div className="flex justify-between mt-6">
        <div>
          <Button color="danger" onClick={onCloseWithoutSave}>
            {t('REQUEST_TAB.DONT_SAVE')}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" color="secondary" variant="ghost" onClick={onCancel}>
            {t('COMMON.CANCEL')}
          </Button>
          <Button onClick={onSaveAndClose}>
            {t('COMMON.SAVE')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmFolderClose;
