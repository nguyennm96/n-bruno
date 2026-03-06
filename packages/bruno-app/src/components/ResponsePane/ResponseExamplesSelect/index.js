import React, { useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { IconBookmark, IconCopy, IconRefresh, IconPlus, IconExternalLink } from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { cloneResponseExample } from 'providers/ReduxStore/slices/collections';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { insertTaskIntoQueue } from 'providers/ReduxStore/slices/app';
import { uuid } from 'utils/common';
import { getExampleOptionLabel } from 'utils/examples';
import ResponseBookmark from '../ResponseBookmark';

const ResponseExamplesSelect = ({ item, collection, responseSize }) => {
  const dispatch = useDispatch();
  const bookmarkRef = useRef(null);
  const examples = item.draft?.examples || item.examples || [];

  const openExample = (exampleUid) => {
    dispatch(addTab({
      uid: exampleUid,
      exampleUid,
      collectionUid: collection.uid,
      type: 'response-example',
      itemUid: item.uid
    }));
  };

  const handleCloneExample = async (exampleUid) => {
    const existingExamples = item.draft?.examples || item.examples || [];
    const clonedExampleIndex = existingExamples.length;
    const clonedExampleUid = uuid();

    dispatch(cloneResponseExample({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid,
      clonedUid: clonedExampleUid
    }));

    await dispatch(saveRequest(item.uid, collection.uid, true));

    dispatch(insertTaskIntoQueue({
      uid: clonedExampleUid,
      type: 'OPEN_EXAMPLE',
      collectionUid: collection.uid,
      itemUid: item.uid,
      exampleIndex: clonedExampleIndex
    }));
  };

  const menuItems = useMemo(() => {
    const groupedItems = [
      {
        name: 'Quick actions',
        options: [
          {
            id: 'create-example',
            label: 'Save current response as new example',
            leftSection: IconPlus,
            disabled: bookmarkRef.current?.isDisabled ?? false,
            onClick: () => bookmarkRef.current?.openCreateModal?.()
          }
        ]
      }
    ];

    if (examples.length) {
      groupedItems.push({
        name: 'Open examples',
        options: examples.map((example) => ({
          id: `open-${example.uid}`,
          label: getExampleOptionLabel(example),
          leftSection: IconExternalLink,
          onClick: () => openExample(example.uid)
        }))
      });

      groupedItems.push({
        name: 'Refresh from latest response',
        options: examples.map((example) => ({
          id: `refresh-${example.uid}`,
          label: getExampleOptionLabel(example),
          leftSection: IconRefresh,
          disabled: bookmarkRef.current?.isDisabled ?? false,
          onClick: () => bookmarkRef.current?.updateExampleFromResponse?.(example.uid)
        }))
      });

      groupedItems.push({
        name: 'Sync request snapshot',
        options: examples.map((example) => ({
          id: `sync-${example.uid}`,
          label: example.name || 'Untitled Example',
          leftSection: IconBookmark,
          onClick: () => bookmarkRef.current?.syncRequestSnapshot?.(example.uid)
        }))
      });

      groupedItems.push({
        name: 'Duplicate',
        options: examples.map((example) => ({
          id: `clone-${example.uid}`,
          label: example.name || 'Untitled Example',
          leftSection: IconCopy,
          onClick: () => handleCloneExample(example.uid)
        }))
      });
    }

    return groupedItems;
  }, [collection.uid, dispatch, examples, item.draft?.examples, item.examples, item.uid]);

  if (item.type !== 'http-request') {
    return null;
  }

  return (
    <>
      <div style={{ display: 'none' }}>
        <ResponseBookmark
          ref={bookmarkRef}
          item={item}
          collection={collection}
          responseSize={responseSize}
        />
      </div>

      <MenuDropdown
        items={menuItems}
        placement="bottom-end"
        groupStyle="select"
        autoFocusFirstOption
        data-testid="response-examples-menu"
      >
        <button className="response-examples-trigger" type="button">
          <span>Examples</span>
          <span className="response-examples-count">{examples.length}</span>
        </button>
      </MenuDropdown>
    </>
  );
};

export default ResponseExamplesSelect;
