import React, { useMemo, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTheme } from 'providers/Theme';
import { useSelector } from 'react-redux';
import get from 'lodash/get';
import { updateResponseExampleResponse } from 'providers/ReduxStore/slices/collections';
import { loadExampleBody } from 'providers/ReduxStore/slices/collections/actions';
import CodeEditor from 'components/CodeEditor';
import { getCodeMirrorModeBasedOnContentType } from 'utils/common/codemirror';
import StyledWrapper from './StyledWrapper';

const ResponseExampleResponseContent = ({ editMode, item, collection, exampleUid, onSave }) => {
  const dispatch = useDispatch();
  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);
  const bodyFetchedRef = useRef(false);

  const response = useMemo(() => {
    return item.draft ? get(item, 'draft.examples', []).find((e) => e.uid === exampleUid)?.response || {} : get(item, 'examples', []).find((e) => e.uid === exampleUid)?.response || {};
  }, [item, exampleUid]);

  // Lazily fetch body from cloud when it hasn't been loaded yet
  useEffect(() => {
    if (bodyFetchedRef.current) return;
    const bodyNotLoaded = response?.body?.content === undefined || response?.body?.content === null;
    if (bodyNotLoaded) {
      bodyFetchedRef.current = true;
      dispatch(loadExampleBody(exampleUid, item.uid, collection.uid));
    }
  }, [exampleUid, item.uid, collection.uid, response?.body?.content, dispatch]);

  const getResponseContent = () => {
    if (!response?.body) {
      return '';
    }

    const content = response.body.content;
    if (content === null || content === undefined) {
      return '';
    }
    // Guard: CodeMirror requires a string value; if content is still an object
    // (e.g. from an older Redux snapshot), stringify it rather than crashing.
    if (typeof content !== 'string') {
      return JSON.stringify(content, null, 2);
    }
    return content;
  };

  const getCodeMirrorMode = () => {
    if (!response) {
      return null;
    }

    if (response.body && response.body.type) {
      const bodyType = response.body.type;
      if (bodyType === 'json') {
        return 'application/ld+json';
      } else if (bodyType === 'xml') {
        return 'application/xml';
      } else if (bodyType === 'html') {
        return 'application/html';
      } else if (bodyType === 'text') {
        return 'application/text';
      }
    }

    const contentType = response.headers?.find((h) => h.name?.toLowerCase() === 'content-type')?.value?.toLowerCase() || '';

    return getCodeMirrorModeBasedOnContentType(contentType);
  };

  const onResponseEdit = (value) => {
    if (editMode && item && collection && exampleUid) {
      const currentBody = response.body || {};
      dispatch(updateResponseExampleResponse({
        itemUid: item.uid,
        collectionUid: collection.uid,
        exampleUid: exampleUid,
        response: {
          body: {
            type: currentBody.type || 'text',
            content: value
          }
        }
      }));
    }
  };

  return (
    <StyledWrapper className="w-full px-4">
      <div className="code-editor-container">
        <CodeEditor
          collection={collection}
          item={item}
          theme={displayedTheme}
          font={get(preferences, 'font.codeFont', 'default')}
          fontSize={get(preferences, 'font.codeFontSize')}
          value={getResponseContent()}
          onEdit={onResponseEdit}
          onRun={() => {}}
          onSave={onSave}
          mode={getCodeMirrorMode()}
          enableVariableHighlighting={false}
          readOnly={!editMode}
        />
      </div>
    </StyledWrapper>
  );
};

export default ResponseExampleResponseContent;
