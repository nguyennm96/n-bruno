import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import get from 'lodash/get';
import { useDispatch, useSelector } from 'react-redux';
import {
  IconArrowsSort,
  IconDotsVertical,
  IconDownload,
  IconFolder,
  IconPlus,
  IconSearch,
  IconSortAscendingLetters,
  IconSortDescendingLetters,
  IconSquareX,
  IconBox,
  IconTerminal2
} from '@tabler/icons';

import { importCollection, openCollection, importCollectionFromZip } from 'providers/ReduxStore/slices/collections/actions';
import { sortCollections } from 'providers/ReduxStore/slices/collections/index';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import { isScratchCollection } from 'utils/collections';

import MenuDropdown from 'ui/MenuDropdown';
import ActionIcon from 'ui/ActionIcon';
import ImportCollection from 'components/Sidebar/ImportCollection';
import ImportCollectionLocation from 'components/Sidebar/ImportCollectionLocation';
import BulkImportCollectionLocation from 'components/Sidebar/BulkImportCollectionLocation';
import RemoveCollectionsModal from 'components/Sidebar/Collections/RemoveCollectionsModal/index';
import CreateCollection from 'components/Sidebar/CreateCollection';
import WelcomeModal from 'components/WelcomeModal';
import Collections from 'components/Sidebar/Collections';
import SidebarSection from 'components/Sidebar/SidebarSection';
import { openDevtoolsAndSwitchToTerminal } from 'utils/terminal';

