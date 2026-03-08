import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useSelector, useDispatch } from 'react-redux';
import GraphQLRequestPane from 'components/RequestPane/GraphQLRequestPane';
import HttpRequestPane from 'components/RequestPane/HttpRequestPane';
import GrpcRequestPane from 'components/RequestPane/GrpcRequestPane/index';
import ResponsePane from 'components/ResponsePane';
import GrpcResponsePane from 'components/ResponsePane/GrpcResponsePane';
import { findItemInCollection } from 'utils/collections';
import { cancelRequest, sendRequest } from 'providers/ReduxStore/slices/collections/actions';
import RequestNotFound from './RequestNotFound';
import QueryUrl from 'components/RequestPane/QueryUrl/index';
import GrpcQueryUrl from 'components/RequestPane/GrpcQueryUrl/index';
import NetworkError from 'components/ResponsePane/NetworkError';
import RunnerResults from 'components/RunnerResults';
import VariablesEditor from 'components/VariablesEditor';
import CollectionSettings from 'components/CollectionSettings';
import { DocExplorer } from '@usebruno/graphql-docs';

import StyledWrapper from './StyledWrapper';
import FolderSettings from 'components/FolderSettings';
import { getGlobalEnvironmentVariables, getGlobalEnvironmentVariablesMasked } from 'utils/collections/index';
import CollectionOverview from 'components/CollectionSettings/Overview';
import RequestNotLoaded from './RequestNotLoaded';
import RequestIsLoading from './RequestIsLoading';
import FolderNotFound from './FolderNotFound';
import ExampleNotFound from './ExampleNotFound';
import WsQueryUrl from 'components/RequestPane/WsQueryUrl';
import WSRequestPane from 'components/RequestPane/WSRequestPane';
import WSResponsePane from 'components/ResponsePane/WsResponsePane';
import { useTabPaneBoundaries } from 'hooks/useTabPaneBoundaries/index';
import ResponseExample from 'components/ResponseExample';
import WorkspaceOverview from 'components/WorkspaceHome/WorkspaceOverview';
import Preferences from 'components/Preferences';
import EnvironmentSettings from 'components/Environments/EnvironmentSettings';
import GlobalEnvironmentSettings from 'components/Environments/GlobalEnvironmentSettings';
import NoTabsOpen from './NoTabsOpen';

const MIN_LEFT_PANE_WIDTH = 300;
const MIN_RIGHT_PANE_WIDTH = 490;
const MIN_TOP_PANE_HEIGHT = 150;
const MIN_BOTTOM_PANE_HEIGHT = 150;

