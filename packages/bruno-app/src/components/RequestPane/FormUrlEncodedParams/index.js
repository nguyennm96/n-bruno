import React, { useCallback } from 'react';
import get from 'lodash/get';
import { useDispatch } from 'react-redux';
import { useTheme } from 'providers/Theme';
import {
  moveFormUrlEncodedParam,
  setFormUrlEncodedParams
} from 'providers/ReduxStore/slices/collections';
import MultiLineEditor from 'components/MultiLineEditor';
import { sendRequest, saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import EditableTable from 'components/EditableTable';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const FormUrlEncodedParams = ({ item, collection }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { storedTheme } = useTheme();
  const params = item.draft ? get(item, 'draft.request.body.formUrlEncoded') : get(item, 'request.body.formUrlEncoded');

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));
  const handleRun = () => dispatch(sendRequest(item, collection.uid));

  const handleParamsChange = useCallback((updatedParams) => {
    dispatch(setFormUrlEncodedParams({
      collectionUid: collection.uid,
      itemUid: item.uid,
      params: updatedParams
    }));
  }, [dispatch, collection.uid, item.uid]);

  const handleParamDrag = useCallback(({ updateReorderedItem }) => {
    dispatch(moveFormUrlEncodedParam({
      collectionUid: collection.uid,
      itemUid: item.uid,
      updateReorderedItem
    }));
  }, [dispatch, collection.uid, item.uid]);

  const columns = [
    {
      key: 'name',
      name: t('COMMON.KEY'),
      isKeyField: true,
      placeholder: t('COMMON.KEY'),
      width: '30%'
    },
    {
      key: 'value',
      name: t('COMMON.VALUE'),
      placeholder: t('COMMON.VALUE'),
      render: ({ value, onChange }) => (
        <MultiLineEditor
          value={value || ''}
          theme={storedTheme}
          onSave={onSave}
          onChange={onChange}
          allowNewlines={true}
          onRun={handleRun}
          collection={collection}
          item={item}
          placeholder={!value ? 'Value' : ''}
        />
      )
    }
  ];

  const defaultRow = {
    name: '',
    value: '',
    description: ''
  };

  return (
    <StyledWrapper className="w-full">
      <EditableTable
        columns={columns}
        rows={params || []}
        onChange={handleParamsChange}
        defaultRow={defaultRow}
        reorderable={true}
        onReorder={handleParamDrag}
      />
    </StyledWrapper>
  );
};

export default FormUrlEncodedParams;
