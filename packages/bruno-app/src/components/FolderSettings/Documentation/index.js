import 'github-markdown-css/github-markdown.css';
import get from 'lodash/get';
import { updateFolderDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch } from 'react-redux';
import { saveFolderRoot } from 'providers/ReduxStore/slices/collections/actions';
import { flattenItems } from 'utils/collections';
import MarkdownEditor from 'components/MarkdownEditor';
import Button from 'ui/Button';
import styled from 'styled-components';

const StyledWrapper = styled.div`
  .folder-requests-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.text};
    opacity: 0.5;
    margin: 20px 0 10px;
  }

  .folder-request-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .folder-request-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 6px;
    font-size: 13px;
  }

  .folder-request-method {
    font-size: 10px;
    font-weight: 700;
    min-width: 38px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 3px;
    background-color: ${({ theme }) => theme.border.border0};
    font-family: var(--font-code, monospace);
    flex-shrink: 0;
  }

  .method-get    { color: ${({ theme }) => theme.request.methods.get}; }
  .method-post   { color: ${({ theme }) => theme.request.methods.post}; }
  .method-put    { color: ${({ theme }) => theme.request.methods.put}; }
  .method-delete { color: ${({ theme }) => theme.request.methods.delete}; }
  .method-patch  { color: ${({ theme }) => theme.request.methods.patch}; }
  .method-head   { color: ${({ theme }) => theme.request.methods.head}; }
  .method-options{ color: ${({ theme }) => theme.request.methods.options}; }
  .method-grpc   { color: ${({ theme }) => theme.request.grpc}; }
  .method-ws     { color: ${({ theme }) => theme.request.ws}; }
  .method-graphql{ color: ${({ theme }) => theme.request.gql}; }

  .folder-request-name {
    flex: 1;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-request-url {
    font-size: 11px;
    color: ${({ theme }) => theme.text};
    opacity: 0.45;
    font-family: var(--font-code, monospace);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .folder-empty {
    font-size: 12px;
    font-style: italic;
    opacity: 0.4;
    padding: 8px 0;
  }
`;

const getMethodLabel = (item) => {
  if (item.type === 'grpc-request') return { label: 'GRPC', cls: 'method-grpc' };
  if (item.type === 'ws-request') return { label: 'WS', cls: 'method-ws' };
  if (item.type === 'graphql-request') return { label: 'GQL', cls: 'method-graphql' };
  const m = item.request?.method || 'GET';
  return { label: m, cls: `method-${m.toLowerCase()}` };
};

const Documentation = ({ collection, folder }) => {
  const dispatch = useDispatch();
  const docs = folder.draft ? get(folder, 'draft.docs', '') : get(folder, 'root.docs', '');

  const onEdit = (value) => {
    dispatch(updateFolderDocs({ folderUid: folder.uid, collectionUid: collection.uid, docs: value }));
  };

  const onSave = () => dispatch(saveFolderRoot(collection.uid, folder.uid));

  if (!folder) return null;

  // Direct child requests only (not nested)
  const directRequests = (folder.items || []).filter(
    (i) => i.type === 'http-request' || i.type === 'graphql-request' || i.type === 'grpc-request' || i.type === 'ws-request'
  );
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
          allRequests.map((req) => {
            const { label, cls } = getMethodLabel(req);
            return (
              <div key={req.uid} className="folder-request-item">
                <span className={`folder-request-method ${cls}`}>{label}</span>
                <span className="folder-request-name">{req.name}</span>
                <span className="folder-request-url">{req.request?.url || ''}</span>
              </div>
            );
          })
        )}
      </div>
    </StyledWrapper>
  );
};

export default Documentation;
