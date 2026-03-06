import get from 'lodash/get';
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
        placeholder="Click to add folder documentation..."
      />
      <div className="flex-shrink-0 flex justify-end">
        <Button type="submit" size="sm" onClick={onSave}>
          Save
        </Button>
      </div>

      {/* Requests list */}
      <div className="folder-requests-title">
        Requests ({allRequests.length})
      </div>
      <div className="folder-request-list">
        {allRequests.length === 0 ? (
          <div className="folder-empty">No requests in this folder.</div>
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
