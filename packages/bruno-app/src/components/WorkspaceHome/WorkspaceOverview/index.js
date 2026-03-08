import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { IconPlus, IconFolder, IconDownload } from '@tabler/icons';
import { importCollection, openCollection, importCollectionFromZip } from 'providers/ReduxStore/slices/collections/actions';
import toast from 'react-hot-toast';
import CreateCollection from 'components/Sidebar/CreateCollection';
import ImportCollection from 'components/Sidebar/ImportCollection';
import ImportCollectionLocation from 'components/Sidebar/ImportCollectionLocation';
import BulkImportCollectionLocation from 'components/Sidebar/BulkImportCollectionLocation';
import { storage } from 'utils/storage';
import Button from 'ui/Button';
import CollectionsList from './CollectionsList';
import WorkspaceDocs from '../WorkspaceDocs';
import StyledWrapper from './StyledWrapper';
import { useTranslation } from 'react-i18next';

const WorkspaceOverview = ({ workspace }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { globalEnvironments } = useSelector((state) => state.globalEnvironments);

  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);
  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionLocationModalOpen, setImportCollectionLocationModalOpen] = useState(false);
  const [importData, setImportData] = useState(null);

  const workspaceCollectionsCount = workspace?.collections?.length || 0;

  const workspaceEnvironmentsCount = globalEnvironments?.length || 0;

  const handleCreateCollection = async () => {
    if (!workspace?.pathname) {
      toast.error(t('WORKSPACE.PATH_NOT_FOUND'));
      return;
    }

    try {
      await storage.ensureCollectionsFolder(workspace.pathname);
      setCreateCollectionModalOpen(true);
    } catch (error) {
      console.error('Error ensuring collections folder exists:', error);
      toast.error(t('WORKSPACE.PREPARE_ERROR'));
    }
  };

  const handleOpenCollection = () => {
    dispatch(openCollection()).catch((err) => {
      console.error(err);
      toast.error(t('WORKSPACE.OPEN_COLLECTION_ERROR'));
    });
  };

  const handleImportCollection = () => {
    setImportCollectionModalOpen(true);
  };

  const handleImportCollectionSubmit = ({ rawData, type, ...rest }) => {
    setImportCollectionModalOpen(false);

    setImportData({ rawData, type, ...rest });
    setImportCollectionLocationModalOpen(true);
  };

  const handleImportCollectionLocation = (convertedCollection, collectionLocation, options = {}) => {
    const importAction = options.isZipImport
      ? importCollectionFromZip(convertedCollection.zipFilePath, collectionLocation)
      : importCollection(convertedCollection, collectionLocation, options);

    dispatch(importAction)
      .then(() => {
        setImportCollectionLocationModalOpen(false);
        setImportData(null);
      });
  };

  return (
    <StyledWrapper>
      {createCollectionModalOpen && (
        <CreateCollection onClose={() => setCreateCollectionModalOpen(false)} />
      )}

      {importCollectionModalOpen && (
        <ImportCollection
          onClose={() => setImportCollectionModalOpen(false)}
          handleSubmit={handleImportCollectionSubmit}
        />
      )}

      {importCollectionLocationModalOpen && importData && (importData.type !== 'multiple' && importData.type !== 'bulk') && (
        <ImportCollectionLocation
          rawData={importData.rawData}
          format={importData.type}
          onClose={() => setImportCollectionLocationModalOpen(false)}
          handleSubmit={handleImportCollectionLocation}
        />
      )}
      {importCollectionLocationModalOpen && importData && (importData.type === 'multiple' || importData.type === 'bulk') && (
        <BulkImportCollectionLocation
          importData={importData}
          onClose={() => setImportCollectionLocationModalOpen(false)}
          handleSubmit={handleImportCollectionLocation}
        />
      )}
      <div className="overview-layout">
        <div className="overview-main">
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-value">{workspaceCollectionsCount}</span>
              <span className="stat-label">{t('COMMON.COLLECTIONS')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{workspaceEnvironmentsCount}</span>
              <span className="stat-label">{t('ENVIRONMENTS.TITLE')}</span>
            </div>
          </div>

          <div className="quick-actions-section">
            <div className="section-title">{t('WORKSPACE.QUICK_ACTIONS')}</div>
            <div className="quick-actions-buttons">
              <Button
                color="light"
                size="sm"
                icon={<IconPlus size={14} strokeWidth={1.5} />}
                onClick={handleCreateCollection}
              >
                {t('WELCOME.CREATE_COLLECTION')}
              </Button>
              <Button
                color="light"
                size="sm"
                icon={<IconFolder size={14} strokeWidth={1.5} />}
                onClick={handleOpenCollection}
              >
                {t('WELCOME.OPEN_COLLECTION')}
              </Button>
              <Button
                color="light"
                size="sm"
                icon={<IconDownload size={14} strokeWidth={1.5} />}
                onClick={handleImportCollection}
              >
                {t('WELCOME.IMPORT_COLLECTION')}
              </Button>
            </div>
          </div>

          <div className="collections-section">
            <div className="section-title">{t('COMMON.COLLECTIONS')}</div>
            <CollectionsList workspace={workspace} />
          </div>
        </div>

        <div className="overview-docs">
          <WorkspaceDocs workspace={workspace} />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default WorkspaceOverview;
