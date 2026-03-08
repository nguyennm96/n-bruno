import React from 'react';
import { useTranslation } from 'react-i18next';
import Portal from 'components/Portal/index';
import toast from 'react-hot-toast';
import Modal from 'components/Modal/index';
import { useDispatch } from 'react-redux';
import StyledWrapper from './StyledWrapper';
import { deleteGlobalEnvironment } from 'providers/ReduxStore/slices/global-environments';

const DeleteEnvironment = ({ onClose, environment }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const onConfirm = () => {
    dispatch(deleteGlobalEnvironment({ environmentUid: environment.uid }))
      .then(() => {
        toast.success(t('ENVIRONMENTS.DELETE_ENVIRONMENT.DELETED_SUCCESSFULLY'));
        onClose();
      })
      .catch(() => toast.error(t('ENVIRONMENTS.DELETE_ENVIRONMENT.ERROR_DELETING')));
  };

  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="sm"
          title={t('ENVIRONMENTS.DELETE_ENVIRONMENT.TITLE')}
          confirmText={t('ENVIRONMENTS.DELETE_ENVIRONMENT.DELETE')}
          handleConfirm={onConfirm}
          handleCancel={onClose}
        >
          {t('ENVIRONMENTS.DELETE_ENVIRONMENT.CONFIRM_DELETE_PREFIX')} <span className="font-semibold">{environment.name}</span> {t('ENVIRONMENTS.DELETE_ENVIRONMENT.CONFIRM_DELETE_SUFFIX')}
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default DeleteEnvironment;
