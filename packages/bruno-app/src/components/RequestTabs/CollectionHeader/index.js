import { useDispatch } from 'react-redux';
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
      <ToolHint text="Runner" toolhintId="RunnerToolhintId" place="bottom">
        <ActionIcon onClick={handleRun} aria-label="Runner" size="sm">
          <IconRun size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <ToolHint text="Variables" toolhintId="VariablesToolhintId">
        <ActionIcon onClick={viewVariables} aria-label="Variables" size="sm">
          <IconEye size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <ToolHint text="Collection Settings" toolhintId="CollectionSettingsToolhintId">
        <ActionIcon onClick={viewCollectionSettings} aria-label="Collection Settings" size="sm">
          <IconSettings size={16} strokeWidth={1.5} />
        </ActionIcon>
      </ToolHint>
      <JsSandboxMode collection={collection} />
      <EnvironmentSelector collection={collection} />
    </StyledWrapper>
  );
};

export default CollectionHeader;
