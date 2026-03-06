import StyledWrapper from './StyledWrapper';
import Docs from '../Docs';
import Info from './Info';
import { IconBox, IconFolder, IconChevronDown, IconChevronRight } from '@tabler/icons';
import RequestsNotLoaded from './RequestsNotLoaded';
import { useState, useMemo } from 'react';
import { flattenItems } from 'utils/collections';
import styled from 'styled-components';

const EndpointsWrapper = styled.div`
  margin-top: 28px;

  .endpoints-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.text};
    opacity: 0.5;
    margin-bottom: 12px;
  }

  .endpoint-group {
    margin-bottom: 8px;
    border: 1px solid ${({ theme }) => theme.border.border1};
    border-radius: 6px;
    overflow: hidden;
  }

  .endpoint-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: ${({ theme }) => theme.requestTabs.bg};
    cursor: pointer;
    user-select: none;
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.text};

    &:hover {
      background-color: ${({ theme }) => theme.requestTabs.icon.hoverBg};
    }

    .group-count {
      margin-left: auto;
      font-size: 11px;
      opacity: 0.4;
      font-weight: 400;
    }
  }

  .endpoint-list {
    border-top: 1px solid ${({ theme }) => theme.border.border1};
  }

  .endpoint-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px 7px 28px;
    border-bottom: 1px solid ${({ theme }) => theme.border.border0};
    font-size: 12px;

    &:last-child { border-bottom: none; }
  }

  .ep-method {
    font-size: 10px;
    font-weight: 700;
    min-width: 38px;
    text-align: center;
    padding: 2px 5px;
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

  .ep-name {
    flex: 1;
    color: ${({ theme }) => theme.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ep-url {
    font-size: 11px;
    color: ${({ theme }) => theme.text};
    opacity: 0.4;
    font-family: var(--font-code, monospace);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
  }

  /* Root-level requests (no folder) */
  .endpoint-root-item {
    padding-left: 12px;
  }
`;

const REQUEST_TYPES = new Set(['http-request', 'graphql-request', 'grpc-request', 'ws-request']);

const getMethodInfo = (item) => {
  if (item.type === 'grpc-request') return { label: 'GRPC', cls: 'method-grpc' };
  if (item.type === 'ws-request') return { label: 'WS', cls: 'method-ws' };
  if (item.type === 'graphql-request') return { label: 'GQL', cls: 'method-graphql' };
  const m = item.request?.method || 'GET';
  return { label: m, cls: `method-${m.toLowerCase()}` };
};

const EndpointItem = ({ item, className = '' }) => {
  const { label, cls } = getMethodInfo(item);
  return (
    <div className={`endpoint-item ${className}`}>
      <span className={`ep-method ${cls}`}>{label}</span>
      <span className="ep-name">{item.name}</span>
      <span className="ep-url">{item.request?.url || ''}</span>
    </div>
  );
};

const FolderGroup = ({ folder }) => {
  const [open, setOpen] = useState(true);
  const requests = flattenItems(folder.items || []).filter((i) => REQUEST_TYPES.has(i.type));
  if (requests.length === 0) return null;

  return (
    <div className="endpoint-group">
      <div className="endpoint-group-header" onClick={() => setOpen((v) => !v)}>
        {open ? <IconChevronDown size={14} stroke={2} /> : <IconChevronRight size={14} stroke={2} />}
        <IconFolder size={14} stroke={1.5} />
        {folder.name}
        <span className="group-count">{requests.length}</span>
      </div>
      {open && (
        <div className="endpoint-list">
          {requests.map((req) => <EndpointItem key={req.uid} item={req} />)}
        </div>
      )}
    </div>
  );
};

const AllEndpoints = ({ collection }) => {
  const rootRequests = (collection.items || []).filter((i) => REQUEST_TYPES.has(i.type));
  const folders = (collection.items || []).filter((i) => i.type === 'folder');
  const totalRequests = useMemo(
    () => flattenItems(collection.items || []).filter((i) => REQUEST_TYPES.has(i.type)).length,
    [collection.items]
  );

  if (totalRequests === 0) return null;

  return (
    <EndpointsWrapper>
      <div className="endpoints-title">All Endpoints ({totalRequests})</div>

      {/* Root-level requests */}
      {rootRequests.length > 0 && (
        <div className="endpoint-group">
          <div className="endpoint-list">
            {rootRequests.map((req) => (
              <EndpointItem key={req.uid} item={req} className="endpoint-root-item" />
            ))}
          </div>
        </div>
      )}

      {/* Folder groups */}
      {folders.map((folder) => (
        <FolderGroup key={folder.uid} folder={folder} />
      ))}
    </EndpointsWrapper>
  );
};

const Overview = ({ collection }) => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-2">
          <div className="text-lg font-medium flex items-center gap-2">
            <IconBox size={20} stroke={1.5} />
            {collection?.name}
          </div>
          <Info collection={collection} />
          <RequestsNotLoaded collection={collection} />
        </div>
        <div className="col-span-3">
          <Docs collection={collection} />
        </div>
      </div>
      <AllEndpoints collection={collection} />
    </div>
  );
};

export default Overview;
