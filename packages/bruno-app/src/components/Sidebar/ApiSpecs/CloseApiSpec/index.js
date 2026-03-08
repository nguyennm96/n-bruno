import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import { useDispatch } from 'react-redux';
import { IconFileCode } from '@tabler/icons';
import { closeApiSpecFile } from 'providers/ReduxStore/slices/apiSpec';

const CloseApiSpec = ({ onClose, apiSpec }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const onConfirm = () => {
    dispatch(closeApiSpecFile({ uid: apiSpec.uid }))
      .then(() => {
        toast.success(t('CLOSE_API_SPEC.success'));
        onClose();
      })
      .catch(() => toast.error(t('CLOSE_API_SPEC.error')));
  };

  return (
    <Modal size="sm" title={t('CLOSE_API_SPEC.title')} confirmText={t('CLOSE_API_SPEC.confirmText')} handleConfirm={onConfirm} handleCancel={onClose}>
      <div className="flex items-center">
        <IconFileCode size={18} strokeWidth={1.5} />
        <span className="ml-2 mr-4 font-semibold">{apiSpec.name}</span>
      </div>
      <div className="break-words text-xs mt-1">{apiSpec.pathname}</div>
      <div className="mt-4">
        {t('CLOSE_API_SPEC.confirmMessage', { name: apiSpec.name })}
      </div>
      <div className="mt-4">
        {t('CLOSE_API_SPEC.availableMessage')}
      </div>
    </Modal>
  );
};

export default CloseApiSpec;
