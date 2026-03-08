import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { closeTabs } from 'providers/ReduxStore/slices/collections/actions';
import { useDispatch } from 'react-redux';
import ErrorBanner from 'ui/ErrorBanner';
import Button from 'ui/Button';

const RequestNotFound = ({ itemUid }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const closeTab = () => {
    dispatch(
      closeTabs({
        tabUids: [itemUid]
      })
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowErrorMessage(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  if (!showErrorMessage) {
    return null;
  }

  const errors = [
    {
      title: 'Request no longer exists',
      message: 'This can happen when the .bru file associated with this request was deleted on your filesystem.'
    }
  ];

  return (
    <div className="mt-6 px-6">
      <ErrorBanner errors={errors} className="mb-4" />
      <Button size="md" color="secondary" variant="ghost" onClick={closeTab}>
        {t('COMMON.CLOSE_TAB')}
      </Button>
    </div>
  );
};

export default RequestNotFound;
