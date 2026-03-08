import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';
import useFocusTrap from 'hooks/useFocusTrap';
import Button from 'ui/Button';

const ESC_KEY_CODE = 27;
const ENTER_KEY_CODE = 13;

const modalTextKeyMap = {
  'Create Collection': 'MODALS.CREATE_COLLECTION_TITLE',
  'Clone Collection': 'MODALS.CLONE_COLLECTION_TITLE',
  'New Folder': 'MODALS.NEW_FOLDER_TITLE',
  'New Request': 'MODALS.NEW_REQUEST_TITLE',
  'Import Collection': 'MODALS.IMPORT_COLLECTION_TITLE',
  'Close Workspace': 'MODALS.CLOSE_WORKSPACE_TITLE',
  'Close all collections': 'MODALS.CLOSE_ALL_COLLECTIONS_TITLE',
  'Delete Collection': 'MODALS.DELETE_COLLECTION_TITLE',
  'Remove Collection': 'MODALS.REMOVE_COLLECTION_TITLE',
  'Create API Spec': 'MODALS.CREATE_API_SPEC_TITLE',
  'Bulk Import': 'MODALS.BULK_IMPORT_TITLE',
  'Golden Edition': 'MODALS.GOLDEN_EDITION_TITLE',
  'Collection Runner': 'MODALS.COLLECTION_RUNNER_TITLE',
  'Generate Documentation': 'MODALS.GENERATE_DOCUMENTATION_TITLE'
};

const translateModalText = (t, text) => {
  if (typeof text !== 'string' || !text.trim()) {
    return text;
  }
  const key = modalTextKeyMap[text];
  return key ? t(key, text) : text;
};

const ModalHeader = ({ title, handleCancel, customHeader, hideClose }) => (
  <div className="bruno-modal-header">
    {customHeader ? customHeader : <>{title ? <div className="bruno-modal-header-title">{title}</div> : null}</>}
    {handleCancel && !hideClose ? (
      // TODO: Remove data-test-id and use data-testid instead across the codebase.
      <div className="close cursor-pointer" onClick={handleCancel ? () => handleCancel() : null} data-testid="modal-close-button">
        ×
      </div>
    ) : null}
  </div>
);

const ModalContent = ({ children }) => <div className="bruno-modal-content px-4 py-4">{children}</div>;

const ModalFooter = ({
  confirmText,
  cancelText,
  handleSubmit,
  handleCancel,
  confirmDisabled,
  hideCancel,
  hideFooter,
  confirmButtonColor = 'primary'
}) => {
  const { t } = useTranslation();
  confirmText = translateModalText(t, confirmText || t('COMMON.SAVE', 'Save'));
  cancelText = translateModalText(t, cancelText || t('COMMON.CANCEL', 'Cancel'));

  if (hideFooter) {
    return null;
  }

  return (
    <div className="flex justify-end p-4 bruno-modal-footer">
      <span className={hideCancel ? 'hidden' : 'mr-2'}>
        <Button type="button" color="secondary" variant="ghost" onClick={handleCancel}>
          {cancelText}
        </Button>
      </span>
      <span>
        <Button
          type="submit"
          color={confirmButtonColor}
          disabled={confirmDisabled}
          onClick={handleSubmit}
          className="submit"
        >
          {confirmText}
        </Button>
      </span>
    </div>
  );
};

const Modal = ({
  size,
  title,
  customHeader,
  confirmText,
  cancelText,
  handleCancel,
  handleConfirm = () => {},
  children,
  confirmDisabled,
  hideCancel,
  hideFooter,
  hideClose,
  disableCloseOnOutsideClick,
  disableEscapeKey,
  onClick,
  closeModalFadeTimeout = 500,
  dataTestId,
  confirmButtonColor = 'primary'
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);
  const translatedTitle = translateModalText(t, title);

  const handleKeydown = (event) => {
    const { keyCode, shiftKey, ctrlKey, altKey, metaKey } = event;

    // Only handle events from elements inside this modal
    if (keyCode !== ESC_KEY_CODE && (!modalRef.current || !modalRef.current.contains(event.target))) {
      return;
    }

    switch (keyCode) {
      case ESC_KEY_CODE: {
        if (disableEscapeKey) return;
        return closeModal({ type: 'esc' });
      }
      case ENTER_KEY_CODE: {
        const isSubmitButton = event.target?.type === 'submit';
        if (!shiftKey && !ctrlKey && !altKey && !metaKey && handleConfirm && !isSubmitButton && !confirmDisabled) {
          return handleConfirm();
        }
      }
    }
  };

  useFocusTrap(modalRef);

  const closeModal = (args) => {
    setIsClosing(true);
    setTimeout(() => handleCancel(args), closeModalFadeTimeout);
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown, false);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [disableEscapeKey, document, handleConfirm, confirmDisabled]);

  let classes = 'bruno-modal';
  if (isClosing) {
    classes += ' modal--animate-out';
  }
  if (hideFooter) {
    classes += ' modal-footer-none';
  }
  return (
    <StyledWrapper className={classes} onClick={onClick ? (e) => onClick(e) : null}>
      <div
        className={`bruno-modal-card modal-${size}`}
        ref={modalRef}
        role="dialog"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        data-testid={dataTestId}
      >
        <ModalHeader
          title={translatedTitle}
          hideClose={hideClose}
          handleCancel={() => closeModal({ type: 'icon' })}
          customHeader={customHeader}
        />
        <ModalContent>{children}</ModalContent>
        <ModalFooter
          confirmText={confirmText}
          cancelText={cancelText}
          handleCancel={() => closeModal({ type: 'button' })}
          handleSubmit={handleConfirm}
          confirmDisabled={confirmDisabled}
          hideCancel={hideCancel}
          hideFooter={hideFooter}
          confirmButtonColor={confirmButtonColor}
        />
      </div>

      {/* Clicking on backdrop closes the modal */}
      <div
        className="bruno-modal-backdrop"
        onClick={
          disableCloseOnOutsideClick
            ? null
            : () => {
                closeModal({ type: 'backdrop' });
              }
        }
      />
    </StyledWrapper>
  );
};

export default Modal;
