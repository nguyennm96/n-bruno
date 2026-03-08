import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import get from 'lodash/get';
import { IconCaretDown } from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';
import { useDispatch } from 'react-redux';
import { updateCollectionAuthMode } from 'providers/ReduxStore/slices/collections';
import { humanizeRequestAuthMode } from 'utils/collections';
import StyledWrapper from './StyledWrapper';

const AuthMode = ({ collection }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const authMode = collection.draft?.root ? get(collection, 'draft.root.request.auth.mode') : get(collection, 'root.request.auth.mode');

  const onModeChange = useCallback((value) => {
    dispatch(
      updateCollectionAuthMode({
        collectionUid: collection.uid,
        mode: value
      })
    );
  }, [dispatch, collection.uid]);

  const menuItems = useMemo(() => [
    {
      id: 'awsv4',
      label: t('REQUEST.AUTH.AWS_SIG_V4'),
      onClick: () => onModeChange('awsv4')
    },
    {
      id: 'basic',
      label: t('REQUEST.AUTH.BASIC_AUTH'),
      onClick: () => onModeChange('basic')
    },
    {
      id: 'wsse',
      label: t('REQUEST.AUTH.WSSE_AUTH'),
      onClick: () => onModeChange('wsse')
    },
    {
      id: 'bearer',
      label: t('REQUEST.AUTH.BEARER_TOKEN'),
      onClick: () => onModeChange('bearer')
    },
    {
      id: 'digest',
      label: t('REQUEST.AUTH.DIGEST_AUTH'),
      onClick: () => onModeChange('digest')
    },
    {
      id: 'ntlm',
      label: t('REQUEST.AUTH.NTLM_AUTH'),
      onClick: () => onModeChange('ntlm')
    },
    {
      id: 'oauth2',
      label: t('REQUEST.AUTH.OAUTH2'),
      onClick: () => onModeChange('oauth2')
    },
    {
      id: 'apikey',
      label: t('REQUEST.AUTH.API_KEY'),
      onClick: () => onModeChange('apikey')
    },
    {
      id: 'none',
      label: t('REQUEST.AUTH.NO_AUTH'),
      onClick: () => onModeChange('none')
    }
  ], [onModeChange, t]);

  return (
    <StyledWrapper>
      <div className="inline-flex items-center cursor-pointer auth-mode-selector">
        <MenuDropdown
          items={menuItems}
          placement="bottom-end"
          selectedItemId={authMode}
        >
          <div className="flex items-center justify-center auth-mode-label select-none">
            {humanizeRequestAuthMode(authMode)} <IconCaretDown className="caret ml-1" size={14} strokeWidth={2} />
          </div>
        </MenuDropdown>
      </div>
    </StyledWrapper>
  );
};
export default AuthMode;