const RequestTabPanel = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const focusedTab = useSelector((state) => {
    const { tabs, activeTabUid: uid } = state.tabs;
    return tabs.find((t) => t.uid === uid) ?? null;
  });
  const { globalEnvironments, activeGlobalEnvironmentUid } = useSelector((state) => state.globalEnvironments);
  const _collections = useSelector((state) => state.collections.collections);
  const isVerticalLayout = useSelector((state) => state.app.preferences?.layout?.responsePaneOrientation === 'vertical');
  const isConsoleOpen = useSelector((state) => state.logs.isConsoleOpen);
  const activeWorkspace = useSelector((state) => {
    const { workspaces, activeWorkspaceUid } = state.workspaces;
    return workspaces.find((w) => w.uid === activeWorkspaceUid) ?? null;
  });

  // Use ref to avoid stale closure in event handlers
  const isVerticalLayoutRef = useRef(isVerticalLayout);
  useEffect(() => {
    isVerticalLayoutRef.current = isVerticalLayout;
  }, [isVerticalLayout]);

  // Merge `globalEnvironmentVariables` into the active collection only (avoid Immer deep-copying all collections)
  const collectionUid = focusedTab?.collectionUid;
  const globalEnvironmentVariables = useMemo(
    () => getGlobalEnvironmentVariables({ globalEnvironments, activeGlobalEnvironmentUid }),
    [globalEnvironments, activeGlobalEnvironmentUid]
  );
  const globalEnvSecrets = useMemo(
    () => getGlobalEnvironmentVariablesMasked({ globalEnvironments, activeGlobalEnvironmentUid }),
    [globalEnvironments, activeGlobalEnvironmentUid]
  );

  const collections = useMemo(() => {
    if (!collectionUid) return _collections;
    return _collections.map((c) => {
      if (c.uid !== collectionUid) return c;
      return { ...c, globalEnvironmentVariables, globalEnvSecrets };
    });
  }, [_collections, collectionUid, globalEnvironmentVariables, globalEnvSecrets]);

  const collection = collections.find((c) => c.uid === focusedTab?.collectionUid);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);

  const { left: leftPaneWidth, top: topPaneHeight, reset: resetPaneBoundaries, setTop: setTopPaneHeight, setLeft: setLeftPaneWidth } = useTabPaneBoundaries(activeTabUid);
  const previousTopPaneHeight = useRef(null); // Store height before devtools opens

  // Not a recommended pattern here to have the child component
  // make a callback to set state, but treating this as an exception
  const docExplorerRef = useRef(null);
  const mainSectionRef = useRef(null);
  const tabContentRef = useRef(null);

  // Replay fade-in animation when active tab changes (without remounting heavy children)
  useEffect(() => {
    const el = tabContentRef.current;
    if (!el || !activeTabUid) return;
    el.classList.remove('tab-content-enter');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('tab-content-enter');
  }, [activeTabUid]);

  const [schema, setSchema] = useState(null);
  const [showGqlDocs, setShowGqlDocs] = useState(false);
  const onSchemaLoad = useCallback((schema) => setSchema(schema), []);
  const toggleDocs = useCallback(() => setShowGqlDocs((prev) => !prev), []);

  const handleGqlClickReference = useCallback((reference) => {
    if (docExplorerRef.current) {
      docExplorerRef.current.showDocForReference(reference);
    }
    if (!showGqlDocs) {
      setShowGqlDocs(true);
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!draggingRef.current || !mainSectionRef.current) return;

    e.preventDefault();
    const mainRect = mainSectionRef.current.getBoundingClientRect();

    if (isVerticalLayoutRef.current) {
      const newHeight = e.clientY - mainRect.top;
      const maxHeight = mainRect.height - MIN_BOTTOM_PANE_HEIGHT;
      // Clamp to bounds instead of returning early
      const clampedHeight = Math.max(MIN_TOP_PANE_HEIGHT, Math.min(newHeight, maxHeight));
      setTopPaneHeight(clampedHeight);
    } else {
      const newWidth = e.clientX - mainRect.left;
      const maxWidth = mainRect.width - MIN_RIGHT_PANE_WIDTH;
      // Clamp to bounds instead of returning early
      const clampedWidth = Math.max(MIN_LEFT_PANE_WIDTH, Math.min(newWidth, maxWidth));
      setLeftPaneWidth(clampedWidth);
    }
  }, [setTopPaneHeight, setLeftPaneWidth]);

  const handleMouseUp = useCallback((e) => {
    if (draggingRef.current) {
      e.preventDefault();
      draggingRef.current = false;
      setDragging(false);
    }
  }, []);

  const handleDragbarMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseUp, handleMouseMove]);

  useEffect(() => {
    if (!isVerticalLayout) return;

    if (isConsoleOpen) {
      // Store current height before reducing
      if (previousTopPaneHeight.current === null) {
        previousTopPaneHeight.current = topPaneHeight;
      }
      // Reduce request pane height to make room for response pane when devtools is open
      const maxHeight = 200;
      if (topPaneHeight > maxHeight) {
        setTopPaneHeight(maxHeight);
      }
    } else {
      // Restore previous height when devtools closes
      if (previousTopPaneHeight.current !== null) {
        setTopPaneHeight(previousTopPaneHeight.current);
        previousTopPaneHeight.current = null;
      }
    }
  }, [isConsoleOpen, isVerticalLayout]);

  if (typeof window == 'undefined') {
    return <div></div>;
  }

  if (!activeTabUid || !focusedTab) {
    return <NoTabsOpen />;
  }

  if (focusedTab.type === 'global-environment-settings') {
    return <GlobalEnvironmentSettings />;
  }

  if (focusedTab.type === 'preferences') {
    return <Preferences />;
  }

  if (focusedTab.type === 'workspaceOverview') {
    return activeWorkspace ? <WorkspaceOverview workspace={activeWorkspace} /> : null;
  }

  if (focusedTab.type === 'workspaceEnvironments') {
    return <GlobalEnvironmentSettings />;
  }

  if (!focusedTab.uid || !focusedTab.collectionUid) {
    return <NoTabsOpen />;
  }

  if (!collection || !collection.uid) {
    return <div className="pb-4 px-4">{t('REQUEST_TAB_PANEL.collectionNotFound')}</div>;
  }

  if (focusedTab.type === 'response-example') {
    const item = findItemInCollection(collection, focusedTab.itemUid);
    const example = item?.examples?.find((ex) => ex.uid === focusedTab.uid);

    if (!example) {
      return <ExampleNotFound itemUid={focusedTab.itemUid} exampleUid={focusedTab.uid} />;
    }
    return <ResponseExample item={item} collection={collection} example={example} />;
  }

  const item = findItemInCollection(collection, activeTabUid);
  const isGrpcRequest = item?.type === 'grpc-request';
  const isWsRequest = item?.type === 'ws-request';

  if (focusedTab.type === 'collection-runner') {
    return <RunnerResults collection={collection} />;
  }

  if (focusedTab.type === 'variables') {
    return <VariablesEditor collection={collection} />;
  }

  if (focusedTab.type === 'collection-settings') {
    return <CollectionSettings collection={collection} />;
  }

  if (focusedTab.type === 'collection-overview') {
    return <CollectionOverview collection={collection} />;
  }

  if (focusedTab.type === 'folder-settings') {
    const folder = findItemInCollection(collection, focusedTab.folderUid);
    if (!folder) {
      return <FolderNotFound folderUid={focusedTab.folderUid} />;
    }

    return <FolderSettings collection={collection} folder={folder} />;
  }

  if (focusedTab.type === 'environment-settings') {
    return <EnvironmentSettings collection={collection} />;
  }

  if (!item || !item.uid) {
    return <RequestNotFound itemUid={activeTabUid} />;
  }

  if (item?.partial) {
    return <RequestNotLoaded item={item} collection={collection} />;
  }

  if (item?.loading) {
    return <RequestIsLoading item={item} />;
  }

  const handleRun = async () => {
    const request = item.draft ? item.draft.request : item.request;

    if (isGrpcRequest && !request.url) {
      toast.error(t('REQUEST_TAB_PANEL.grpcServerUrlRequired'));
      return;
    }

    if (isGrpcRequest && !request.method) {
      toast.error(t('REQUEST_TAB_PANEL.grpcMethodRequired'));
      return;
    }

    if (isWsRequest && !request.url) {
      toast.error(t('REQUEST_TAB_PANEL.wsUrlRequired'));
      return;
    }

    if (item.response?.stream?.running) {
      dispatch(cancelRequest(item.cancelTokenUid, item, collection)).catch((err) =>
        toast.custom((t) => <NetworkError onClose={() => toast.dismiss(t.id)} />, {
          duration: 5000
        }));
    } else if (item.requestState !== 'sending' && item.requestState !== 'queued') {
      dispatch(sendRequest(item, collection.uid)).catch((err) =>
        toast.custom((t) => <NetworkError onClose={() => toast.dismiss(t.id)} />, {
          duration: 5000
        }));
    }
  };

  const renderQueryUrl = () => {
    if (isGrpcRequest) {
      return <GrpcQueryUrl item={item} collection={collection} handleRun={handleRun} />;
    }
    if (isWsRequest) {
      return <WsQueryUrl item={item} collection={collection} handleRun={handleRun} />;
    }
    return <QueryUrl item={item} collection={collection} handleRun={handleRun} />;
  };

  const renderRequestPane = () => {
    switch (item.type) {
      case 'graphql-request':
        return (
          <GraphQLRequestPane
            item={item}
            collection={collection}
            onSchemaLoad={onSchemaLoad}
            toggleDocs={toggleDocs}
            handleGqlClickReference={handleGqlClickReference}
          />
        );
      case 'http-request':
        return <HttpRequestPane item={item} collection={collection} />;
      case 'grpc-request':
        return <GrpcRequestPane item={item} collection={collection} handleRun={handleRun} />;
      case 'ws-request':
        return <WSRequestPane item={item} collection={collection} handleRun={handleRun} />;
      default:
        return null;
    }
  };

  const renderResponsePane = () => {
    switch (item.type) {
      case 'grpc-request':
        return <GrpcResponsePane item={item} collection={collection} response={item.response} />;
      case 'ws-request':
        return <WSResponsePane item={item} collection={collection} response={item.response} />;
      default:
        return <ResponsePane item={item} collection={collection} response={item.response} />;
    }
  };

  const requestPaneStyle = isVerticalLayout
    ? {
        height: `${Math.max(topPaneHeight, MIN_TOP_PANE_HEIGHT)}px`,
        minHeight: `${MIN_TOP_PANE_HEIGHT}px`,
        width: '100%'
      }
    : {
        width: `${Math.max(leftPaneWidth, MIN_LEFT_PANE_WIDTH)}px`
      };

  return (
    <StyledWrapper
      ref={tabContentRef}
      className={`flex flex-col flex-grow relative tab-content-enter ${dragging ? 'dragging' : ''} ${
        isVerticalLayout ? 'vertical-layout' : ''
      }`}
    >
      <div className="pt-3 pb-3 px-4">
        {renderQueryUrl()}
      </div>
      <section ref={mainSectionRef} className={`main flex ${isVerticalLayout ? 'flex-col' : ''} flex-grow pb-4 relative overflow-auto`}>
        <section className="request-pane">
          <div
            className="px-4 h-full"
            style={requestPaneStyle}
          >
            {renderRequestPane()}
          </div>
        </section>

        <div
          className="dragbar-wrapper"
          onDoubleClick={(e) => {
            e.preventDefault();
            resetPaneBoundaries();
          }}
          onMouseDown={handleDragbarMouseDown}
        >
          <div className="dragbar-handle" />
        </div>

        <section className="response-pane flex-grow overflow-x-auto">
          {renderResponsePane()}
        </section>
      </section>

      {item.type === 'graphql-request' ? (
        <div className={`graphql-docs-explorer-container ${showGqlDocs ? '' : 'hidden'}`}>
          <DocExplorer schema={schema} ref={(r) => (docExplorerRef.current = r)}>
            <button className="mr-2" onClick={toggleDocs} aria-label={t('REQUEST_TAB_PANEL.closeDocExplorer')}>
              {'\u2715'}
            </button>
          </DocExplorer>
        </div>
      ) : null}
    </StyledWrapper>
  );
};

export default RequestTabPanel;
