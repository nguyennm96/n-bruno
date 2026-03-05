import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { IconCaretDown } from '@tabler/icons';
import { postmanToBruno } from 'utils/importers/postman-collection';
import { convertInsomniaToBruno } from 'utils/importers/insomnia-collection';
import { convertOpenapiToBruno } from 'utils/importers/openapi-collection';
import { processBrunoCollection } from 'utils/importers/bruno-collection';
import { processOpenCollection } from 'utils/importers/opencollection';
import { wsdlToBruno } from '@usebruno/converters';
import { toastError } from 'utils/common/error';
import Modal from 'components/Modal';
import Dropdown from 'components/Dropdown';
import StyledWrapper from './StyledWrapper';
import { DEFAULT_COLLECTION_FORMAT } from 'utils/common/constants';

// Extract collection name from raw data
const getCollectionName = (format, rawData) => {
  if (!rawData) return 'Collection';

  switch (format) {
    case 'openapi':
      return rawData.info?.title || 'OpenAPI Collection';
    case 'postman':
      return rawData.info?.name || rawData.collection?.info?.name || 'Postman Collection';
    case 'insomnia':
      // For Insomnia v4 format, name is in the workspace resource
      if (rawData.resources && Array.isArray(rawData.resources)) {
        const workspace = rawData.resources.find((r) => r._type === 'workspace');
        if (workspace?.name) {
          return workspace.name;
        }
      }
      // Fallback to root name property
      return rawData.name || 'Insomnia Collection';
    case 'bruno':
      return rawData.name || 'Bruno Collection';
    case 'opencollection':
      return rawData.info?.name || 'OpenCollection';
    case 'wsdl':
      return 'WSDL Collection';
    case 'bruno-zip':
      return rawData.collectionName || 'Bruno Collection';
    default:
      return 'Collection';
  }
};

// Convert raw data to Bruno collection format
const convertCollection = async (format, rawData, groupingType, collectionFormat) => {
  try {
    let collection;

    switch (format) {
      case 'openapi':
        collection = convertOpenapiToBruno(rawData, { groupBy: groupingType, collectionFormat });
        break;
      case 'wsdl':
        collection = await wsdlToBruno(rawData);
        break;
      case 'postman':
        collection = await postmanToBruno(rawData);
        break;
      case 'insomnia':
        collection = convertInsomniaToBruno(rawData);
        break;
      case 'bruno':
        collection = await processBrunoCollection(rawData);
        break;
      case 'opencollection':
        collection = await processOpenCollection(rawData);
        break;
      case 'bruno-zip':
        // ZIP doesn't need conversion
        collection = rawData;
        break;
      default:
        throw new Error('Unknown collection format');
    }

    return collection;
  } catch (err) {
    console.error('Conversion error:', err);
    toastError(err, 'Failed to convert collection');
    throw err;
  }
};

const groupingOptions = [
  { value: 'tags', label: 'Tags', description: 'Group requests by OpenAPI tags', testId: 'grouping-option-tags' },
  { value: 'path', label: 'Paths', description: 'Group requests by URL path structure', testId: 'grouping-option-path' }
];

const ImportCollectionLocation = ({ onClose, handleSubmit, rawData, format }) => {
  const inputRef = useRef();
  const [groupingType, setGroupingType] = useState('tags');
  const [collectionFormat, setCollectionFormat] = useState(DEFAULT_COLLECTION_FORMAT);
  const dropdownTippyRef = useRef();
  const isOpenApi = format === 'openapi';
  const isZipImport = format === 'bruno-zip';

  const collectionName = getCollectionName(format, rawData);

  const onDropdownCreate = (ref) => {
    dropdownTippyRef.current = ref;
  };

  const GroupingDropdownIcon = forwardRef((props, ref) => {
    const selectedOption = groupingOptions.find((option) => option.value === groupingType);
    return (
      <div ref={ref} className="flex items-center justify-between w-full current-group" data-testid="grouping-dropdown">
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{selectedOption.label}</div>
        </div>
        <IconCaretDown size={16} className="text-gray-400 ml-[0.25rem]" fill="currentColor" />
      </div>
    );
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  const onSubmit = async () => {
    try {
      if (isZipImport) {
        handleSubmit(rawData, null, { format: collectionFormat, isZipImport: true });
      } else {
        const convertedCollection = await convertCollection(format, rawData, groupingType, collectionFormat);
        handleSubmit(convertedCollection, null, { format: collectionFormat });
      }
    } catch (err) {
      toastError(err, 'Import failed');
    }
  };

  return (
    <StyledWrapper>
      <Modal
        size="md"
        title="Import Collection"
        confirmText="Import"
        handleConfirm={onSubmit}
        handleCancel={onClose}
        dataTestId="import-collection-location-modal"
      >
        <form className="bruno-form" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="collectionName" className="block font-medium">
              Name
            </label>
            <div className="mt-2">{collectionName}</div>

            {!isZipImport && (
              <div className="mt-4">
                <label htmlFor="format" className="block font-medium">
                  File Format
                </label>
                <select
                  id="format"
                  name="format"
                  className="block textbox mt-2 w-full"
                  value={collectionFormat}
                  onChange={(e) => setCollectionFormat(e.target.value)}
                >
                  <option value="yml">OpenCollection (YAML)</option>
                  <option value="bru">BRU Format (.bru)</option>
                </select>
              </div>
            )}
          </div>

          {isOpenApi && (
            <div className="mt-4 flex gap-4 items-center">
              <div>
                <label htmlFor="groupingType" className="block font-medium mt-4">
                  Folder arrangement
                </label>
                <p className="text-gray-600 dark:text-gray-400 mt-1 mb-2">
                  Select whether to create folders according to the spec's paths or tags.
                </p>
              </div>
              <div className="relative">
                <Dropdown onCreate={onDropdownCreate} icon={<GroupingDropdownIcon />} placement="bottom-start">
                  {groupingOptions.map((option) => (
                    <div
                      key={option.value}
                      className="dropdown-item"
                      data-testid={option.testId}
                      onClick={() => {
                        dropdownTippyRef?.current?.hide();
                        setGroupingType(option.value);
                      }}
                    >
                      {option.label}
                    </div>
                  ))}
                </Dropdown>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </StyledWrapper>
  );
};

export default ImportCollectionLocation;
