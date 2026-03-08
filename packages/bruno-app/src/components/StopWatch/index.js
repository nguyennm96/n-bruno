import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const StopWatch = ({ startTime }) => {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!startTime) return;

    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);

    return () => clearInterval(intervalId);
  }, [startTime]);

  if (!startTime) return <span>{t('STOP_WATCH.LOADING')}</span>;

  const elapsedTime = currentTime - startTime;
  if (elapsedTime < 250) return <span>{t('STOP_WATCH.LOADING')}</span>;

  const seconds = elapsedTime / 1000;
  return <span>{seconds.toFixed(1)}s</span>;
};

export default React.memo(StopWatch);
