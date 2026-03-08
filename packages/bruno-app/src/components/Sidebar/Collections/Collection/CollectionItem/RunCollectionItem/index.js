import React from 'react';
import get from 'lodash/get';
import { uuid } from 'utils/common';
import Modal from 'components/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { runCollectionFolder } from 'providers/ReduxStore/slices/collections/actions';
import { flattenItems } from 'utils/collections';
import StyledWrapper from './StyledWrapper';
import { areItemsLoading } from 'utils/collections';
import RunnerTags from 'components/RunnerResults/RunnerTags/index';
import { getRequestItemsForCollectionRun } from 'utils/collections/index';
import Button from 'ui/Button';
import { useTranslation } from 'react-i18next';

const RunCollectionItem = ({ collectionUid, item, onClose }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const collection = useSelector((state) => state.collections.collections?.find((c) => c.uid === collectionUid));
  const isCollectionRunInProgress = collection?.runnerResult?.info?.status && (collection?.runnerResult?.info?.status !== 'ended');

  // tags for the collection run
  const tags = get(collection, 'runnerTags', { include: [], exclude: [] });

  // have tags been enabled for the collection run
  const tagsEnabled = get(collection, 'runnerTagsEnabled', false);

  const onSubmit = (recursive) => {
    dispatch(
      addTab({
        uid: uuid(),
        collectionUid: collection.uid,
        type: 'collection-runner'
      })
    );
    if (!isCollectionRunInProgress) {
      dispatch(runCollectionFolder(collection.uid, item ? item.uid : null, recursive, 0, tagsEnabled && tags));
    }
    onClose();
  };

  const handleViewRunner = (e) => {
    e.preventDefault();
    dispatch(
      addTab({
        uid: uuid(),
        collectionUid: collection.uid,
        type: 'collection-runner'
      })
    );
    onClose();
  };

  const isFolderLoading = areItemsLoading(item);

  const requestItemsForRecursiveFolderRun = getRequestItemsForCollectionRun({ recursive: true, tags, items: item ? item.items : collection.items });
  const totalRequestItemsCountForRecursiveFolderRun = requestItemsForRecursiveFolderRun.length;
  const shouldDisableRecursiveFolderRun = totalRequestItemsCountForRecursiveFolderRun <= 0;

  const requestItemsForFolderRun = getRequestItemsForCollectionRun({ recursive: false, tags, items: item ? item.items : collection.items });
  const totalRequestItemsCountForFolderRun = requestItemsForFolderRun.length;
  const shouldDisableFolderRun = totalRequestItemsCountForFolderRun <= 0;

  return (
    <StyledWrapper>
      <Modal size="md" title={t('MODALS.COLLECTION_RUNNER_TITLE')} hideFooter={true} handleCancel={onClose}>
        <div>
          <div className="mb-1">
            <span className="font-medium">{t('SIDEBAR.RUN')}</span>
            <span className="ml-1 text-xs">{t('SIDEBAR.REQUESTS_COUNT', { count: totalRequestItemsCountForFolderRun })}</span>
          </div>
          <div className="mb-8">{t('SIDEBAR.RUN_FOLDER_ONLY')}</div>
          <div className="mb-1">
            <span className="font-medium">{t('SIDEBAR.RECURSIVE_RUN')}</span>
            <span className="ml-1 text-xs">{t('SIDEBAR.REQUESTS_COUNT', { count: totalRequestItemsCountForRecursiveFolderRun })}</span>
          </div>
          <div className={isFolderLoading ? 'mb-2' : 'mb-8'}>{t('SIDEBAR.RECURSIVE_RUN_DESC')}</div>
          {isFolderLoading ? <div className="mb-8 warning">{t('SIDEBAR.FOLDER_REQUESTS_LOADING')}</div> : null}
          {isCollectionRunInProgress ? <div className="mb-6 warning">{t('SIDEBAR.COLLECTION_RUN_IN_PROGRESS')}</div> : null}

          {/* Tags for the collection run */}
          <RunnerTags collectionUid={collection.uid} className="mb-6" />

          <div className="flex justify-end bruno-modal-footer">
            <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-3">
              {t('COMMON.CANCEL')}
            </Button>
            {
              isCollectionRunInProgress
                ? (
                    <Button type="submit" onClick={handleViewRunner}>
                      {t('SIDEBAR.VIEW_RUN')}
                    </Button>
                  )
                : (
                    <>
                      <Button type="submit" disabled={shouldDisableRecursiveFolderRun} onClick={() => onSubmit(true)} className="mr-3">
                        {t('SIDEBAR.RECURSIVE_RUN')}
                      </Button>
                      <Button type="submit" disabled={shouldDisableFolderRun} onClick={() => onSubmit(false)}>
                        {t('SIDEBAR.RUN')}
                      </Button>
                    </>
                  )
            }
          </div>
        </div>
      </Modal>
    </StyledWrapper>
  );
};

export default RunCollectionItem;
