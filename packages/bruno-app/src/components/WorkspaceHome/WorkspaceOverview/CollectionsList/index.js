import React, { useState, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconBox, IconTrash, IconEdit, IconShare, IconDots, IconX, IconFolder } from '@tabler/icons';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { mountCollection, showInFolder } from 'providers/ReduxStore/slices/collections/actions';
import { getRevealInFolderLabel } from 'utils/common/platform';
import { normalizePath } from 'utils/common/path';
import toast from 'react-hot-toast';
import RenameCollection from 'components/Sidebar/Collections/Collection/RenameCollection';
import RemoveCollection from 'components/Sidebar/Collections/Collection/RemoveCollection';
import DeleteCollection from 'components/Sidebar/Collections/Collection/DeleteCollection';
import ShareCollection from 'components/ShareCollection';
import Dropdown from 'components/Dropdown';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const CollectionsList = ({ workspace }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { collections } = useSelector((state) => state.collections);
  const dropdownRefs = useRef({});

  const [renameCollectionModalOpen, setRenameCollectionModalOpen] = useState(false);
  const [removeCollectionModalOpen, setRemoveCollectionModalOpen] = useState(false);
  const [deleteCollectionModalOpen, setDeleteCollectionModalOpen] = useState(false);
  const [shareCollectionModalOpen, setShareCollectionModalOpen] = useState(false);
  const [selectedCollectionUid, setSelectedCollectionUid] = useState(null);

  const workspaceCollections = useMemo(() => {
    if (!workspace.collections || workspace.collections.length === 0) {
      return [];
    }

    const filteredCollections = workspace.collections.filter((wc) => {
      if (workspace.scratchTempDirectory) {
        return normalizePath(wc.path) !== normalizePath(workspace.scratchTempDirectory);
      }
      return true;
    });

    return filteredCollections.map((wc) => {
      const loadedCollection = collections.find((c) => c.uid === wc.uid);

      if (loadedCollection) {
        return {
          ...loadedCollection,
          isGitBacked: !!wc.remote,
          gitRemoteUrl: wc.remote
        };
      }

      return {
        uid: wc.uid,
        name: wc.name,
        items: [],
        environments: [],
        isGitBacked: !!wc.remote,
        isLoaded: false,
        gitRemoteUrl: wc.remote,
        git: { gitRootPath: null },
        brunoConfig: {},
        root: {
          request: {
            headers: [],
            auth: { mode: 'none' },
            vars: { req: [], res: [] },
            script: { req: '', res: '' },
            tests: ''
          },
          docs: ''
        }
      };
    });
  }, [workspace.collections, workspace.scratchTempDirectory, collections]);

  const handleOpenCollectionClick = (collection, event) => {
    if (event.target.closest('.collection-menu')) {
      return;
    }

    if (collection.isLoaded === false) {
      if (collection.isGitBacked) {
        toast.error(t('WORKSPACE.COLLECTION_NEEDS_CLONE', { name: collection.name }));
      } else {
        toast.error(t('WORKSPACE.COLLECTION_NOT_ON_DISK', { name: collection.name }));
      }
      return;
    }

    dispatch(
      mountCollection({
        collectionUid: collection.uid,
        collectionPathname: collection.pathname,
        brunoConfig: collection.brunoConfig
      })
    );

    dispatch(
      addTab({
        uid: collection.uid,
        collectionUid: collection.uid,
        type: 'collection-settings'
      })
    );
  };

  const handleRenameCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error(t('WORKSPACE.CANNOT_RENAME_UNCLONED'));
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setRenameCollectionModalOpen(true);
  };

  const handleShareCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error(t('WORKSPACE.CLONE_BEFORE_SHARE'));
      return;
    }

    dispatch(
      mountCollection({
        collectionUid: collection.uid,
        collectionPathname: collection.pathname,
        brunoConfig: collection.brunoConfig
      })
    );

    setSelectedCollectionUid(collection.uid);
    setShareCollectionModalOpen(true);
  };

  const handleRemoveCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error(t('WORKSPACE.CANNOT_REMOVE_UNLOADED'));
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setRemoveCollectionModalOpen(true);
  };

  const handleDeleteCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error(t('WORKSPACE.CANNOT_DELETE_UNLOADED'));
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setDeleteCollectionModalOpen(true);
  };

  const handleShowInFolder = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    dispatch(showInFolder(collection.pathname)).catch((error) => {
      console.error('Error opening the folder', error);
      toast.error(t('WORKSPACE.ERROR_OPENING_FOLDER'));
    });
  };

  return (
    <StyledWrapper>
      {renameCollectionModalOpen && selectedCollectionUid && (
        <RenameCollection
          collectionUid={selectedCollectionUid}
          onClose={() => {
            setRenameCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {removeCollectionModalOpen && selectedCollectionUid && (
        <RemoveCollection
          collectionUid={selectedCollectionUid}
          onClose={() => {
            setRemoveCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {deleteCollectionModalOpen && selectedCollectionUid && (
        <DeleteCollection
          collectionUid={selectedCollectionUid}
          workspaceUid={workspace.uid}
          onClose={() => {
            setDeleteCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {shareCollectionModalOpen && selectedCollectionUid && (
        <ShareCollection
          collectionUid={selectedCollectionUid}
          onClose={() => {
            setShareCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      <div className="collections-list">
        {workspaceCollections.length === 0 ? (
          <div className="empty-state">
            <IconBox size={32} strokeWidth={1.5} className="empty-icon" />
            <h3 className="empty-title">{t('WORKSPACE.NO_COLLECTIONS')}</h3>
            <p className="empty-description">{t('WORKSPACE.NO_COLLECTIONS_DESC')}</p>
          </div>
        ) : (
          workspaceCollections.map((collection, index) => (
            <div
              key={collection.uid || index}
              className="collection-card"
              onClick={(e) => handleOpenCollectionClick(collection, e)}
            >
              <div className="collection-info">
                <div className="collection-header">
                  <div className="collection-icon-wrapper">
                    <IconBox size={18} strokeWidth={1.5} />
                  </div>
                  <div className="collection-name">{collection.name}</div>
                </div>
                <div className="collection-path">{collection.pathname}</div>
              </div>
              <div className="collection-menu">
                <Dropdown
                  style="new"
                  placement="bottom-end"
                  onCreate={(ref) => (dropdownRefs.current[collection.uid] = ref)}
                  icon={<IconDots size={18} strokeWidth={1.5} />}
                >
                  <div className="collection-dropdown">
                    <div
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameCollection(collection);
                      }}
                    >
                      <IconEdit size={16} strokeWidth={1.5} />
                      <span>{t('COMMON.RENAME')}</span>
                    </div>
                    <div
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareCollection(collection);
                      }}
                    >
                      <IconShare size={16} strokeWidth={1.5} />
                      <span>{t('WORKSPACE.SHARE')}</span>
                    </div>
                    <div
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowInFolder(collection);
                      }}
                    >
                      <IconFolder size={16} strokeWidth={1.5} />
                      <span>{getRevealInFolderLabel()}</span>
                    </div>
                    <div
                      className="dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCollection(collection);
                      }}
                    >
                      <IconX size={16} strokeWidth={1.5} />
                      <span>{t('WORKSPACE.REMOVE')}</span>
                    </div>
                    <div
                      className="dropdown-item delete-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCollection(collection);
                      }}
                    >
                      <IconTrash size={16} strokeWidth={1.5} />
                      <span>{t('COMMON.DELETE')}</span>
                    </div>
                  </div>
                </Dropdown>
              </div>
            </div>
          ))
        )}
      </div>
    </StyledWrapper>
  );
};

export default CollectionsList;
