import React from 'react';
import { useTranslation } from 'react-i18next';
import ErrorBanner from 'ui/ErrorBanner';

const ScriptError = ({ item, onClose }) => {
  const { t } = useTranslation();
  const preRequestError = item?.preRequestScriptErrorMessage;
  const postResponseError = item?.postResponseScriptErrorMessage;
  const testScriptError = item?.testScriptErrorMessage;

  if (!preRequestError && !postResponseError && !testScriptError) return null;

  const errors = [];

  if (preRequestError) {
    errors.push({
      title: t('RESPONSE_PANE.PRE_REQUEST_SCRIPT_ERROR'),
      message: preRequestError
    });
  }

  if (postResponseError) {
    errors.push({
      title: t('RESPONSE_PANE.POST_RESPONSE_SCRIPT_ERROR'),
      message: postResponseError
    });
  }

  if (testScriptError) {
    errors.push({
      title: t('RESPONSE_PANE.TEST_SCRIPT_ERROR'),
      message: testScriptError
    });
  }

  return <ErrorBanner errors={errors} onClose={onClose} className="mt-4 mb-2" />;
};

export default ScriptError;
