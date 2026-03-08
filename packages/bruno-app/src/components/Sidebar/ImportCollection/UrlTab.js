import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAndValidateApiSpecFromUrl } from 'utils/importers/common';
import { isValidUrl } from 'utils/url/index';
import Button from 'ui/Button';
const UrlTab = ({
  setIsLoading,
  handleSubmit,
  setErrorMessage
}) => {
  const { t } = useTranslation();
  const [urlInput, setUrlInput] = useState('');

  const handleUrlImport = async (event) => {
    event.preventDefault();
    if (!urlInput.trim() || !isValidUrl(urlInput.trim())) {
      setErrorMessage(t('IMPORT_COLLECTION.URL.INVALID_URL'));
      return;
    }
    setIsLoading(true);
    try {
      const { data, specType } = await fetchAndValidateApiSpecFromUrl({ url: urlInput.trim() });
      // Pass raw data for all types
      handleSubmit({ rawData: data, type: specType });
    } catch (err) {
      console.error(err);
      setErrorMessage(t('IMPORT_COLLECTION.URL.IMPORT_FAILED'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleUrlImport}>
      <div className="flex gap-2">
        <input
          id="urlInput"
          data-testid="url-input"
          type="text"
          value={urlInput}
          autoFocus
          onChange={(e) => {
            setUrlInput(e.target.value);
            setErrorMessage('');
          }}
          placeholder={t('IMPORT_COLLECTION.URL.PLACEHOLDER')}
          className="flex-1 px-3 py-1 textbox"
        />
        <Button
          type="submit"
          id="import-url-button"
          disabled={!urlInput.trim()}
          variant="filled"
          color="primary"
          style={{ height: '100%' }}
        >
          {t('IMPORT_COLLECTION.URL.IMPORT_BUTTON')}
        </Button>
      </div>
    </form>
  );
};

export default UrlTab;
