import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';

const Cache = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const cacheStats = await window.ipcRenderer.invoke('renderer:get-cache-stats');
      setStats(cacheStats);
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      setStats({ error: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handlePurgeCache = async () => {
    setPurging(true);
    try {
      const result = await window.ipcRenderer.invoke('renderer:purge-cache');
      if (result.success) {
        toast.success(t('CACHE.purgeCacheSuccess'));
        await fetchStats();
      } else {
        toast.error(result.error || t('CACHE.purgeCacheFailed'));
      }
    } catch (error) {
      console.error('Error purging cache:', error);
      toast.error(t('CACHE.purgeCacheFailed'));
    } finally {
      setPurging(false);
    }
  };

  return (
    <StyledWrapper className="w-full">
      <div className="section-title">{t('CACHE.title')}</div>
      <p className="description mb-4">
        {t('CACHE.description')}
      </p>

      <div className="cache-stats">
        {loading ? (
          <div className="stat-item">
            <span className="stat-label">{t('COMMON.LOADING')}</span>
          </div>
        ) : stats?.error ? (
          <div className="stat-item">
            <span className="stat-label">{t('CACHE.errorLoading', { error: stats.error })}</span>
          </div>
        ) : (
          <>
            <div className="stat-item">
              <span className="stat-label">{t('CACHE.cachedCollections')}</span>
              <span className="stat-value">{stats?.totalCollections ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('CACHE.cachedFiles')}</span>
              <span className="stat-value">{stats?.totalFiles ?? 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t('CACHE.cacheVersion')}</span>
              <span className="stat-value">{stats?.version ?? 'N/A'}</span>
            </div>
          </>
        )}
      </div>

      <button
        className="purge-button"
        onClick={handlePurgeCache}
        disabled={purging || loading}
      >
        {purging ? t('CACHE.purging') : t('CACHE.purgeCache')}
      </button>
    </StyledWrapper>
  );
};

export default Cache;
