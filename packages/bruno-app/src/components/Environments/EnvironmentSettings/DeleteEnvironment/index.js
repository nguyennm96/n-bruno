import React from 'react';
import { useTranslation } from 'react-i18next';
import Portal from 'components/Portal/index';
import toast from 'react-hot-toast';
import Modal from 'components/Modal/index';
import { deleteEnvironment } from 'providers/ReduxStore/slices/collections/actions';
import { useDispatch } from 'react-redux';
import StyledWrapper from './StyledWrapper';

const DeleteEnvironment = ({ onClose, environment, collection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const onConfirm = () => {
    dispatch(deleteEnvironment(environment.uid, collection.uid))
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
          confirmButtonColor="danger"
        >
          {t('ENVIRONMENTS.DELETE_ENVIRONMENT.CONFIRM_DELETE_PREFIX')} <span className="font-medium">{environment.name}</span> {t('ENVIRONMENTS.DELETE_ENVIRONMENT.CONFIRM_DELETE_SUFFIX')}
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default DeleteEnvironment;
