import React from 'react';
import { useSelector } from 'react-redux';
import { selectIsOnline, selectLastOnlineAt } from 'providers/ReduxStore/slices/network';
import { selectSyncQueueCount, selectIsProcessingSyncQueue } from 'providers/ReduxStore/slices/syncQueue';
import { selectIsAuthenticated } from 'providers/ReduxStore/slices/auth';
import StyledWrapper from './StyledWrapper';

const NetworkStatusIndicator = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isOnline = useSelector(selectIsOnline);
  const pendingCount = useSelector(selectSyncQueueCount);
  const isSyncing = useSelector(selectIsProcessingSyncQueue);
  const lastOnlineAt = useSelector(selectLastOnlineAt);

  // Only show when user is logged in
  if (!isAuthenticated) {
    return null;
  }

  // Determine status
  let statusText = '';
  let statusIcon = '';
  let statusClass = '';

  if (isSyncing) {
    statusText = 'Syncing...';
    statusIcon = '🔄';
    statusClass = 'status-syncing';
  } else if (isOnline) {
    statusText = 'Online';
    statusIcon = '☁️';
    statusClass = 'status-online';
  } else {
    statusText = 'Offline';
    statusIcon = '📴';
    statusClass = 'status-offline';
  }

  // Format last online time
  const formatLastOnline = () => {
    if (!lastOnlineAt) return 'Never';
    const date = new Date(lastOnlineAt);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const tooltipText = isOnline ? 'Connected to cloud' : `Last online: ${formatLastOnline()}`;

  return (
    <StyledWrapper className="flex items-center gap-2">
      <div className={`status-indicator ${statusClass}`} title={tooltipText}>
        <span className="status-icon">{statusIcon}</span>
        <span className="status-text">{statusText}</span>
      </div>

      {!isOnline && pendingCount > 0 && (
        <div className="pending-count" title={`${pendingCount} change(s) waiting to sync`}>
          <span className="count">{pendingCount}</span>
          <span className="label">pending</span>
        </div>
      )}
    </StyledWrapper>
  );
};

export default NetworkStatusIndicator;
