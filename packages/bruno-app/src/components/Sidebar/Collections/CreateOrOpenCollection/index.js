import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../providers/Theme';
import { useDispatch, useSelector } from 'react-redux';
import { openCollection } from 'providers/ReduxStore/slices/collections/actions';

import toast from 'react-hot-toast';
import styled from 'styled-components';
import CreateCollection from 'components/Sidebar/CreateCollection';
import StyledWrapper from './StyledWrapper';

const LinkStyle = styled.span`
  color: ${(props) => props.theme['text-link']};
`;

const CreateOrOpenCollection = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);

  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  const handleOpenCollection = () => {
    dispatch(openCollection()).catch(
      (err) => {
        console.log(err);
        toast.error(t('CREATE_OR_OPEN_COLLECTION.openError'));
      }
    );
  };
  const CreateLink = () => (
    <LinkStyle
      className="underline text-link cursor-pointer"
      theme={theme}
      onClick={() => setCreateCollectionModalOpen(true)}
    >
      {t('CREATE_OR_OPEN_COLLECTION.create')}
    </LinkStyle>
  );
  const OpenLink = () => (
    <LinkStyle className="underline text-link cursor-pointer" theme={theme} onClick={() => handleOpenCollection(true)}>
      {t('CREATE_OR_OPEN_COLLECTION.open')}
    </LinkStyle>
  );

  return (
    <StyledWrapper className="px-2 mt-4">
      {createCollectionModalOpen ? (
        <CreateCollection
          onClose={() => setCreateCollectionModalOpen(false)}
        />
      ) : null}

      <div className="text-xs text-center">
        <div>{t('CREATE_OR_OPEN_COLLECTION.noCollectionsFound')}</div>
        <div className="mt-2">
          <CreateLink /> {t('CREATE_OR_OPEN_COLLECTION.or')} <OpenLink /> {t('CREATE_OR_OPEN_COLLECTION.collection')}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CreateOrOpenCollection;
