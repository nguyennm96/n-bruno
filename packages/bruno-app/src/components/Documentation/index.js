import get from 'lodash/get';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { updateRequestDocs } from 'providers/ReduxStore/slices/collections';
import { useDispatch, useSelector } from 'react-redux';
import { saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { generateRequestDocs } from 'providers/ReduxStore/slices/collections/actions';
import { selectIsAuthenticated } from 'providers/ReduxStore/slices/auth';
import MarkdownEditor from 'components/MarkdownEditor';
import StyledWrapper from './StyledWrapper';

const Documentation = ({ item, collection }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!item) return null;

  const docs = item.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');

  const onEdit = (value) => {
    dispatch(updateRequestDocs({ itemUid: item.uid, collectionUid: collection.uid, docs: value }));
  };

  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));

  const handleGenerateDocs = async () => {
    setIsGenerating(true);
    try {
      await dispatch(generateRequestDocs(item.uid, collection.uid));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <StyledWrapper className="doc-root">
      {isAuthenticated && (
        <div className="doc-toolbar">
          <button
            type="button"
            className="btn-generate-ai"
            onClick={handleGenerateDocs}
            disabled={isGenerating}
            title={t('COLLECTION.GENERATE_DOCS_AI')}
          >
            ✦ {isGenerating ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>
      )}
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
