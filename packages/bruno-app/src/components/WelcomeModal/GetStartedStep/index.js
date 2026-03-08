import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconDownload } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const GetStartedStep = ({ onCreateCollection, onImportCollection }) => {
  const { t } = useTranslation();
  return (
    <StyledWrapper className="step-body">
      <div className="step-label">{t('GET_STARTED.firstCollection')}</div>
      <div className="step-title">{t('GET_STARTED.allSet')}</div>
      <div className="step-description">
        {t('GET_STARTED.description')}
      </div>

      <div className="primary-actions">
        <button className="primary-action-card" onClick={onCreateCollection}>
          <div className="card-icon">
            <IconPlus size={20} stroke={1.5} />
          </div>
          <div className="card-title">{t('GET_STARTED.createCollection')}</div>
          <div className="card-desc">{t('GET_STARTED.createCollectionDesc')}</div>
        </button>

        <button className="primary-action-card" onClick={onImportCollection}>
          <div className="card-icon">
            <IconDownload size={20} stroke={1.5} />
          </div>
          <div className="card-title">{t('GET_STARTED.importCollection')}</div>
          <div className="card-desc">{t('GET_STARTED.importCollectionDesc')}</div>
        </button>
      </div>
    </StyledWrapper>
  );
};

export default GetStartedStep;
