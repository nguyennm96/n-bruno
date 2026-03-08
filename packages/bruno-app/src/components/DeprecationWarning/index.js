import React from 'react';
import { useTranslation } from 'react-i18next';
import IconAlertTriangleFilled from '../Icons/IconAlertTriangleFilled';
import StyledWrapper from './StyledWrapper';

const DeprecationWarning = ({ featureName, learnMoreUrl }) => {
  const { t } = useTranslation();
  return (
    <StyledWrapper>
      <div className="deprecation-warning">
        <IconAlertTriangleFilled className="warning-icon" size={16} />
        <span className="warning-text">
          {t('COMMON.DEPRECATION_WARNING', { featureName })}
          {' '}
          <a href={learnMoreUrl} target="_blank" rel="noreferrer">{t('COMMON.THIS_POST')}</a>
          {' '}{t('COMMON.OR_CONTACT_US')}{' '}
          <a href="mailto:support@usebruno.com">support@usebruno.com</a>
          {' '}{t('COMMON.WITH_QUESTIONS')}
        </span>
      </div>
    </StyledWrapper>
  );
};

export default DeprecationWarning;
