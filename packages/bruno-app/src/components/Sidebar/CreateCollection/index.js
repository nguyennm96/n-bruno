import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createCollection } from 'providers/ReduxStore/slices/collections/actions';
import toast from 'react-hot-toast';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { IconCaretDown } from '@tabler/icons';
import Help from 'components/Help';
import Dropdown from 'components/Dropdown';
import { multiLineMsg } from 'utils/common';
import { formatIpcError } from 'utils/common/error';
import { DEFAULT_COLLECTION_FORMAT } from 'utils/common/constants';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';
import Button from 'ui/Button';

const CreateCollection = ({ onClose }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [showFileFormat, setShowFileFormat] = useState(false);
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const dropdownTippyRef = useRef();
  const onDropdownCreate = (ref) => (dropdownTippyRef.current = ref);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      collectionName: '',
      format: DEFAULT_COLLECTION_FORMAT
    },
    validationSchema: Yup.object({
      collectionName: Yup.string()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less'),
      format: Yup.string().oneOf(['bru', 'yml'], 'invalid format').required('format is required')
    }),
    onSubmit: async (values) => {
      try {
        // Collection name is optional - auto-generated if not provided
        const collectionName = values.collectionName.trim() || null;

        await dispatch(createCollection(collectionName, { format: values.format }));

        toast.success(collectionName ? t('COLLECTION.CREATE_NAMED_SUCCESS', { defaultValue: `Collection "${collectionName}" created!`, name: collectionName }) : t('COLLECTION.CREATE_SUCCESS', 'Collection created!'));
        onClose();
      } catch (e) {
        toast.error(multiLineMsg(t('COLLECTION.CREATE_ERROR', 'An error occurred while creating the collection'), formatIpcError(e)));
      }
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  const AdvancedOptions = forwardRef((props, ref) => {
    return (
      <div ref={ref} className="flex mr-2 text-link cursor-pointer items-center">
        <button
          className="btn-advanced"
          type="button"
        >
          {t('COMMON.OPTIONS', 'Options')}
        </button>
        <IconCaretDown className="caret ml-1" size={14} strokeWidth={2} />
      </div>
    );
  });

  return (
    <Portal>
      <StyledWrapper>
        <Modal size="md" title="Create Collection" hideFooter={true} handleCancel={onClose}>
          <form className="bruno-form" onSubmit={formik.handleSubmit}>
            <div>
              <label htmlFor="collection-name" className="flex items-center font-medium">
                {t('COMMON.NAME', 'Name')}
                <Help width="350">
                  <p>
                    {t('COLLECTION.CREATE_NAME_HELP', 'Give your collection a name or leave it blank to auto-generate one.')}
                  </p>
                  <p className="mt-2">
                    {t('COLLECTION.CREATE_STORAGE_HELP', {
                      defaultValue: 'Collections are automatically stored in {{target}}.',
                      target: isAuthenticated ? t('COLLECTION.USER_DIRECTORY', 'your user directory') : t('COLLECTION.ANON_DIRECTORY', 'the anonymous directory')
                    })}
                  </p>
                </Help>
              </label>
              <input
                id="collection-name"
                type="text"
                name="collectionName"
                ref={inputRef}
                className="block textbox mt-2 w-full"
                onChange={formik.handleChange}
                placeholder={t('COLLECTION.CREATE_NAME_PLACEHOLDER', 'Leave blank to auto-generate')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={formik.values.collectionName || ''}
              />
              {formik.touched.collectionName && formik.errors.collectionName ? (
                <div className="text-red-500">{formik.errors.collectionName}</div>
              ) : null}

              {showFileFormat && (
                <div className="mt-4">
                  <label htmlFor="format" className="flex items-center font-medium">
                    {t('COLLECTION.FILE_FORMAT', 'File Format')}
                    <Help width="300">
                      <p>
                        {t('COLLECTION.FILE_FORMAT_HELP', 'Choose the file format for storing requests in this collection.')}
                      </p>
                      <p className="mt-2">
                        <strong>{t('COLLECTION.OPENCOLLECTION', 'OpenCollection (YAML)')}:</strong> {t('COLLECTION.OPENCOLLECTION_HELP', 'Industry-standard YAML format (.yml files)')}
                      </p>
                      <p className="mt-1">
                        <strong>BRU:</strong> {t('COLLECTION.BRU_FORMAT_HELP', 'AhaMan\'s native file format (.bru files)')}
                      </p>
                    </Help>
                  </label>
                  <select
                    id="format"
                    name="format"
                    className="block textbox mt-2 w-full"
                    value={formik.values.format}
                    onChange={formik.handleChange}
                  >
                    <option value="yml">{t('COLLECTION.OPENCOLLECTION', 'OpenCollection (YAML)')}</option>
                    <option value="bru">{t('COLLECTION.BRU_FORMAT', 'BRU Format (.bru)')}</option>
                  </select>
                  {formik.touched.format && formik.errors.format ? (
                    <div className="text-red-500">{formik.errors.format}</div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center mt-8 bruno-modal-footer">
              <div className="flex advanced-options">
                <Dropdown onCreate={onDropdownCreate} icon={<AdvancedOptions />} placement="bottom-start">
                  <div
                    className="dropdown-item"
                    key="show-file-format"
                    onClick={(e) => {
                      dropdownTippyRef.current.hide();
                      setShowFileFormat(!showFileFormat);
                    }}
                  >
                    {showFileFormat ? t('COLLECTION.HIDE_FILE_FORMAT', 'Hide File Format') : t('COLLECTION.SHOW_FILE_FORMAT', 'Show File Format')}
                  </div>
                </Dropdown>
              </div>
              <div className="flex justify-end">
                <Button type="button" color="secondary" variant="ghost" onClick={onClose} className="mr-2">
                  {t('COMMON.CANCEL', 'Cancel')}
                </Button>
                <Button type="submit">
                  {t('COMMON.CREATE', 'Create')}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default CreateCollection;
