import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { IconLoader2, IconRefresh } from '@tabler/icons';
import { getSystemProxyVariables, refreshSystemProxy } from 'providers/ReduxStore/slices/app';
import StyledWrapper from '../StyledWrapper';

const SystemProxy = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const systemProxyVariables = useSelector((state) => state.app.systemProxyVariables);
  const { source, http_proxy, https_proxy, no_proxy } = systemProxyVariables || {};
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);

  const fetchProxy = (forceRefresh = false) => {
    setIsFetching(true);
    setError(null);
    const action = forceRefresh ? refreshSystemProxy : getSystemProxyVariables;
    dispatch(action())
      .then(() => setError(null))
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    fetchProxy(false);
  }, [dispatch]);

  const handleRefresh = () => {
    fetchProxy(true);
  };

  return (
    <StyledWrapper>
      <div className="mb-3 text-muted system-proxy-settings space-y-4">
        <div className="flex items-start justify-start flex-col gap-2 mt-2">
          <div className="flex flex-row items-center gap-2">
            <div>
              <h2 className="text-xs system-proxy-title flex flex-row">
                {t('SYSTEM_PROXY.title')} {isFetching ? <IconLoader2 className="animate-spin ml-1" size={16} strokeWidth={1.5} /> : null}
              </h2>
              <small className="system-proxy-description">
                {t('SYSTEM_PROXY.description')}
              </small>
            </div>
          </div>
        </div>
        {error && (
          <div className="mb-2 p-3 system-proxy-error-container rounded">
            <small className="system-proxy-error-text">
              {t('SYSTEM_PROXY.errorLoading', { error })}
            </small>
          </div>
        )}
        {source && (
          <div className="mb-2">
            <small className="font-medium flex flex-row gap-2">
              <div className="system-proxy-source-label text-xs">
                {t('SYSTEM_PROXY.proxySource')}
              </div>
              <div className="system-proxy-source-value">
                {source}
              </div>
            </small>
          </div>
        )}
        <small className="system-proxy-info-text">
          {t('SYSTEM_PROXY.cannotUpdate')}
        </small>
        <div className="flex flex-col justify-start items-start pt-2">
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              http_proxy
            </label>
            <div className="system-proxy-value">{http_proxy || '-'}</div>
          </div>
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              https_proxy
            </label>
            <div className="system-proxy-value">{https_proxy || '-'}</div>
          </div>
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              no_proxy
            </label>
            <div className="system-proxy-value">{no_proxy || '-'}</div>
          </div>
        </div>
        <span
          className="text-link cursor-pointer hover:underline default-collection-location-browse flex flex-row items-center"
          onClick={handleRefresh}
        >
          <IconRefresh size={14} strokeWidth={1.5} className="mr-1" />
          {t('SYSTEM_PROXY.refresh')}
        </span>
      </div>
    </StyledWrapper>
  );
};

export default SystemProxy;
