import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import StyledWrapper from './StyledWrapper';
import { clearRequestTimeline } from 'providers/ReduxStore/slices/collections/index';

const ClearTimeline = ({ collection, item }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const clearResponse = () =>
    dispatch(
      clearRequestTimeline({
        itemUid: item.uid,
        collectionUid: collection.uid
      })
    );

  return (
    <StyledWrapper className="flex items-center">
      <button type="button" onClick={clearResponse} className="text-link hover:underline whitespace-nowrap" title="t('RESPONSE_PANE.CLEAR_TIMELINE')">
        Clear Timeline
      </button>
    </StyledWrapper>
  );
};

export default ClearTimeline;