const CollectionsSection = () => {
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);
  const dispatch = useDispatch();

  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  const { collections } = useSelector((state) => state.collections);
  const { collectionSortOrder } = useSelector((state) => state.collections);
  const preferences = useSelector((state) => state.app.preferences);
  const [collectionsToClose, setCollectionsToClose] = useState([]);

  const [importData, setImportData] = useState(null);
  const [createCollectionModalOpen, setCreateCollectionModalOpen] = useState(false);
  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionLocationModalOpen, setImportCollectionLocationModalOpen] = useState(false);

  // Default to true (don't show modal) so that:
  // 1. Existing users who upgrade (no hasSeenWelcomeModal in their prefs) don't see it
  // 2. The modal doesn't flash before preferences are loaded from the electron process
  // Only genuinely new users will have hasSeenWelcomeModal explicitly set to false by onboarding
  const hasSeenWelcomeModal = get(preferences, 'onboarding.hasSeenWelcomeModal', true);
  const showWelcomeModal = !hasSeenWelcomeModal;

  const handleDismissWelcomeModal = () => {
    const updatedPreferences = {
      ...preferences,
      onboarding: {
        ...preferences.onboarding,
        hasSeenWelcomeModal: true
      }
    };
    dispatch(savePreferences(updatedPreferences)).catch(() => {
      toast.error(t('COLLECTIONS_SECTION.failedSavePreferences'));
    });
  };

  const workspaceCollections = useMemo(() => {
    if (!activeWorkspace) return [];

    return collections.filter((c) => {
      if (isScratchCollection(c, workspaces)) {
        return false;
      }
      return activeWorkspace.collections?.some((wc) => wc.uid === c.uid);
    });
  }, [activeWorkspace, collections, workspaces]);

  const handleImportCollection = ({ rawData, type, ...rest }) => {
    setImportCollectionModalOpen(false);

    setImportData({ rawData, type, ...rest });
    setImportCollectionLocationModalOpen(true);
  };

  const handleImportCollectionLocation = (convertedCollection, _collectionLocation, options = {}) => {
    const importAction = options.isZipImport
      ? importCollectionFromZip(convertedCollection.zipFilePath, null)
      : importCollection(convertedCollection, null, options);

    dispatch(importAction)
      .then(() => {
        setImportCollectionLocationModalOpen(false);
        setImportData(null);
      });
  };

  const handleToggleSearch = () => {
    setShowSearch((prev) => !prev);
  };

  const handleSortCollections = () => {
    let order;
    switch (collectionSortOrder) {
      case 'default':
        order = 'alphabetical';
        break;
      case 'alphabetical':
        order = 'reverseAlphabetical';
        break;
      case 'reverseAlphabetical':
        order = 'default';
        break;
      default:
        order = 'default';
        break;
    }
    dispatch(sortCollections({ order }));
  };

  const getSortIcon = () => {
    switch (collectionSortOrder) {
      case 'alphabetical':
        return IconSortDescendingLetters;
      case 'reverseAlphabetical':
        return IconArrowsSort;
      default:
        return IconSortAscendingLetters;
    }
  };

  const getSortLabel = () => {
    switch (collectionSortOrder) {
      case 'alphabetical':
        return t('COLLECTIONS_SECTION.sortZA');
      case 'reverseAlphabetical':
        return t('COLLECTIONS_SECTION.clearSort');
      default:
        return t('COLLECTIONS_SECTION.sortAZ');
    }
  };

  const selectAllCollectionsToClose = () => {
    setCollectionsToClose(workspaceCollections.map((c) => c.uid));
  };

  const clearCollectionsToClose = () => {
    setCollectionsToClose([]);
  };

  const handleOpenCollection = () => {
    const options = {};
    if (activeWorkspace?.pathname) {
      options.workspaceId = activeWorkspace.pathname;
    }

    dispatch(openCollection(options)).catch((err) => {
      toast.error(t('COLLECTIONS_SECTION.openCollectionError'));
    });
  };

  const addDropdownItems = [
    {
      id: 'create',
      leftSection: IconPlus,
      label: t('COLLECTIONS_SECTION.createCollection'),
      onClick: () => {
        setCreateCollectionModalOpen(true);
      }
    },
    {
      id: 'open',
      leftSection: IconFolder,
      label: t('COLLECTIONS_SECTION.openCollection'),
      onClick: () => {
        handleOpenCollection();
      }
    },
    {
      id: 'import',
      leftSection: IconDownload,
      label: t('COLLECTIONS_SECTION.importCollection'),
      onClick: () => {
        setImportCollectionModalOpen(true);
      }
    }
  ];

  const actionsDropdownItems = [
    {
      id: 'sort',
      leftSection: getSortIcon(),
      label: getSortLabel(),
      onClick: () => {
        handleSortCollections();
      }
    },
    {
      id: 'close-all',
      leftSection: IconSquareX,
      label: t('COLLECTIONS_SECTION.closeAll'),
      onClick: () => {
        selectAllCollectionsToClose();
      }
    },
    {
      id: 'open-in-terminal',
      leftSection: IconTerminal2,
      label: t('COLLECTIONS_SECTION.openInTerminal'),
      onClick: () => {
        openDevtoolsAndSwitchToTerminal(dispatch, activeWorkspace?.pathname);
      }
    }
  ];

  const sectionActions = (
    <>
      <ActionIcon
        onClick={handleToggleSearch}
        label="Search requests"
      >
        <IconSearch size={14} stroke={1.5} aria-hidden="true" />
      </ActionIcon>

      <MenuDropdown
        data-testid="collections-header-add-menu"
        items={addDropdownItems}
        placement="bottom-end"
      >
        <ActionIcon
          label={t('COLLECTIONS_SECTION.addNewCollection')}
        >
          <IconPlus size={14} stroke={1.5} aria-hidden="true" />
        </ActionIcon>
      </MenuDropdown>

      <MenuDropdown
        data-testid="collections-header-actions-menu"
        items={actionsDropdownItems}
        placement="bottom-end"
      >
        <ActionIcon
          label={t('COLLECTIONS_SECTION.moreActions')}
        >
          <IconDotsVertical size={14} stroke={1.5} aria-hidden="true" />
        </ActionIcon>
      </MenuDropdown>

      {collectionsToClose.length > 0 && (
        <RemoveCollectionsModal collectionUids={collectionsToClose} onClose={clearCollectionsToClose} />
      )}
    </>
  );

  return (
    <>
      {showWelcomeModal && (
        <WelcomeModal
          onDismiss={handleDismissWelcomeModal}
          onImportCollection={() => {
            handleDismissWelcomeModal();
            setImportCollectionModalOpen(true);
          }}
          onCreateCollection={() => {
            handleDismissWelcomeModal();
            setCreateCollectionModalOpen(true);
          }}
        />
      )}
      {createCollectionModalOpen && (
        <CreateCollection
          onClose={() => setCreateCollectionModalOpen(false)}
        />
      )}
      {importCollectionModalOpen && (
        <ImportCollection
          onClose={() => setImportCollectionModalOpen(false)}
          handleSubmit={handleImportCollection}
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
      <SidebarSection
        id="collections"
        title={t('COLLECTIONS_SECTION.title')}
        icon={IconBox}
        actions={sectionActions}
      >
        <Collections showSearch={showSearch} />
      </SidebarSection>
    </>
  );
};

export default CollectionsSection;
