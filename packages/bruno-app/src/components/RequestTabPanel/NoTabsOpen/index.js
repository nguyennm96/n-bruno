import React, { useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import {
  IconBrandGraphql,
  IconPlugConnected,
  IconBroadcast,
  IconWorld,
  IconSearch,
  IconPlus,
  IconDownload,
  IconFolder
} from '@tabler/icons';
import { openCollection, importCollection, importCollectionFromZip } from 'providers/ReduxStore/slices/collections/actions';
import { selectIsAuthenticated } from 'providers/ReduxStore/slices/auth';
import toast from 'react-hot-toast';
import CreateCollection from 'components/Sidebar/CreateCollection';
import ImportCollection from 'components/Sidebar/ImportCollection';
import ImportCollectionLocation from 'components/Sidebar/ImportCollectionLocation';
import GlobalSearchModal from 'components/GlobalSearchModal';
import { storage } from 'utils/storage';
import { useTranslation } from 'react-i18next';

const isMac = typeof window !== 'undefined' && navigator.platform?.toLowerCase().includes('mac');
const MOD = isMac ? '\u2318' : 'Ctrl';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: \${({ theme }) => theme.background.base};

  @keyframes welcome-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    width: 340px;
  }

  .logo-circle {
    animation: welcome-fade-up 0.3s ease both;
    animation-delay: 0s;
  }

  .action-list {
    animation: welcome-fade-up 0.3s ease both;
    animation-delay: 0.06s;
  }

  .type-icons {
    animation: welcome-fade-up 0.3s ease both;
    animation-delay: 0.12s;
  }

  .logo-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: \${({ theme }) => theme.background.surface0};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 52px;
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  }

  .action-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 0;
    cursor: pointer;
    border-radius: \${({ theme }) => theme.border.radius.base};
    transition: background 0.1s ease;

    &:hover .action-label {
      color: \${({ theme }) => theme.text};
    }
  }

  .action-label {
    font-size: \${({ theme }) => theme.font.size.md};
    color: \${({ theme }) => theme.colors.text.muted};
    transition: color 0.1s ease;
  }

  .kbd-group {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    border-radius: 5px;
    border: 1px solid \${({ theme }) => theme.border.border2};
    background: \${({ theme }) => theme.background.surface0};
    color: \${({ theme }) => theme.colors.text.muted};
    font-size: 11px;
    font-family: inherit;
    line-height: 1;
  }

  .type-icons {
    display: flex;
    align-items: center;
    gap: 22px;
  }

  .type-icon {
    color: \${({ theme }) => theme.colors.text.muted};
    opacity: 0.45;
    display: flex;
    align-items: center;
  }
`;

const NoTabsOpen = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);
  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionLocationModalOpen, setImportCollectionLocationModalOpen] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [importData, setImportData] = useState(null);

  const handleNewCollection = async () => {
    try {
      if (!isAuthenticated && activeWorkspace?.pathname) {
        await storage.ensureCollectionsFolder(activeWorkspace.pathname);
      }
      setCreateCollectionModalOpen(true);
    } catch {
      toast.error(t('SIDEBAR.PREPARE_WORKSPACE_ERROR'));
    }
  };

  const handleOpenCollection = () => {
    dispatch(openCollection()).catch(() => toast.error(t('WELCOME.COLLECTION_OPEN_ERROR')));
  };

  const handleImportSubmit = ({ rawData, type, ...rest }) => {
    setImportCollectionModalOpen(false);
    const collectionLocation = activeWorkspace?.pathname || null;

    if (rawData.brunoConfig) {
      setImportData({ collection: rawData, collectionLocation });
      setImportCollectionLocationModalOpen(true);
      return;
    }

    dispatch(
      rawData.zipFilePath
        ? importCollectionFromZip(rawData.zipFilePath, collectionLocation)
        : importCollection(rawData, collectionLocation, rest)
    ).catch(() => toast.error(t('WELCOME.COLLECTION_IMPORT_ERROR')));
  };

  const handleImportLocationSubmit = (collectionLocation) => {
    setImportCollectionLocationModalOpen(false);
    if (importData) {
      dispatch(importCollection(importData.collection, collectionLocation)).catch(() =>
        toast.error(t('WELCOME.COLLECTION_IMPORT_ERROR'))
      );
      setImportData(null);
    }
  };

  const actions = [
    {
      label: t('WELCOME.CREATE_COLLECTION'),
      keys: [MOD, 'N'],
      onClick: handleNewCollection
    },
    ...(!isAuthenticated ? [{
      label: t('WELCOME.OPEN_COLLECTION'),
      keys: [MOD, 'O'],
      onClick: handleOpenCollection
    }] : []),
    {
      label: t('WELCOME.IMPORT_COLLECTION'),
      keys: null,
      onClick: () => setImportCollectionModalOpen(true)
    },
    {
      label: t('SIDEBAR.GLOBAL_SEARCH'),
      keys: [MOD, 'K'],
      onClick: () => setShowGlobalSearch(true)
    }
  ];

  return (
    <StyledWrapper>
      {createCollectionModalOpen && (
        <CreateCollection
          collectionLocation={activeWorkspace?.pathname}
          onClose={() => setCreateCollectionModalOpen(false)}
        />
      )}
      {importCollectionModalOpen && (
        <ImportCollection
          onClose={() => setImportCollectionModalOpen(false)}
          handleSubmit={handleImportSubmit}
        />
      )}
      {importCollectionLocationModalOpen && importData && (
        <ImportCollectionLocation
          collectionName={importData.collection?.name}
          onClose={() => setImportCollectionLocationModalOpen(false)}
          handleSubmit={handleImportLocationSubmit}
        />
      )}
      {showGlobalSearch && (
        <GlobalSearchModal isOpen={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />
      )}

      <div className="inner">
        <div className="logo-circle">🐶</div>

        <div className="action-list">
          {actions.map(({ label, keys, onClick }) => (
            <div key={label} className="action-row" onClick={onClick}>
              <span className="action-label">{label}</span>
              {keys && (
                <div className="kbd-group">
                  {keys.map((k, i) => <kbd key={i}>{k}</kbd>)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="type-icons">
          <span className="type-icon" title="HTTP"><IconWorld size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title={t('REQUEST.GRAPHQL_TYPE')}><IconBrandGraphql size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title={t('REQUEST.GRPC_TYPE')}><IconPlugConnected size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title={t('REQUEST.WEBSOCKET_TYPE')}><IconBroadcast size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title="Search"><IconSearch size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title={t('REQUEST.NEW_REQUEST')}><IconPlus size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title="Open"><IconFolder size={20} strokeWidth={1.4} /></span>
          <span className="type-icon" title="Import"><IconDownload size={20} strokeWidth={1.4} /></span>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default NoTabsOpen;
