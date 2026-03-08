import React from 'react';
import { IconAlertTriangle } from '@tabler/icons';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { useTranslation } from 'react-i18next';

const ConfirmRequestClose = ({ item, example, isDraft, onCancel, onCloseWithoutSave, onSaveAndClose }) => {
  const { t } = useTranslation();
  const isExample = !!example;
  const itemName = isExample ? example.name : item.name;
  const itemType = isExample ? 'example' : 'request';

  if (isDraft) {
    return (
      <Modal
        size="md"
        title={t('REQUEST_TAB.DISCARD_DRAFT_TITLE')}
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
          <h1 className="ml-2 text-lg font-medium">{t('REQUEST_TAB.DISCARD_DRAFT_QUESTION')}</h1>
        </div>
        <div className="font-normal mt-4">
          {t('REQUEST_TAB.DRAFT_NOT_SAVED_YET', { name: item.name })}
        </div>
        <div className="flex justify-between mt-6">
          <Button color="danger" onClick={onCloseWithoutSave}>
            {t('REQUEST_TAB.DISCARD')}
          </Button>
          <Button size="sm" color="secondary" variant="ghost" onClick={onCancel}>
            {t('COMMON.CANCEL')}
          </Button>
        </div>
      </Modal>
    );
  }

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
        {t('REQUEST_TAB.UNSAVED_CHANGES_DESC', { type: itemType, name: itemName })}
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
          <Button onClick={onSaveAndClose}>{t('COMMON.SAVE')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmRequestClose;
