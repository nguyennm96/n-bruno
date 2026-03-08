import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { cloneCollection } from 'providers/ReduxStore/slices/collections/actions';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import { findCollectionByUid } from 'utils/collections/index';
import { useTranslation } from 'react-i18next';

const CloneCollection = ({ onClose, collectionUid }) => {
  const inputRef = useRef();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const collection = useSelector((state) => findCollectionByUid(state.collections.collections, collectionUid));
  const { name } = collection;

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      collectionName: `${name} copy`
    },
    validationSchema: Yup.object({
      collectionName: Yup.string()
        .min(1, 'must be at least 1 character')
        .max(255, 'must be 255 characters or less')
        .required('collection name is required')
    }),
    onSubmit: (values) => {
      dispatch(cloneCollection(values.collectionName, null, null, collection?.uid))
        .then(() => {
          toast.success(t('COLLECTION.CLONE_SUCCESS', 'Collection cloned!'));
          onClose();
        })
        .catch((e) => toast.error(`${t('COLLECTION.CLONE_ERROR', 'An error occurred while cloning the collection')} - ${e}`));
    }
  });

  useEffect(() => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  const onSubmit = () => formik.handleSubmit();

  return (
    <Modal size="md" title="Clone Collection" confirmText={t('COMMON.CLONE', 'Clone')} handleConfirm={onSubmit} handleCancel={onClose}>
      <form className="bruno-form" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="collection-name" className="flex items-center font-medium">
            {t('COMMON.NAME', 'Name')}
          </label>
          <input
            id="collection-name"
            type="text"
            name="collectionName"
            ref={inputRef}
            className="block textbox mt-2 w-full"
            onChange={formik.handleChange}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={formik.values.collectionName || ''}
          />
          {formik.touched.collectionName && formik.errors.collectionName ? (
            <div className="text-red-500">{formik.errors.collectionName}</div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
};

export default CloneCollection;
