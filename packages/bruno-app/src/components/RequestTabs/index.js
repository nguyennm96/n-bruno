import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import find from 'lodash/find';
import classnames from 'classnames';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons';
import { useSelector, useDispatch } from 'react-redux';
import { focusTab, reorderTabs } from 'providers/ReduxStore/slices/tabs';
import NewRequest from 'components/Sidebar/NewRequest';
import CollectionHeader from './CollectionHeader';
import RequestTab from './RequestTab';
import StyledWrapper from './StyledWrapper';
import DraggableTab from './DraggableTab';
import CreateTransientRequest from 'components/CreateTransientRequest';
import ActionIcon from 'ui/ActionIcon/index';

const RequestTabs = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const tabsRef = useRef();
  const scrollContainerRef = useRef();
  const collectionTabsRef = useRef();
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [tabOverflowStates, setTabOverflowStates] = useState({});
  const [showChevrons, setShowChevrons] = useState(false);
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const collections = useSelector((state) => state.collections.collections);
  const leftSidebarWidth = useSelector((state) => state.app.leftSidebarWidth);
  const sidebarCollapsed = useSelector((state) => state.app.sidebarCollapsed);
  const screenWidth = useSelector((state) => state.app.screenWidth);
  const workspaces = useSelector((state) => state.workspaces.workspaces);

  const createSetHasOverflow = useCallback((tabUid) => {
    return (hasOverflow) => {
      setTabOverflowStates((prev) => {
        if (prev[tabUid] === hasOverflow) {
          return prev;
        }
        return {
          ...prev,
          [tabUid]: hasOverflow
        };
      });
    };
  }, []);

  const activeTab = find(tabs, (t) => t.uid === activeTabUid);
  const activeCollection = find(collections, (c) => c?.uid === activeTab?.collectionUid);
  // Show tabs from all collections — switching collections no longer hides open tabs
  const collectionRequestTabs = tabs;

  const isScratchCollection = useMemo(() => {
    return activeCollection ? workspaces.some((w) => w.scratchCollectionUid === activeCollection.uid) : false;
  }, [workspaces, activeCollection]);

  useEffect(() => {
    if (!activeTabUid || !activeTab) return;

    const checkOverflow = () => {
      if (tabsRef.current && scrollContainerRef.current) {
        const hasOverflow = tabsRef.current.scrollWidth > scrollContainerRef.current.clientWidth + 1;
        setShowChevrons(hasOverflow);
      }
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [activeTabUid, activeTab, collectionRequestTabs.length, screenWidth, leftSidebarWidth, sidebarCollapsed]);

  const getTabClassname = (tab, index) => {
    return classnames('request-tab select-none', {
      'active': tab.uid === activeTabUid,
      'last-tab': tabs && tabs.length && index === tabs.length - 1,
      'has-overflow': tabOverflowStates[tab.uid]
    });
  };

  const handleClick = (tab) => {
    dispatch(
      focusTab({
        uid: tab.uid
      })
    );
  };

  if (!activeTabUid) {
    return null;
  }

  const effectiveSidebarWidth = sidebarCollapsed ? 0 : leftSidebarWidth;
  // tabs area gets remaining width minus action icons (~220px) and chevrons/padding
  const maxTablistWidth = screenWidth - effectiveSidebarWidth - 240;

  const leftSlide = () => {
    scrollContainerRef.current?.scrollBy({
      left: -120,
      behavior: 'smooth'
    });
  };

  const rightSlide = () => {
    scrollContainerRef.current?.scrollBy({
      left: 120,
      behavior: 'smooth'
    });
  };

  // Todo: Must support ephemeral requests
  return (
    <StyledWrapper>
      {newRequestModalOpen && (
        <NewRequest collectionUid={activeCollection?.uid} onClose={() => setNewRequestModalOpen(false)} />
      )}
      {collectionRequestTabs && collectionRequestTabs.length ? (
        <div className="flex items-end pl-2" ref={collectionTabsRef}>
          {/* Tabs area — scrollable, takes remaining space */}
          <div className="flex items-end gap-2 min-w-0 flex-1">
            <div className={classnames('scroll-chevrons', { hidden: !showChevrons })}>
              <ActionIcon size="lg" onClick={leftSlide} label={t('REQUEST_TAB.SCROLL_LEFT')} style={{ marginBottom: '3px' }}>
                <IconChevronLeft size={18} strokeWidth={1.5} />
              </ActionIcon>
            </div>
            <div className="tabs-scroll-container" style={{ maxWidth: maxTablistWidth }} ref={scrollContainerRef}>
              <ul role="tablist" ref={tabsRef}>
                {collectionRequestTabs && collectionRequestTabs.length
                  ? collectionRequestTabs.map((tab, index) => {
                      const tabCollection = find(collections, (c) => c?.uid === tab.collectionUid);
                      return (
                        <DraggableTab
                          key={tab.uid}
                          id={tab.uid}
                          index={index}
                          onMoveTab={(source, target) => {
                            dispatch(reorderTabs({
                              sourceUid: source,
                              targetUid: target
                            }));
                          }}
                          className={getTabClassname(tab, index)}
                          onClick={() => handleClick(tab)}
                        >
                          <RequestTab
                            collectionRequestTabs={collectionRequestTabs}
                            tabIndex={index}
                            key={tab.uid}
                            tab={tab}
                            collection={tabCollection}
                            folderUid={tab.folderUid}
                            hasOverflow={tabOverflowStates[tab.uid]}
                            setHasOverflow={createSetHasOverflow(tab.uid)}
                            dropdownContainerRef={collectionTabsRef}
                          />
                        </DraggableTab>
                      );
                    })
                  : null}
              </ul>
            </div>

            {activeCollection && (
              <CreateTransientRequest collectionUid={activeCollection.uid} />
            )}

            <div className={classnames('scroll-chevrons', { hidden: !showChevrons })}>
              <ActionIcon size="lg" onClick={rightSlide} label={t('REQUEST_TAB.SCROLL_RIGHT')} style={{ marginBottom: '3px' }}>
                <IconChevronRight size={18} strokeWidth={1.5} />
              </ActionIcon>
            </div>
          </div>

          {/* Action icons — always pinned to the right */}
          {activeCollection && (
            <CollectionHeader
              collection={activeCollection}
              isScratchCollection={isScratchCollection}
            />
          )}
        </div>
      ) : null}
    </StyledWrapper>
  );
};

export default RequestTabs;
