import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTotalRequestCountInCollection } from 'utils/collections/';
import { IconWorld, IconApi, IconShare, IconBook } from '@tabler/icons';
import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ShareCollection from 'components/ShareCollection/index';
import GenerateDocumentation from 'components/Sidebar/Collections/Collection/GenerateDocumentation';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import StyledWrapper from './StyledWrapper';

const Info = ({ collection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const isCollectionLoading = collection.isLoading;

  const totalRequestsInCollection = useMemo(
    () => getTotalRequestCountInCollection(collection),
    [collection.items]
  );
  const [showShareCollectionModal, toggleShowShareCollectionModal] = useState(false);
  const [showGenerateDocumentationModal, setShowGenerateDocumentationModal] = useState(false);

  const globalEnvironments = useSelector((state) => state.globalEnvironments.globalEnvironments);

  const collectionEnvironmentCount = collection.environments?.length || 0;
  const globalEnvironmentCount = globalEnvironments?.length || 0;

  const handleToggleShowShareCollectionModal = (value) => (e) => {
    toggleShowShareCollectionModal(value);
  };

  return (
    <StyledWrapper className="w-full flex flex-col h-fit">
      <div className="rounded-lg py-6">
        <div className="grid gap-5">
          {/* Environments Row */}
          <div className="flex items-start">
            <div className="icon-box environments flex-shrink-0 p-3 rounded-lg">
              <IconWorld className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4">
              <div className="font-medium">{t('OVERVIEW_INFO.environments')}</div>
              <div className="mt-1 flex flex-col gap-1">
                <button
                  type="button"
                  className="text-link cursor-pointer hover:underline text-left bg-transparent"
                  onClick={() => {
                    dispatch(
                      addTab({
                        uid: `${collection.uid}-environment-settings`,
                        collectionUid: collection.uid,
                        type: 'environment-settings'
                      })
                    );
                  }}
                >
                  {collectionEnvironmentCount === 1
                    ? t('OVERVIEW_INFO.collectionEnvironment', { count: collectionEnvironmentCount })
                    : t('OVERVIEW_INFO.collectionEnvironments', { count: collectionEnvironmentCount })}
                </button>
                <button
                  type="button"
                  className="text-link cursor-pointer hover:underline text-left bg-transparent"
                  onClick={() => {
                    dispatch(
                      addTab({
                        uid: `${collection.uid}-global-environment-settings`,
                        collectionUid: collection.uid,
                        type: 'global-environment-settings'
                      })
                    );
                  }}
                >
                  {globalEnvironmentCount === 1
                    ? t('OVERVIEW_INFO.globalEnvironment', { count: globalEnvironmentCount })
                    : t('OVERVIEW_INFO.globalEnvironments', { count: globalEnvironmentCount })}
                </button>
              </div>
            </div>
          </div>

          {/* Requests Row */}
          <div className="flex items-start">
            <div className="icon-box requests flex-shrink-0 p-3 rounded-lg">
              <IconApi className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4">
              <div className="font-medium">{t('OVERVIEW_INFO.requests')}</div>
              <div className="mt-1 text-muted">
                {
                  isCollectionLoading
                    ? t('OVERVIEW_INFO.loadingRequests')
                    : totalRequestsInCollection === 1
                      ? t('OVERVIEW_INFO.requestInCollection', { count: totalRequestsInCollection })
                      : t('OVERVIEW_INFO.requestsInCollection', { count: totalRequestsInCollection })
                }
              </div>
            </div>
          </div>

          <div className="flex items-start group cursor-pointer" onClick={handleToggleShowShareCollectionModal(true)}>
            <div className="icon-box share flex-shrink-0 p-3 rounded-lg">
              <IconShare className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4 h-full flex flex-col justify-start">
              <div className="font-medium h-fit my-auto">{t('OVERVIEW_INFO.share')}</div>
              <div className="group-hover:underline text-link">
                {t('OVERVIEW_INFO.shareCollection')}
              </div>
            </div>
          </div>
          {showShareCollectionModal && <ShareCollection collectionUid={collection.uid} onClose={handleToggleShowShareCollectionModal(false)} />}

          <div className="flex items-start group cursor-pointer" onClick={() => setShowGenerateDocumentationModal(true)}>
            <div className="icon-box generate-docs flex-shrink-0 p-3 rounded-lg">
              <IconBook className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4 h-full flex flex-col justify-start">
              <div className="font-medium h-fit my-auto">{t('OVERVIEW_INFO.documentation')}</div>
              <div className="group-hover:underline text-link">
                {t('OVERVIEW_INFO.generateDocs')}
              </div>
            </div>
          </div>
          {showGenerateDocumentationModal && <GenerateDocumentation collectionUid={collection.uid} onClose={() => setShowGenerateDocumentationModal(false)} />}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default Info;
