import 'github-markdown-css/github-markdown.css';
import get from 'lodash/get';
import { useTheme } from 'providers/Theme';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveWorkspaceDocs } from 'providers/ReduxStore/slices/workspaces/actions';
import Markdown from 'components/MarkDown';
import CodeEditor from 'components/CodeEditor';
import StyledWrapper from './StyledWrapper';
import { IconFileText, IconEdit, IconX, IconPlus } from '@tabler/icons';
import Button from 'ui/Button';
import toast from 'react-hot-toast';
import ActionIcon from 'ui/ActionIcon/index';
import { useTranslation } from 'react-i18next';

const WorkspaceDocs = ({ workspace }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { displayedTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [localDocs, setLocalDocs] = useState(workspace?.docs || '');
  const preferences = useSelector((state) => state.app.preferences);

  useEffect(() => {
    setLocalDocs(workspace?.docs || '');
    setIsEditing(false);
  }, [workspace?.uid, workspace?.docs]);

  const toggleViewMode = () => {
    setIsEditing((prev) => !prev);
  };

  const onEdit = (value) => {
    setLocalDocs(value);
  };

  const handleDiscardChanges = () => {
    setLocalDocs(workspace?.docs || '');
    toggleViewMode();
  };

  const onSave = async () => {
    if (!workspace) {
      toast.error(t('SIDEBAR.WORKSPACE_NOT_FOUND'));
      return;
    }

    try {
      await dispatch(saveWorkspaceDocs(workspace.uid, localDocs));
      toast.success(t('WORKSPACE.DOCS_SAVE_SUCCESS'));
      toggleViewMode();
    } catch (error) {
      console.error('Error saving workspace docs:', error);
      toast.error(t('WORKSPACE.DOCS_SAVE_ERROR'));
    }
  };

  const handleAddDocumentation = () => {
    setIsEditing(true);
  };

  const hasDocs = localDocs && localDocs.trim().length > 0;

  return (
    <StyledWrapper className="h-full w-full flex flex-col">
      <div className="docs-header">
        <div className="docs-title">
          <IconFileText size={16} strokeWidth={1.5} />
          <span>{t('WORKSPACE.DOCS_TITLE')}</span>
        </div>
        {hasDocs && !isEditing && (
          <ActionIcon className="edit-btn" onClick={toggleViewMode} label={t('WORKSPACE.DOCS_EDIT_LABEL')}>
          </ActionIcon>
        )}
        {isEditing && (
          <ActionIcon className="edit-btn" onClick={handleDiscardChanges} label={t('WORKSPACE.DOCS_DISCARD_LABEL')}>
            <IconX size={16} strokeWidth={1.5} />
          </ActionIcon>
        )}
      </div>

      <div className="docs-content">
        {isEditing ? (
          <div className="editor-container">
            <CodeEditor
              theme={displayedTheme}
              value={localDocs}
              onEdit={onEdit}
              onSave={onSave}
              mode="markdown"
              font={get(preferences, 'font.codeFont', 'default')}
              fontSize={get(preferences, 'font.codeFontSize')}
            />
            <div className="editor-actions">
              <Button onClick={onSave}>
                {t('COMMON.SAVE')}
              </Button>
            </div>
          </div>
        ) : hasDocs ? (
          <div className="docs-markdown">
            <Markdown collectionPath={workspace?.pathname || ''} onDoubleClick={toggleViewMode} content={localDocs} />
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <IconFileText size={52} strokeWidth={1} />
            </div>
            <p className="empty-text">
              {t('WORKSPACE.DOCS_EMPTY_TEXT')}
            </p>
            <p className="empty-subtext">{t('WORKSPACE.DOCS_YOU_CAN_INCLUDE')}</p>
            <ul className="suggestions-list">
              <li>{t('WORKSPACE.DOCS_ITEM_OVERVIEW')}</li>
              <li>{t('WORKSPACE.DOCS_ITEM_SETUP')}</li>
              <li>{t('WORKSPACE.DOCS_ITEM_WORKFLOWS')}</li>
              <li>{t('WORKSPACE.DOCS_ITEM_RESOURCES')}</li>
            </ul>
            <Button color="light" size="sm" icon={<IconPlus size={14} strokeWidth={1.5} />} onClick={handleAddDocumentation}>
              {t('WORKSPACE.DOCS_ADD_BUTTON')}
            </Button>
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default WorkspaceDocs;
