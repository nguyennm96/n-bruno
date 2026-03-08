import get from 'lodash/get';
import { useTranslation } from 'react-i18next';
import { updateFolderDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch } from 'react-redux';
import { saveFolderRoot } from 'providers/ReduxStore/slices/collections/actions';
import { flattenItems } from 'utils/collections';
import MarkdownEditor from 'components/MarkdownEditor';
import MethodBadge from 'components/MarkdownEditor/MethodBadge';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const Documentation = ({ collection, folder }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  if (!folder) return null;

  const docs = folder.draft ? get(folder, 'draft.docs', '') : get(folder, 'root.docs', '');

  const onEdit = (value) => {
    dispatch(updateFolderDocs({ folderUid: folder.uid, collectionUid: collection.uid, docs: value }));
  };

  const onSave = () => dispatch(saveFolderRoot(collection.uid, folder.uid));

  const allRequests = flattenItems(folder.items || []).filter(
    (i) => i.type === 'http-request' || i.type === 'graphql-request' || i.type === 'grpc-request' || i.type === 'ws-request'
  );

  return (
    <StyledWrapper className="w-full flex flex-col gap-3">
      <MarkdownEditor
        value={docs || ''}
        onEdit={onEdit}
        onSave={onSave}
        height={280}
        placeholder={t('FOLDER_SETTINGS.DOCUMENTATION.PLACEHOLDER')}
      />
      <div className="flex-shrink-0 flex justify-end">
        <Button type="submit" size="sm" onClick={onSave}>
          {t('COMMON.SAVE')}
        </Button>
      </div>

      {/* Requests list */}
      <div className="folder-requests-title">
        {t('FOLDER_SETTINGS.DOCUMENTATION.REQUESTS')} ({allRequests.length})
      </div>
      <div className="folder-request-list">
        {allRequests.length === 0 ? (
          <div className="folder-empty">{t('FOLDER_SETTINGS.DOCUMENTATION.NO_REQUESTS')}</div>
        ) : (
          allRequests.map((req) => (
            <div key={req.uid} className="folder-request-item">
              <MethodBadge item={req} />
              <span className="folder-request-name">{req.name}</span>
              <span className="folder-request-url">{req.request?.url || ''}</span>
            </div>
          ))
        )}
      </div>
    </StyledWrapper>
  );
};

export default Documentation;
