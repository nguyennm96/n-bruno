import React from 'react';
import { IconDownload, IconCopy, IconEye, IconAlertTriangle } from '@tabler/icons';
import toast from 'react-hot-toast';
import get from 'lodash/get';
import { useTranslation } from 'react-i18next';
import StyledWrapper from './StyledWrapper';
import { formatSize } from 'utils/common/index';
import Button from 'ui/Button/index';

const LargeResponseWarning = ({ item, responseSize, onRevealResponse }) => {
  const { t } = useTranslation();
  const { ipcRenderer } = window;
  const response = item.response || {};

  const downloadResponseToFile = () => {
    return new Promise((resolve, reject) => {
      ipcRenderer
        .invoke('renderer:save-response-to-file', response, item.requestSent.url, item.pathname)
        .then((result) => {
          if (result && result.success) {
            toast.success(t('RESPONSE_PANE.MESSAGES.DOWNLOAD_SUCCESS'));
          }
          resolve();
        })
        .catch((err) => {
          toast.error(get(err, 'error.message') || t('ERRORS.GENERIC'));
          reject(err);
        });
    });
  };

  const copyResponse = () => {
    try {
      const textToCopy = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2);

      navigator.clipboard.writeText(textToCopy).then(() => {
        toast.success(t('RESPONSE_PANE.MESSAGES.COPY_SUCCESS'));
      }).catch(() => {
        toast.error(t('RESPONSE_PANE.MESSAGES.COPY_FAILED'));
      });
    } catch (error) {
      toast.error(t('RESPONSE_PANE.MESSAGES.COPY_FAILED'));
    }
  };

  return (
    <StyledWrapper>
      <div className="warning-container">
        <div className="warning-icon">
          <IconAlertTriangle size={45} strokeWidth={2} />
        </div>
        <div className="warning-content">
          <div className="warning-title">
            {t('RESPONSE_PANE.LARGE_RESPONSE.TITLE')}
          </div>
          <div className="warning-description">
            {t('RESPONSE_PANE.LARGE_RESPONSE.DESCRIPTION_PREFIX')} <span className="size-highlight supported-size">{formatSize(10 * 1024 * 1024)}</span> {t('RESPONSE_PANE.LARGE_RESPONSE.DESCRIPTION_SUFFIX')}
            <br />
            {t('RESPONSE_PANE.LARGE_RESPONSE.CURRENT_SIZE_PREFIX')} <span className="size-highlight current-size">{formatSize(responseSize)}</span>
          </div>
        </div>
      </div>
      <div className="warning-actions">
        <Button
          icon={<IconEye size={18} strokeWidth={1.5} />}
          iconPosition="left"
          onClick={onRevealResponse}
          title={t('RESPONSE_PANE.ACTIONS.SHOW_RESPONSE_CONTENT')}
          color="secondary"
          size="sm"
        >
          {t('RESPONSE_PANE.ACTIONS.VIEW')}
        </Button>
        <Button
          icon={<IconDownload size={18} strokeWidth={1.5} />}
          iconPosition="left"
          onClick={downloadResponseToFile}
          disabled={!response.dataBuffer}
          title={t('RESPONSE_PANE.ACTIONS.DOWNLOAD_RESPONSE_TO_FILE')}
          color="secondary"
          size="sm"
        >
          {t('RESPONSE_PANE.ACTIONS.DOWNLOAD')}
        </Button>
        <Button
          icon={<IconCopy size={18} strokeWidth={1.5} />}
          iconPosition="left"
          onClick={copyResponse}
          disabled={!response.data}
          title={t('RESPONSE_PANE.ACTIONS.COPY_RESPONSE_TO_CLIPBOARD')}
          color="secondary"
          size="sm"
        >
          {t('RESPONSE_PANE.ACTIONS.COPY')}
        </Button>
      </div>
    </StyledWrapper>
  );
};

export default LargeResponseWarning;
