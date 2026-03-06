import get from 'lodash/get';
import { updateRequestDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch } from 'react-redux';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import MarkdownEditor from 'components/MarkdownEditor';
import StyledWrapper from './StyledWrapper';

const Documentation = ({ item, collection }) => {
  const dispatch = useDispatch();

  if (!item) return null;

  const docs = item.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');

  const onEdit = (value) => {
    dispatch(updateRequestDocs({ itemUid: item.uid, collectionUid: collection.uid, docs: value }));
  };

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));

  return (
    <StyledWrapper className="doc-root">
      <div className="doc-editor-section">
        <MarkdownEditor
          value={docs || ''}
          onEdit={onEdit}
          onSave={onSave}
          height={320}
          placeholder="Click to add request documentation..."
        />
      </div>
    </StyledWrapper>
  );
};

export default Documentation;
