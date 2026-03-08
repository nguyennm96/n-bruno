import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import {
  selectWsConnected,
  selectSyncState,
  selectLastSyncedAt
} from 'providers/ReduxStore/slices/cloudSync';

/**
 * Shows real-time sync connection status in cloud mode.
 * Displayed at the bottom of the sidebar.
 */
const CloudSyncBadge = () => {
  const { t } = useTranslation();
  const wsConnected = useSelector(selectWsConnected);
  const syncState = useSelector(selectSyncState);
  const lastSyncedAt = useSelector(selectLastSyncedAt);

  const formatTime = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return null;
    }
  };

  let label, dotClass;
  if (syncState === 'syncing') {
    label = t('CLOUD.SYNCING');
    dotClass = 'dot-syncing';
  } else if (!wsConnected) {
    label = t('CLOUD.OFFLINE');
    dotClass = 'dot-offline';
  } else if (syncState === 'error') {
    label = t('CLOUD.SYNC_ERROR');
    dotClass = 'dot-error';
  } else {
    const time = formatTime(lastSyncedAt);
    label = time ? `Synced ${time}` : 'Synced';
    dotClass = 'dot-synced';
  }

  return (
    <div className="cloud-sync-badge" title={lastSyncedAt ? `Last synced: ${lastSyncedAt}` : 'Not yet synced'}>
      <span className={`dot ${dotClass}`} />
      <span className="label">{label}</span>

      <style>{`
        .cloud-sync-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 7px;
          font-size: 11px;
          opacity: 0.7;
          user-select: none;
        }
        .cloud-sync-badge:hover {
          opacity: 1;
        }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-synced  { background: #22c55e; }
        .dot-syncing { background: #f59e0b; animation: pulse 1.2s ease-in-out infinite; }
        .dot-offline { background: #94a3b8; }
        .dot-error   { background: #ef4444; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}
      </style>
    </div>
  );
};

export default CloudSyncBadge;
