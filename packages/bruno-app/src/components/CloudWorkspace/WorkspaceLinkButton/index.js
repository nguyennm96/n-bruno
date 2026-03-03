import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconCloud, IconCloudOff } from '@tabler/icons';
import {
  selectIsCollectionLinked,
  selectLinkedWorkspaceId,
  unlinkCollection
} from 'providers/ReduxStore/slices/cloudWorkspaces';
import WorkspaceSelector from '../WorkspaceSelector';
import StyledWrapper from './StyledWrapper';

/**
 * Button to link/unlink collection with cloud workspace
 */
const WorkspaceLinkButton = ({ collectionPath, collectionName }) => {
  const dispatch = useDispatch();
  const [showSelector, setShowSelector] = useState(false);

  const isLinked = useSelector((state) => selectIsCollectionLinked(state, collectionPath));
  const workspaceId = useSelector((state) => selectLinkedWorkspaceId(state, collectionPath));

  const handleLinkClick = () => {
    if (isLinked) {
      // Unlink
      if (confirm(`Unlink "${collectionName}" from cloud workspace?`)) {
        dispatch(unlinkCollection({ collectionPath, collectionName }));
      }
    } else {
      // Show workspace selector
      setShowSelector(true);
    }
  };

  const handleWorkspaceSelected = () => {
    setShowSelector(false);
  };

  return (
    <StyledWrapper>
      <button
        className={`link-button ${isLinked ? 'linked' : ''}`}
        onClick={handleLinkClick}
        title={isLinked ? 'Unlink from cloud workspace' : 'Link to cloud workspace'}
      >
        {isLinked ? (
          <>
            <IconCloud size={14} strokeWidth={1.5} />
            <span>Linked</span>
          </>
        ) : (
          <>
            <IconCloudOff size={14} strokeWidth={1.5} />
            <span>Link to Cloud</span>
          </>
        )}
      </button>

      {showSelector && (
        <WorkspaceSelector
          collectionPath={collectionPath}
          collectionName={collectionName}
          onClose={() => setShowSelector(false)}
          onSelect={handleWorkspaceSelected}
        />
      )}
    </StyledWrapper>
  );
};

export default WorkspaceLinkButton;
