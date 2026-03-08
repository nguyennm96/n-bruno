import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Portal from 'components/Portal';
import Modal from 'components/Modal';
import { selectUser, updateProfile } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';
import { IconCamera, IconTrash } from '@tabler/icons';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const AccountSettingsModal = ({ onClose }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const [name, setName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError(t('ACCOUNT_SETTINGS.invalidImageFile'));
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t('ACCOUNT_SETTINGS.imageTooLarge'));
      return;
    }

    setAvatarError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAvatarPreview(evt.target.result);
      setAvatarChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarChanged(true);
    setAvatarError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNameError('');
    setSaveError('');

    if (!name.trim()) {
      setNameError(t('ACCOUNT_SETTINGS.nameRequired'));
      return;
    }

    const payload = {};
    if (name.trim() !== (user?.name || '')) payload.name = name.trim();
    if (avatarChanged) payload.avatar = avatarPreview; // null = remove

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    const result = await dispatch(updateProfile(payload));
    setIsSaving(false);

    if (updateProfile.fulfilled.match(result)) {
      onClose();
    } else {
      setSaveError(result.payload || t('ACCOUNT_SETTINGS.failedToSave'));
    }
  };

  const letter = (user?.name || user?.email || '?')[0]?.toUpperCase();

  return (
    <Portal>
      <Modal title={t('ACCOUNT_SETTINGS.title')} handleCancel={onClose} size="sm" hideFooter>
        <StyledWrapper>
          <form className="profile-section" onSubmit={handleSubmit}>
            {/* Avatar */}
            <div className="avatar-section">
              <div className="avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                <div className="avatar-preview">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={t('ACCOUNT_SETTINGS.avatarAlt')} />
                  ) : (
                    <span className="avatar-letter">{letter}</span>
                  )}
                </div>
                <div className="avatar-overlay">
                  <IconCamera size={20} strokeWidth={1.5} />
                </div>
              </div>
              <div className="avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <p className="avatar-hint">{t('ACCOUNT_SETTINGS.avatarHint')}</p>
                {avatarPreview && (
                  <button
                    type="button"
                    className="btn-remove-avatar"
                    onClick={handleRemoveAvatar}
                  >
                    <IconTrash size={12} strokeWidth={1.5} />
                    {t('ACCOUNT_SETTINGS.removePhoto')}
                  </button>
                )}
                {avatarError && <p className="avatar-error">{avatarError}</p>}
              </div>
            </div>

            {/* Name */}
            <div className="form-group">
              <label className="form-label">{t('ACCOUNT_SETTINGS.displayName')}</label>
              <input
                type="text"
                className={`form-input${nameError ? ' input-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('ACCOUNT_SETTINGS.namePlaceholder')}
                maxLength={100}
              />
              {nameError && <span className="field-error">{nameError}</span>}
            </div>

            {/* Email (read-only) */}
            <div className="form-group">
              <label className="form-label">{t('ACCOUNT_SETTINGS.email')}</label>
              <input type="email" className="form-input read-only" value={user?.email || ''} readOnly />
            </div>

            {saveError && <p className="avatar-error">{saveError}</p>}

            <div className="modal-footer">
              <button type="button" className="btn btn-md btn-outline" onClick={onClose} disabled={isSaving}>
                {t('COMMON.CANCEL')}
              </button>
              <button type="submit" className="btn btn-md btn-primary" disabled={isSaving}>
                {isSaving ? t('ACCOUNT_SETTINGS.saving') : t('ACCOUNT_SETTINGS.saveChanges')}
              </button>
            </div>
          </form>
        </StyledWrapper>
      </Modal>
    </Portal>
  );
};

export default AccountSettingsModal;
