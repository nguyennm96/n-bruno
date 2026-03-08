import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useSelector } from 'react-redux';
import {
  selectIsAuthenticated,
  selectIsAuthInitializing,
  selectIsInitializingCloudData,
  selectUser
} from 'providers/ReduxStore/slices/auth';

const MIN_VISIBLE_MS = 3000;
const EXIT_ANIMATION_MS = 320;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const progress = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(180%); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.background.base}f2;
  backdrop-filter: blur(3px);
  animation: ${({ $exiting }) => ($exiting ? fadeOut : fadeIn)} 0.28s ease both;
`;

const Content = styled.div`
  width: min(560px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

const Spinner = styled.span`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.border1};
  border-top-color: ${({ theme }) => theme.brand};
  animation: ${spin} 0.8s linear infinite;
  flex-shrink: 0;
`;

const TextWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.text};
  font-size: 24px;
  line-height: 1.35;
  font-weight: 600;
  text-align: center;
`;

const Name = styled.span`
  color: ${({ theme }) => theme.brand};
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.subtext0};
  font-size: 14px;
  line-height: 1.35;
  text-align: center;
`;

const ProgressTrack = styled.div`
  width: min(360px, 80vw);
  height: 4px;
  border-radius: 999px;
  background: ${({ theme }) => theme.border.border1};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  width: 40%;
  height: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.brand};
  opacity: 0.8;
  animation: ${progress} 1.3s ease-in-out infinite;
`;

export default function CloudLoadingScreen() {
  const isInitializing = useSelector(selectIsAuthInitializing);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitializingCloudData = useSelector(selectIsInitializingCloudData);
  const user = useSelector(selectUser);

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const shownAtRef = useRef(0);
  const hideStartTimerRef = useRef(null);
  const hideEndTimerRef = useRef(null);

  const shouldShow = isInitializing || (isAuthenticated && isInitializingCloudData);

  useEffect(() => {
    const clearTimers = () => {
      if (hideStartTimerRef.current) {
        clearTimeout(hideStartTimerRef.current);
      }
      if (hideEndTimerRef.current) {
        clearTimeout(hideEndTimerRef.current);
      }
      hideStartTimerRef.current = null;
      hideEndTimerRef.current = null;
    };

    if (shouldShow) {
      clearTimers();
      setExiting(false);
      setVisible(true);
      if (!shownAtRef.current) {
        shownAtRef.current = Date.now();
      }
      return clearTimers;
    }

    if (visible) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

      hideStartTimerRef.current = setTimeout(() => {
        setExiting(true);
        hideEndTimerRef.current = setTimeout(() => {
          setVisible(false);
          setExiting(false);
          shownAtRef.current = 0;
        }, EXIT_ANIMATION_MS);
      }, remaining);
    }

    return clearTimers;
  }, [shouldShow, visible]);

  if (!visible) {
    return null;
  }

  const firstName = user?.name?.split(' ')[0];

  return (
    <Overlay $exiting={exiting}>
      <Content>
        <Header>
          <Spinner />
          <TextWrap>
            <Title>
              {firstName ? (
                <>
                  Xin chào, <Name>{firstName}</Name>!
                </>
              ) : (
                'Đang kết nối Bruno Cloud...'
              )}
            </Title>
            <Subtitle>Đang tải dữ liệu workspace của bạn</Subtitle>
          </TextWrap>
        </Header>
        <ProgressTrack>
          <ProgressFill />
        </ProgressTrack>
      </Content>
    </Overlay>
  );
}
