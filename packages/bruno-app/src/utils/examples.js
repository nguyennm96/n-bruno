import cloneDeep from 'lodash/cloneDeep';
import { uuid, formatResponse } from 'utils/common';
import { getBodyType } from 'utils/responseBodyProcessor';
import statusCodePhraseMap from 'components/ResponsePane/StatusCode/get-status-code-phrase';
import { getInitialExampleName } from 'utils/collections';

const getUniqueExampleName = (baseName, examples = []) => {
  const trimmedBaseName = String(baseName || '').trim();
  if (!trimmedBaseName) {
    return getInitialExampleName({ examples });
  }

  const existingNames = new Set(examples.map((example) => example?.name).filter(Boolean));
  if (!existingNames.has(trimmedBaseName)) {
    return trimmedBaseName;
  }

  let counter = 2;
  while (existingNames.has(`${trimmedBaseName} (${counter})`)) {
    counter += 1;
  }

  return `${trimmedBaseName} (${counter})`;
};

export const getExampleStatusText = (status, statusText = '') => {
  if (!status) return statusText || '';
  return statusText || statusCodePhraseMap[Number(status)] || '';
};

export const getSuggestedExampleName = (item, response = {}) => {
  const existingExamples = item?.draft?.examples || item?.examples || [];
  const status = Number(response?.status);
  const statusText = getExampleStatusText(status, response?.statusText);

  if (Number.isFinite(status) && status > 0) {
    const candidate = statusText ? `${status} ${statusText}` : String(status);
    return getUniqueExampleName(candidate, existingExamples);
  }

  return getInitialExampleName(item);
};

export const buildExampleRequestSnapshot = (request = {}) => {
  const source = cloneDeep(request || {});
  const snapshot = {
    url: source.url || '',
    method: source.method || 'GET',
    headers: Array.isArray(source.headers) ? source.headers : [],
    params: Array.isArray(source.params) ? source.params : [],
    body: source.body || { mode: 'none' }
  };

  if (!snapshot.body.mode) {
    snapshot.body.mode = 'none';
  }

  return snapshot;
};

export const buildExampleResponseFromRuntime = (response = {}) => {
  const headersArray = response.headers && typeof response.headers === 'object'
    ? Object.entries(response.headers).map(([name, value]) => ({
        uid: uuid(),
        name,
        value,
        description: '',
        enabled: true
      }))
    : [];

  const contentTypeHeader = headersArray.find((header) => header.name?.toLowerCase() === 'content-type');
  const contentType = contentTypeHeader?.value?.toLowerCase() || '';
  const bodyType = getBodyType(contentType);
  const content = formatResponse(response.data, response.dataBuffer, bodyType);

  return {
    status: response.status || 200,
    statusText: getExampleStatusText(response.status, response.statusText),
    headers: headersArray,
    body: {
      type: bodyType,
      content
    }
  };
};

export const buildResponseExampleFromRuntime = ({ item, response, name, description = '', exampleUid }) => ({
  uid: exampleUid || uuid(),
  itemUid: item.uid,
  name,
  description,
  type: item.type,
  request: buildExampleRequestSnapshot(item?.draft?.request || item?.request || {}),
  response: buildExampleResponseFromRuntime(response)
});

export const getExampleOptionLabel = (example = {}) => {
  const status = example?.response?.status;
  const statusText = getExampleStatusText(status, example?.response?.statusText);
  const prefix = status ? `${status}${statusText ? ` ${statusText}` : ''}` : 'Draft';
  return `${prefix} — ${example?.name || 'Untitled Example'}`;
};
