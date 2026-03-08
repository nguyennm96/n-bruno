import React, { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';
import {
  IconTrash,
  IconFile,
  IconFileImport,
  IconAlertCircle,
  IconFolder
} from '@tabler/icons';
import { getBasename } from 'utils/common/path';
import { Tooltip } from 'react-tooltip';
import useProtoFileManagement from '../../../hooks/useProtoFileManagement';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import Button from 'ui/Button';

const ProtobufSettings = ({ collection }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const {
    protoFiles,
    importPaths,
    addProtoFileToCollection,
    addImportPathToCollection,
    toggleImportPath,
    browseForProtoFile,
    browseForImportDirectory,
    removeProtoFileFromCollection,
    removeImportPathFromCollection,
    replaceImportPathInCollection,
    replaceProtoFileInCollection
  } = useProtoFileManagement(collection);
  const fileInputRef = useRef(null);

  const handleSave = () => dispatch(saveCollectionSettings(collection.uid));

  // Get file path using the ipcRenderer
  const getProtoFile = async (event) => {
    const files = event?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const filePath = window?.ipcRenderer?.getFilePath(files[i]);
        if (filePath) {
          await addProtoFileToCollection(filePath);
        }
      }
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveProtoFile = async (index) => {
    await removeProtoFileFromCollection(index);
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReplaceProtoFile = async (index) => {
    const result = await browseForProtoFile();
    if (result.success) {
      await replaceProtoFileInCollection(index, result.filePath);
    }
  };

  const handleReplaceImportPath = async (index) => {
    const result = await browseForImportDirectory();
    if (result.success) {
      await replaceImportPathInCollection(index, result.directoryPath);
    }
  };

  const handleFileInputChange = (e) => {
    getProtoFile(e.target);
  };

  const getImportPath = async () => {
    const result = await browseForImportDirectory();
    if (result.success) {
      await addImportPathToCollection(result.directoryPath);
    }
  };

  const handleRemoveImportPath = async (index) => {
    await removeImportPathFromCollection(index);
  };

  const handleToggleImportPath = async (index) => {
    await toggleImportPath(index);
  };

  const handleBrowseImportPathClick = () => {
    getImportPath();
  };

  return (
    <StyledWrapper className="h-full w-full">
      {/* Hidden file input for file selection */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".proto"
        multiple
        onChange={handleFileInputChange}
      />

      {/* Proto Files Section */}
      <div className="mb-6" data-testid="protobuf-proto-files-section">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <label className="flex items-center" htmlFor="protoFiles">
              Proto Files (
              {protoFiles.length}
              )
              <span id="proto-files-tooltip" className="ml-2">
                <IconAlertCircle size={16} className="tooltip-icon" />
              </span>
              <Tooltip
                anchorId="proto-files-tooltip"
                className="tooltip-mod font-normal"
                html={t('COLLECTION.PROTOBUF_SETTINGS.PROTO_FILES_TOOLTIP')}
              />
            </label>
          </div>
        </div>

        <div>
          {protoFiles.some((file) => !file.exists) && (
            <div className="error-message text-xs mb-2 flex items-center p-2" data-testid="protobuf-invalid-files-message">
              <IconAlertCircle size={14} className="mr-1" />
              {t('COLLECTION.PROTOBUF_SETTINGS.INVALID_FILES')}
            </div>
          )}

          <table className="w-full border-collapse" data-testid="protobuf-proto-files-table">
            <thead>
              <tr>
                <th>
                  {t('COLLECTION.PROTOBUF_SETTINGS.FILE_COL')}
                </th>
                <th>
                  {t('COLLECTION.PROTOBUF_SETTINGS.PATH_COL')}
                </th>
                <th className="text-right">
                  {t('COLLECTION.PROTOBUF_SETTINGS.ACTIONS_COL')}
                </th>
              </tr>
            </thead>
            <tbody>
              {protoFiles.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center">
                    <div className="empty-state flex flex-col items-center">
                      <IconFile size={24} className="empty-icon mb-2" />
                      <span className="empty-text">{t('COLLECTION.PROTOBUF_SETTINGS.NO_PROTO_FILES')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                protoFiles.map((file, index) => {
                  const isValid = file.exists;

                  return (
                    <tr key={index}>
                      <td>
                        <div className="flex items-center">
                          <IconFile size={16} className="file-icon mr-2" />
                          <span className="file-name" data-testid="protobuf-proto-file-name">
                            {getBasename(collection.pathname, file.path)}
                          </span>
                          {!isValid && <IconAlertCircle size={12} className="invalid-indicator ml-2" />}
                        </div>
                      </td>
                      <td>
                        <div className="path-text">
                          {file.path}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {!isValid && (
                            <button
                              type="button"
                              onClick={() => handleReplaceProtoFile(index)}
                              className="action-button replace-button"
                              title={t('COMMON.REPLACE_FILE')}
                            >
                              <IconFileImport size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveProtoFile(index)}
                            className="action-button remove-button"
                            title={t('COMMON.REMOVE_FILE')}
                            data-testid="protobuf-remove-file-button"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <button type="button" className="btn-add-param text-link pr-2 py-3 mt-2 select-none" onClick={handleBrowseClick} data-testid="protobuf-add-file-button">
            {t('COLLECTION.PROTOBUF_SETTINGS.ADD_PROTO_FILE')}
          </button>
        </div>
      </div>

      {/* Import Paths Section */}
      <div className="mb-6" data-testid="protobuf-import-paths-section">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <label className="flex items-center" htmlFor="importPaths">
              Import Paths (
              {importPaths.length}
              )
              <span id="import-paths-tooltip" className="ml-2">
                <IconAlertCircle size={16} className="tooltip-icon" />
              </span>
              <Tooltip
                anchorId="import-paths-tooltip"
                className="tooltip-mod font-normal"
                html={t('COLLECTION.PROTOBUF_SETTINGS.IMPORT_PATHS_TOOLTIP')}
              />
            </label>
          </div>
        </div>

        <div>
          {importPaths.some((path) => !path.exists) && (
            <div className="error-message text-xs mb-2 flex items-center p-2" data-testid="protobuf-invalid-import-paths-message">
              <IconAlertCircle size={14} className="mr-1" />
              {t('COLLECTION.PROTOBUF_SETTINGS.INVALID_IMPORT_PATHS')}
            </div>
          )}

          <table className="w-full border-collapse" data-testid="protobuf-import-paths-table">
            <thead>
              <tr>
                <th>
                </th>
                <th>
                  {t('COLLECTION.PROTOBUF_SETTINGS.DIRECTORY_COL')}
                </th>
                <th>
                  {t('COLLECTION.PROTOBUF_SETTINGS.PATH_COL')}
                </th>
                <th className="text-right">
                  {t('COLLECTION.PROTOBUF_SETTINGS.ACTIONS_COL')}
                </th>
              </tr>
            </thead>
            <tbody>
              {importPaths.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center">
                    <div className="empty-state flex flex-col items-center">
                      <IconFolder size={24} className="empty-icon mb-2" />
                      <span className="empty-text">{t('COLLECTION.PROTOBUF_SETTINGS.NO_IMPORT_PATHS')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                importPaths.map((importPath, index) => {
                  const isValid = importPath.exists;

                  return (
                    <tr key={index}>
                      <td>
                        <input
                          type="checkbox"
                          checked={importPath.enabled}
                          onChange={() => handleToggleImportPath(index)}
                          className="h-4 w-4"
                          title={importPath.enabled ? 'Disable this import path' : 'Enable this import path'}
                          data-testid="protobuf-import-path-checkbox"
                        />
                      </td>
                      <td>
                        <div className="flex items-center">
                          <IconFolder size={16} className="folder-icon mr-2" />
                          <span className="directory-name">
                            {getBasename(collection.pathname, importPath.path)}
                          </span>
                          {!isValid && <IconAlertCircle size={12} className="invalid-indicator ml-2" />}
                        </div>
                      </td>
                      <td>
                        <div className="path-text">
                          {importPath.path}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {!isValid && (
                            <button
                              type="button"
                              onClick={() => handleReplaceImportPath(index)}
                              className="action-button replace-button"
                              title={t('COMMON.REPLACE_DIRECTORY')}
                            >
                              <IconFileImport size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImportPath(index)}
                            className="action-button remove-button"
                            title={t('REQUEST.GRPC.REMOVE_IMPORT_PATH')}
                            data-testid="protobuf-remove-import-path-button"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <button type="button" className="btn-add-param text-link pr-2 py-3 mt-2 select-none" onClick={handleBrowseImportPathClick} data-testid="protobuf-add-import-path-button">
            {t('COLLECTION.PROTOBUF_SETTINGS.ADD_IMPORT_PATH')}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Button type="button" size="sm" onClick={handleSave}>
          {t('COMMON.SAVE')}
        </Button>
      </div>

    </StyledWrapper>
  );
};

export default ProtobufSettings;
