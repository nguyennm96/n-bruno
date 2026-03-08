import React from 'react';
import { useTranslation } from 'react-i18next';
import Portal from 'components/Portal/index';
import Modal from 'components/Modal/index';
import StyledWrapper from './StyledWrapper';

const DeleteDotEnvFile = ({ onClose, onConfirm, filename = '.env' }) => {
  const { t } = useTranslation();
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="sm"
          title={t('ENVIRONMENTS.DELETE_FILE', { filename })}
          confirmText={t('COMMON.DELETE')}
          handleConfirm={handleConfirm}
          handleCancel={onClose}
          confirmButtonColor="danger"
        >
          Are you sure you want to delete <span className="font-medium">{filename}</span> file?
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default DeleteDotEnvFile;
