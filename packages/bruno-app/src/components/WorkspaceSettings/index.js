import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { IconUsers, IconAlertTriangle, IconSettings } from '@tabler/icons';
import Portal from 'components/Portal';
import { fetchWorkspaceMembersAction } from 'providers/ReduxStore/slices/workspaces/actions';
import MembersTab from './MembersTab';
import DangerZone from './DangerZone';
import StyledWrapper from './StyledWrapper';

const WorkspaceSettings = ({ workspace, onClose }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('members');

  useEffect(() => {
    if (workspace?.uid) {
      dispatch(fetchWorkspaceMembersAction(workspace.uid));
    }
  }, [workspace?.uid]);

  const tabs = [
    { id: 'members', label: t('WORKSPACE_SETTINGS.TAB_MEMBERS'), icon: <IconUsers size={14} strokeWidth={1.5} /> },
    { id: 'danger', label: t('WORKSPACE_SETTINGS.TAB_DANGER'), icon: <IconAlertTriangle size={14} strokeWidth={1.5} /> }
  ];

  return (
    <Portal>
      <StyledWrapper>
        <div className="settings-backdrop" onClick={onClose} />
        <div className="settings-modal">
          <div className="settings-header">
            <IconSettings size={16} strokeWidth={1.5} className="header-icon" />
            <div className="header-titles">
              <h2 className="settings-title">{t('WORKSPACE_SETTINGS.TITLE')}</h2>
              <div className="workspace-name">{workspace?.name}</div>
            </div>
            <button className="close-btn" onClick={onClose} aria-label={t('WORKSPACE_SETTINGS.CLOSE')}>
              ×
            </button>
          </div>
          <div className="settings-body">
            <div className="settings-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}${tab.id === 'danger' ? ' danger' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="tab-content">
              {activeTab === 'members' && <MembersTab workspace={workspace} />}
              {activeTab === 'danger' && <DangerZone workspace={workspace} onClose={onClose} />}
            </div>
          </div>
        </div>
      </StyledWrapper>
    </Portal>
  );
};

export default WorkspaceSettings;
