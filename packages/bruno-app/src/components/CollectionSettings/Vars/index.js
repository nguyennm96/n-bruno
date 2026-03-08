import React from 'react';
import { useTranslation } from 'react-i18next';
import get from 'lodash/get';
import VarsTable from './VarsTable';
import StyledWrapper from './StyledWrapper';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import { useDispatch } from 'react-redux';
import Button from 'ui/Button';

const Vars = ({ collection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const requestVars = collection.draft?.root ? get(collection, 'draft.root.request.vars.req', []) : get(collection, 'root.request.vars.req', []);
  const responseVars = collection.draft?.root ? get(collection, 'draft.root.request.vars.res', []) : get(collection, 'root.request.vars.res', []);
  const handleSave = () => dispatch(saveCollectionSettings(collection.uid));

  return (
    <StyledWrapper className="w-full flex flex-col">
      <div className="flex-1">
        <div className="mb-3 title text-xs">{t('REQUEST.PRE_REQUEST')}</div>
        <VarsTable collection={collection} vars={requestVars} varType="request" />
      </div>
      <div className="flex-1">
        <div className="mt-3 mb-3 title text-xs">{t('REQUEST.POST_RESPONSE')}</div>
        <VarsTable collection={collection} vars={responseVars} varType="response" />
      </div>
      <div className="mt-6">
        <Button type="submit" size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </StyledWrapper>
  );
};

export default Vars;
