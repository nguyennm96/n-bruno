import Modal from 'components/Modal/index';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CodeView from './CodeView';
import StyledWrapper from './StyledWrapper';
import { isValidUrl } from 'utils/url';
import { get } from 'lodash';
import { interpolateUrl, interpolateUrlPathParams } from 'utils/url/index';
import { getLanguages } from 'utils/codegenerator/targets';
import { useSelector } from 'react-redux';
import { getAllVariables, getGlobalEnvironmentVariables } from 'utils/collections/index';
import { resolveInheritedAuth } from 'utils/auth';

const TEMPLATE_VAR_PATTERN = /\{\{([^}]+)\}\}/;

const validateURLWithVars = (url) => {
  const isValid = isValidUrl(url);
  const hasMissingInterpolations = TEMPLATE_VAR_PATTERN.test(url);
  return isValid && !hasMissingInterpolations;
};

const truncateUrl = (url, maxLen = 48) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname + (u.search || '');
    return path.length > maxLen ? path.slice(0, maxLen) + '…' : path;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
  }
};

const GenerateCodeItem = ({ collectionUid, item, onClose, isExample = false, exampleUid = null }) => {
  const { t } = useTranslation();
  const languages = getLanguages();
  const collection = useSelector((state) => state.collections.collections?.find((c) => c.uid === collectionUid));
  const { globalEnvironments, activeGlobalEnvironmentUid } = useSelector((state) => state.globalEnvironments);
  const generateCodePrefs = useSelector((state) => state.app.generateCode);
  const globalEnvironmentVariables = getGlobalEnvironmentVariables({
    globalEnvironments,
    activeGlobalEnvironmentUid
  });

  const getNormalRequestData = () => {
    const requestUrl = get(item, 'draft.request.url') !== undefined ? get(item, 'draft.request.url') : get(item, 'request.url');
    const requestParams = get(item, 'draft.request.params') !== undefined ? get(item, 'draft.request.params') : get(item, 'request.params');

    return {
      url: requestUrl,
      params: requestParams,
      request: get(item, 'draft.request') !== undefined ? get(item, 'draft.request') : get(item, 'request')
    };
  };

  const getExampleRequestData = () => {
    if (!isExample || !exampleUid) {
      return getNormalRequestData();
    }

    const examples = item.draft ? get(item, 'draft.examples', []) : get(item, 'examples', []);
    const example = examples.find((e) => e.uid === exampleUid);

    if (!example) {
      return getNormalRequestData();
    }

    return {
      url: get(example, 'request.url'),
      params: get(example, 'request.params'),
      request: get(example, 'request')
    };
  };

  const requestData = isExample ? getExampleRequestData() : getNormalRequestData();

  const variables = useMemo(() => {
    return getAllVariables({ ...collection, globalEnvironmentVariables }, item);
  }, [collection, globalEnvironmentVariables, item]);

  const interpolatedUrl = interpolateUrl({
    url: requestData.url,
    variables
  });

  const finalUrl = interpolateUrlPathParams(
    interpolatedUrl,
    requestData.params,
    variables
  );

  const rawUrl = interpolateUrlPathParams(interpolatedUrl, requestData.params, variables, { raw: true });

  const selectedLanguage = useMemo(() => {
    const fullName = generateCodePrefs.library === 'default'
      ? generateCodePrefs.mainLanguage
      : `${generateCodePrefs.mainLanguage}-${generateCodePrefs.library}`;

    return languages.find((lang) => lang.name === fullName) || languages[0];
  }, [generateCodePrefs.mainLanguage, generateCodePrefs.library, languages]);

  const resolvedRequest = resolveInheritedAuth(item, collection);

  const finalItem = {
    ...item,
    request: {
      ...requestData.request,
      auth: resolvedRequest.auth,
      url: finalUrl
    },
    rawUrl
  };

  // Build modal title with method + truncated URL
  const method = get(requestData, 'request.method', '');
  const urlDisplay = truncateUrl(finalUrl);
  const exampleName = isExample ? (get(item, 'draft.examples', []).find((e) => e.uid === exampleUid)?.name || t('GENERATE_CODE.DEFAULT_EXAMPLE')) : null;
  const titleBase = isExample
    ? t('GENERATE_CODE.EXAMPLE_TITLE', { name: exampleName })
    : t('GENERATE_CODE.TITLE');
  const modalTitle = (method && urlDisplay)
    ? `${titleBase} · ${method} ${urlDisplay}`
    : titleBase;

  return (
    <Modal size="lg" title={modalTitle} handleCancel={onClose} hideFooter={true}>
      <StyledWrapper>
        <div className="code-generator">
          {validateURLWithVars(finalUrl) ? (
            <CodeView
              language={selectedLanguage}
              item={finalItem}
            />
          ) : (
            <div className="error-message">
              <h1>{t('GENERATE_CODE.INVALID_URL_TITLE', { url: finalUrl })}</h1>
              <p>{t('GENERATE_CODE.CHECK_URL')}</p>
            </div>
          )}
        </div>
      </StyledWrapper>
    </Modal>
  );
};

export default GenerateCodeItem;
