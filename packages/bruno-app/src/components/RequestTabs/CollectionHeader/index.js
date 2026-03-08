import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  IconRun,
  IconEye,
  IconSettings
} from '@tabler/icons';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { uuid } from 'utils/common';
import EnvironmentSelector from 'components/Environments/EnvironmentSelector';
import ToolHint from 'components/ToolHint';
import JsSandboxMode from 'components/SecuritySettings/JsSandboxMode';
import ActionIcon from 'ui/ActionIcon';
import StyledWrapper from './StyledWrapper';

const CollectionHeader = ({ collection, isScratchCollection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  if (!collection || isScratchCollection) {
    return null;
  }

  const handleRun = () => {
    dispatch(addTab({ uid: uuid(), collectionUid: collection.uid, type: 'collection-runner' }));
  };

  const viewVariables = () => {
    dispatch(addTab({ uid: uuid(), collectionUid: collection.uid, type: 'variables' }));
  };

  const viewCollectionSettings = () => {
    dispatch(addTab({ uid: collection.uid, collectionUid: collection.uid, type: 'collection-settings' }));
  };

  return (
    <StyledWrapper>
      <ToolHint text={t('COLLECTION_HEADER.runner')} toolhintId="RunnerToolhintId" place="bottom">
        <ActionIcon onClick={handleRun} label={t('COLLECTION_HEADER.collectionRunner')} size="sm">
          <IconRun size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <ToolHint text={t('COLLECTION_HEADER.variables')} toolhintId="VariablesToolhintId">
        <ActionIcon onClick={viewVariables} label={t('COLLECTION_HEADER.collectionVariables')} size="sm">
          <IconEye size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <ToolHint text={t('COLLECTION_HEADER.collectionSettings')} toolhintId="CollectionSettingsToolhintId">
        <ActionIcon onClick={viewCollectionSettings} label={t('COLLECTION_HEADER.collectionSettingsLabel')} size="sm">
          <IconSettings size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <JsSandboxMode collection={collection} />
      <EnvironmentSelector collection={collection} />
    </StyledWrapper>
  );
};

export default CollectionHeader;
