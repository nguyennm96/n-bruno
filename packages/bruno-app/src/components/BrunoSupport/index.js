import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from 'components/Modal/index';
import { IconSpeakerphone, IconBrandTwitter, IconBrandGithub, IconBrandDiscord, IconBook } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const BrunoSupport = ({ onClose }) => {
  const { t } = useTranslation();
  return (
    <StyledWrapper>
      <Modal size="sm" title={t('SUPPORT.TITLE')} handleCancel={onClose} hideFooter={true}>
        <div className="collection-options">
          <div className="mt-2">
            <a href="https://docs.usebruno.com" target="_blank" className="flex items-end">
              <IconBook size={18} strokeWidth={2} />
              <span className="label ml-2">{t('SUPPORT.DOCUMENTATION')}</span>
            </a>
          </div>
          <div className="mt-2">
            <a href="https://github.com/usebruno/bruno/issues" target="_blank" className="flex items-end">
              <IconSpeakerphone size={18} strokeWidth={2} />
              <span className="label ml-2">{t('SUPPORT.REPORT_ISSUES')}</span>
            </a>
          </div>
          <div className="mt-2">
            <a href="https://discord.com/invite/KgcZUncpjq" target="_blank" className="flex items-end">
              <IconBrandDiscord size={18} strokeWidth={2} />
              <span className="label ml-2">{t('SUPPORT.DISCORD')}</span>
            </a>
          </div>
          <div className="mt-2">
            <a href="https://github.com/usebruno/bruno" target="_blank" className="flex items-end">
              <IconBrandGithub size={18} strokeWidth={2} />
              <span className="label ml-2">{t('SUPPORT.GITHUB')}</span>
            </a>
          </div>
          <div className="mt-2">
            <a href="https://twitter.com/use_bruno" target="_blank" className="flex items-end">
              <IconBrandTwitter size={18} strokeWidth={2} />
              <span className="label ml-2">{t('SUPPORT.TWITTER')}</span>
            </a>
          </div>
        </div>
      </Modal>
    </StyledWrapper>
  );
};

export default BrunoSupport;
