import CodeEditor from 'components/CodeEditor/index';
import get from 'lodash/get';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'providers/Theme/index';
import StyledWrapper from './StyledWrapper';
import { useSelector, useDispatch } from 'react-redux';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import toast from 'react-hot-toast';
import { IconCopy, IconCheck } from '@tabler/icons';
import { findCollectionByItemUid, getGlobalEnvironmentVariables } from 'utils/collections/index';
import { cloneDeep } from 'lodash';
import { useMemo, useState, useEffect } from 'react';
import { getLanguages } from 'utils/codegenerator/targets';
import { updateGenerateCode } from 'providers/ReduxStore/slices/app';
import { generateSnippet } from '../utils/snippet-generator';

const CodeView = ({ language, item }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);
  const { globalEnvironments, activeGlobalEnvironmentUid } = useSelector((state) => state.globalEnvironments);
  const generateCodePrefs = useSelector((state) => state.app.generateCode);
  const [copied, setCopied] = useState(false);
  const [editedSnippet, setEditedSnippet] = useState('');

  const languages = useMemo(() => getLanguages(), []);

  let collectionOriginal = findCollectionByItemUid(
    useSelector((state) => state.collections.collections),
    item.uid
  );

  const collection = useMemo(() => {
    const c = cloneDeep(collectionOriginal);
    const globalEnvironmentVariables = getGlobalEnvironmentVariables({
      globalEnvironments,
      activeGlobalEnvironmentUid
    });
    c.globalEnvironmentVariables = globalEnvironmentVariables;
    return c;
  }, [collectionOriginal, globalEnvironments, activeGlobalEnvironmentUid]);

  const generatedSnippet = useMemo(() => {
    return generateSnippet({
      language,
      item,
      collection,
      shouldInterpolate: generateCodePrefs.shouldInterpolate
    });
  }, [language, item, collection, generateCodePrefs.shouldInterpolate]);

  // Reset edited content whenever generated snippet changes (language switch, interpolate toggle, etc.)
  useEffect(() => {
    setEditedSnippet(generatedSnippet);
  }, [generatedSnippet]);

  const selectedOptionValue = language.name;

  const handleSelectChange = (e) => {
    const selected = languages.find((l) => l.name === e.target.value);
    if (!selected) return;
    const sameTarget = languages.filter((l) => l.target === selected.target);
    dispatch(updateGenerateCode({
      mainLanguage: selected.displayName,
      library: sameTarget.length > 1 ? selected.client : 'default'
    }));
  };

  const handleInterpolateChange = (e) => {
    dispatch(updateGenerateCode({ shouldInterpolate: e.target.checked }));
  };

  const handleCopy = () => {
    setCopied(true);
    toast.success(t('GENERATE_CODE.CODE_VIEW.COPIED_TOAST'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StyledWrapper>
      <div className="code-toolbar">
        <div className="toolbar-left">
          <select
            className="toolbar-select"
            value={selectedOptionValue}
            onChange={handleSelectChange}
          >
            {languages.map((lang) => {
              const sameTarget = languages.filter((l) => l.target === lang.target);
              const label = sameTarget.length > 1
                ? `${lang.displayName} - ${lang.clientDisplayName}`
                : lang.displayName;
              return (
                <option key={lang.name} value={lang.name}>{label}</option>
              );
            })}
          </select>
        </div>

        <div className="toolbar-right">
          <label className="interpolate-label" title="Resolve {{variables}} using the active environment values">
            <input
              type="checkbox"
              checked={generateCodePrefs.shouldInterpolate}
              onChange={handleInterpolateChange}
            />
            <span>{t('GENERATE_CODE.CODE_VIEW.USE_ENV_VALUES')}</span>
          </label>

          <CopyToClipboard
            text={editedSnippet}
            options={{ format: 'text/plain' }}
            onCopy={handleCopy}
          >
            <button className={`copy-btn ${copied ? 'copied' : ''}`}>
              {copied ? <IconCheck size={14} strokeWidth={2} /> : <IconCopy size={14} strokeWidth={1.5} />}
              <span>{copied ? t('GENERATE_CODE.CODE_VIEW.COPIED_LABEL') : t('GENERATE_CODE.CODE_VIEW.COPY_CODE')}</span>
            </button>
          </CopyToClipboard>
        </div>
      </div>

      <div className="editor-content">
        <CodeEditor
          collection={collection}
          item={item}
          value={editedSnippet}
          onEdit={setEditedSnippet}
          font={get(preferences, 'font.codeFont', 'default')}
          fontSize={get(preferences, 'font.codeFontSize')}
          theme={displayedTheme}
          mode={language.codemirrorMode || 'text/plain'}
          enableVariableHighlighting={false}
        />
      </div>
    </StyledWrapper>
  );
};

export default CodeView;
