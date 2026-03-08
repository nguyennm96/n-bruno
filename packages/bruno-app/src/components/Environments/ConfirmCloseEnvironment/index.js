import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlertTriangle } from '@tabler/icons';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import Button from 'ui/Button';

const ConfirmCloseEnvironment = ({ onCancel, onCloseWithoutSave, onSaveAndClose, isGlobal, isDotEnv }) => {
  const { t } = useTranslation();
  let settingsLabel = t('ENVIRONMENTS.CONFIRM_CLOSE.COLLECTION_ENVIRONMENT_SETTINGS');
  if (isDotEnv) {
    settingsLabel = t('ENVIRONMENTS.CONFIRM_CLOSE.DOT_ENV_FILE');
  } else if (isGlobal) {
    settingsLabel = t('ENVIRONMENTS.CONFIRM_CLOSE.GLOBAL_ENVIRONMENT_SETTINGS');
  }

  return (
    <Portal>
      <Modal
        size="md"
        title={t('ENVIRONMENTS.CONFIRM_CLOSE.UNSAVED_CHANGES')}
        disableEscapeKey={true}
        disableCloseOnOutsideClick={true}
        closeModalFadeTimeout={150}
        handleCancel={onCancel}
        hideFooter={true}
      >
        <div className="flex items-center font-normal">
          <IconAlertTriangle size={32} strokeWidth={1.5} className="text-yellow-600" />
          <h1 className="ml-2 text-lg font-medium">{t('ENVIRONMENTS.CONFIRM_CLOSE.HOLD_ON')}</h1>
        </div>
        <div className="font-normal mt-4">
          {t('ENVIRONMENTS.CONFIRM_CLOSE.YOU_HAVE_UNSAVED_CHANGES', { settingsLabel })}
        </div>

        <div className="flex justify-between mt-6">
          <div>
            <Button color="danger" onClick={onCloseWithoutSave}>
              {t('ENVIRONMENTS.CONFIRM_CLOSE.DONT_SAVE')}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" color="secondary" variant="ghost" onClick={onCancel}>
              {t('ENVIRONMENTS.CONFIRM_CLOSE.CANCEL')}
            </Button>
            <Button onClick={onSaveAndClose}>
              {t('ENVIRONMENTS.CONFIRM_CLOSE.SAVE')}
            </Button>
          </div>
        </div>
      </Modal>
    </Portal>
  );
};

export default ConfirmCloseEnvironment;
