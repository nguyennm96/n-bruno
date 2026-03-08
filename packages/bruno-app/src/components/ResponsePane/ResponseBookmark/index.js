import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { IconBookmark } from '@tabler/icons';
import {
  addResponseExample,
  updateResponseExampleRequest,
  updateResponseExampleResponse
} from 'providers/ReduxStore/slices/collections';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { insertTaskIntoQueue } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';
import CreateExampleModal from 'components/ResponseExample/CreateExampleModal';
import classnames from 'classnames';
import StyledWrapper from './StyledWrapper';
import ActionIcon from 'ui/ActionIcon/index';
import {
  buildExampleRequestSnapshot,
  buildExampleResponseFromRuntime,
  buildResponseExampleFromRuntime,
  getSuggestedExampleName
} from 'utils/examples';

const getTitleText = ({ isResponseTooLarge, isStreamingResponse, t }) => {
  if (isStreamingResponse) {
    return t('RESPONSE.BOOKMARK.STREAMING_NOT_SUPPORTED');
  }

  if (isResponseTooLarge) {
    return t('RESPONSE.BOOKMARK.SIZE_EXCEEDS_LIMIT');
  }

  return t('RESPONSE.BOOKMARK.SAVE_CURRENT_RESPONSE');
};

const ResponseBookmark = forwardRef(({ item, collection, responseSize, children }, ref) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [showSaveResponseExampleModal, setShowSaveResponseExampleModal] = useState(false);
  const response = item.response || {};
  const elementRef = useRef(null);

  const isResponseTooLarge = responseSize >= 5 * 1024 * 1024; // 5 MB
  const isStreamingResponse = response.stream;
  const isDisabled = isResponseTooLarge || isStreamingResponse ? true : false;

  const ensureResponseCanBeSaved = (event) => {
    if (!response || response.error) {
      toast.error(t('RESPONSE_EXAMPLE.CREATE_MODAL.NO_VALID_RESPONSE'));
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return false;
    }

    if (isResponseTooLarge) {
      toast.error(t('RESPONSE_EXAMPLE.CREATE_MODAL.SIZE_EXCEEDS_LIMIT'));
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return false;
    }

    if (isDisabled) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return false;
    }

    return true;
  };

  const openCreateModal = (event) => {
    if (!ensureResponseCanBeSaved(event)) {
      return false;
    }

    setShowSaveResponseExampleModal(true);
    return true;
  };

  useImperativeHandle(ref, () => ({
    click: () => elementRef.current?.click(),
    openCreateModal: () => openCreateModal(),
    updateExampleFromResponse: async (exampleUid) => {
      if (!ensureResponseCanBeSaved()) return false;
      if (!exampleUid) return false;

      dispatch(updateResponseExampleResponse({
        itemUid: item.uid,
        collectionUid: collection.uid,
        exampleUid,
        response: buildExampleResponseFromRuntime(response)
      }));

      await dispatch(saveRequest(item.uid, collection.uid, true));
      toast.success(t('RESPONSE_EXAMPLE.CREATE_MODAL.UPDATED_FROM_RESPONSE'));
      return true;
    },
    syncRequestSnapshot: async (exampleUid) => {
      if (!exampleUid) return false;

      dispatch(updateResponseExampleRequest({
        itemUid: item.uid,
        collectionUid: collection.uid,
        exampleUid,
        request: buildExampleRequestSnapshot(item.draft?.request || item.request || {})
      }));

      await dispatch(saveRequest(item.uid, collection.uid, true));
      toast.success(t('RESPONSE_EXAMPLE.CREATE_MODAL.REQUEST_SNAPSHOT_SYNCED'));
      return true;
    },
    isDisabled
  }), [collection.uid, dispatch, isDisabled, item.draft?.request, item.request, item.uid, response]);

  // Only show for HTTP requests
  if (item.type !== 'http-request') {
    return null;
  }

  const handleSaveClick = (e) => openCreateModal(e);

  const saveAsExample = async (name, description = '') => {
    const existingExamples = item.draft?.examples || item.examples || [];
    const exampleIndex = existingExamples.length;
    const example = buildResponseExampleFromRuntime({
      item,
      response,
      name,
      description
    });

    dispatch(addResponseExample({
      itemUid: item.uid,
      collectionUid: collection.uid,
      example
    }));

    await dispatch(saveRequest(item.uid, collection.uid, true));

    dispatch(insertTaskIntoQueue({
      uid: example.uid,
      type: 'OPEN_EXAMPLE',
      collectionUid: collection.uid,
      itemUid: item.uid,
      exampleIndex
    }));

    setShowSaveResponseExampleModal(false);
    toast.success(t('RESPONSE_EXAMPLE.CREATE_MODAL.CREATED_SUCCESSFULLY', { name }));
  };

  const disabledMessage = getTitleText({
    isResponseTooLarge,
    isStreamingResponse,
    t
  });

  return (
    <>
      <div
        ref={elementRef}
        onClick={handleSaveClick}
        title={
          !children ? disabledMessage : (isDisabled ? disabledMessage : null)
        }
        className={classnames({
          'opacity-50 cursor-not-allowed': isDisabled && !children
        })}
        data-testid="response-bookmark-btn"
      >
        {children ?? (
          <StyledWrapper className="flex items-center">
            <ActionIcon className="p-1" disabled={isDisabled} label={disabledMessage}>
              <IconBookmark size={16} strokeWidth={2} />
            </ActionIcon>
          </StyledWrapper>
        )}
      </div>

      <CreateExampleModal
        isOpen={showSaveResponseExampleModal}
        onClose={() => setShowSaveResponseExampleModal(false)}
        onSave={saveAsExample}
        title={t('RESPONSE_EXAMPLE.CREATE_MODAL.TITLE')}
        initialName={getSuggestedExampleName(item, response)}
      />
    </>
  );
});

ResponseBookmark.displayName = 'ResponseBookmark';

export default ResponseBookmark;
