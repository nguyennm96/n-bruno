import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useDispatch } from 'react-redux';
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

const getTitleText = ({ isResponseTooLarge, isStreamingResponse }) => {
  if (isStreamingResponse) {
    return 'Response Examples aren\'t supported in streaming responses yet.';
  }

  if (isResponseTooLarge) {
    return 'Response size exceeds 5MB limit. Cannot save as example.';
  }

  return 'Save current response as example';
};

const ResponseBookmark = forwardRef(({ item, collection, responseSize, children }, ref) => {
  const dispatch = useDispatch();
  const [showSaveResponseExampleModal, setShowSaveResponseExampleModal] = useState(false);
  const response = item.response || {};
  const elementRef = useRef(null);

  const isResponseTooLarge = responseSize >= 5 * 1024 * 1024; // 5 MB
  const isStreamingResponse = response.stream;
  const isDisabled = isResponseTooLarge || isStreamingResponse ? true : false;

  const ensureResponseCanBeSaved = (event) => {
    if (!response || response.error) {
      toast.error('No valid response to save as example');
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return false;
    }

    if (isResponseTooLarge) {
      toast.error('Response size exceeds 5MB limit. Cannot save as example.');
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
      toast.success('Example updated from latest response');
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
      toast.success('Example request snapshot synced');
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
    toast.success(`Example "${name}" created successfully`);
  };

  const disabledMessage = getTitleText({
    isResponseTooLarge,
    isStreamingResponse
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
            <ActionIcon className="p-1" disabled={isDisabled}>
              <IconBookmark size={16} strokeWidth={2} />
            </ActionIcon>
          </StyledWrapper>
        )}
      </div>

      <CreateExampleModal
        isOpen={showSaveResponseExampleModal}
        onClose={() => setShowSaveResponseExampleModal(false)}
        onSave={saveAsExample}
        title="Save Response as Example"
        initialName={getSuggestedExampleName(item, response)}
      />
    </>
  );
});

ResponseBookmark.displayName = 'ResponseBookmark';

export default ResponseBookmark;
