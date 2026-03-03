import React from 'react';
import { IconCloud, IconCloudOff, IconRefresh, IconAlertCircle } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

/**
 * Sync status indicator for cloud-linked collections
 * Shows current sync state with icon and tooltip
 */
const SyncStatusIndicator = ({ status, lastSyncedAt, error }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'synced':
        return <IconCloud size={14} strokeWidth={1.5} className="icon-synced" />;
      case 'syncing':
        return <IconRefresh size={14} strokeWidth={1.5} className="icon-syncing" />;
      case 'error':
        return <IconAlertCircle size={14} strokeWidth={1.5} className="icon-error" />;
      case 'offline':
        return <IconCloudOff size={14} strokeWidth={1.5} className="icon-offline" />;
      default:
        return null;
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case 'synced':
        return lastSyncedAt ? `Synced ${formatTimeAgo(lastSyncedAt)}` : 'Synced with cloud';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return error || 'Sync error';
      case 'offline':
        return 'Offline - will sync when connected';
      default:
        return '';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const syncTime = new Date(timestamp);
    const diffMs = now - syncTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!status) return null;

  return (
    <StyledWrapper title={getTooltipText()}>
      <div className={`sync-indicator status-${status}`}>{getStatusIcon()}</div>
    </StyledWrapper>
  );
};

export default SyncStatusIndicator;
