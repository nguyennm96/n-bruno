import 'github-markdown-css/github-markdown.css';
import get from 'lodash/get';
import { updateRequestDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch } from 'react-redux';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import MarkdownEditor from 'components/MarkdownEditor';
import StyledWrapper from './StyledWrapper';

// Method badge colors via inline class (matches sidebar RequestMethod)
const getMethodClass = (method = '') => {
  const m = method.toLowerCase();
  return `method-${m}`;
};

const ParamsTable = ({ title, rows }) => {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="doc-section">
      <h4 className="doc-section-title">{title}</h4>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            {rows.some((r) => r.description) && <th>Description</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.uid || i} className={row.enabled === false ? 'disabled-row' : ''}>
              <td><code>{row.name || '—'}</code></td>
              <td><span className="doc-value">{row.value || '—'}</span></td>
              {rows.some((r) => r.description) && <td className="doc-desc">{row.description || ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Documentation = ({ item, collection }) => {
  const dispatch = useDispatch();
  const request = item.draft ? get(item, 'draft.request') : get(item, 'request');
  const docs = item.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');

  const onEdit = (value) => {
    dispatch(updateRequestDocs({ itemUid: item.uid, collectionUid: collection.uid, docs: value }));
  };

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));

  if (!item) return null;

  const method = request?.method || 'GET';
  const url = request?.url || '';
  const queryParams = (request?.params || []).filter((p) => p.type === 'query' && p.name);
  const pathParams = (request?.params || []).filter((p) => p.type === 'path' && p.name);
  const headers = (request?.headers || []).filter((h) => h.name);
  const isGrpc = item.type === 'grpc-request';
  const isWS = item.type === 'ws-request';
  const isGraphQL = item.type === 'graphql-request';
  const methodLabel = isGrpc ? 'GRPC' : isWS ? 'WS' : isGraphQL ? 'GQL' : method;
  const methodClass = isGrpc ? 'method-grpc' : isWS ? 'method-ws' : isGraphQL ? 'method-graphql' : getMethodClass(method);

  return (
    <StyledWrapper className="doc-root">
      {/* Request header */}
      <div className="doc-request-header">
        <span className={`doc-method ${methodClass}`}>{methodLabel}</span>
        <span className="doc-url">{url || <em className="doc-url-empty">No URL set</em>}</span>
      </div>

      {/* Docs editor */}
      <div className="doc-editor-section">
        <MarkdownEditor
          value={docs || ''}
          onEdit={onEdit}
          onSave={onSave}
          height={320}
          placeholder="Click to add request documentation..."
        />
      </div>

      {/* Params & Headers summary */}
      <ParamsTable title="Query Parameters" rows={queryParams} />
      <ParamsTable title="Path Parameters" rows={pathParams} />
      <ParamsTable title="Headers" rows={headers} />
    </StyledWrapper>
  );
};

export default Documentation;
