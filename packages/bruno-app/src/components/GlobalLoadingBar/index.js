import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  selectIsGlobalLoading,
  selectCurrentLoadingMessage,
  selectGlobalProgress,
  selectActiveOperationsCount
} from 'providers/ReduxStore/slices/globalLoading';
import StyledWrapper from './StyledWrapper';

const GlobalLoadingBar = () => {
  const isLoading = useSelector(selectIsGlobalLoading);
  const message = useSelector(selectCurrentLoadingMessage);
  const progress = useSelector(selectGlobalProgress);
  const operationsCount = useSelector(selectActiveOperationsCount);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Animate progress bar
  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);

      if (progress !== null) {
        // Determinate progress (we know the percentage)
        setDisplayProgress(progress * 100);
      } else {
        // Indeterminate progress (animate indefinitely)
        setDisplayProgress(-1);
      }
    } else {
      // When loading completes, animate to 100% then hide
      setDisplayProgress(100);

      const timer = setTimeout(() => {
        setIsVisible(false);
        setDisplayProgress(0);
      }, 300); // Delay before hiding

      return () => clearTimeout(timer);
    }
  }, [isLoading, progress]);

  if (!isVisible) {
    return null;
  }

  return (
    <StyledWrapper>
      <div className="global-loading-bar">
        {/* Progress bar */}
        <div
          className={`progress-bar ${displayProgress === -1 ? 'indeterminate' : ''}`}
          style={{
            width: displayProgress >= 0 ? `${displayProgress}%` : '30%'
          }}
        />

        {/* Loading message (optional) */}
        {message && (
          <div className="loading-message">
            <div className="spinner" />
            <span className="message-text">{message}</span>
            {operationsCount > 1 && (
              <span className="operations-count">({operationsCount} operations)</span>
            )}
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default GlobalLoadingBar;
