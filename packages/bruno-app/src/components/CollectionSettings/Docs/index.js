import get from 'lodash/get';
import { updateCollectionDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch } from 'react-redux';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import MarkdownEditor from 'components/MarkdownEditor';
import { IconFileText } from '@tabler/icons';
import Button from 'ui/Button/index';

const documentationPlaceholder = `Welcome to your collection documentation!

## Overview
Describe the purpose of these API endpoints...

## Authentication
Explain how to authenticate...

## Getting Started
Add usage instructions here...`;

const Docs = ({ collection }) => {
  const dispatch = useDispatch();
  const docs = collection.draft?.root ? get(collection, 'draft.root.docs', '') : get(collection, 'root.docs', '');

  const onEdit = (value) => {
    dispatch(
      updateCollectionDocs({
        collectionUid: collection.uid,
        docs: value
      })
    );
  };

  const onSave = () => {
    dispatch(saveCollectionSettings(collection.uid));
  };

  return (
    <div className="h-full w-full relative flex flex-col">
      <div className="flex flex-row w-full justify-between items-center mb-4">
        <div className="text-lg font-medium flex items-center gap-2">
          <IconFileText size={20} strokeWidth={1.5} />
          Documentation
        </div>
        <Button type="button" onClick={onSave}>
          Save
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={docs || ''}
          onEdit={onEdit}
          onSave={onSave}
          height={500}
          placeholder={documentationPlaceholder}
        />
      </div>
    </div>
  );
};

export default Docs;
