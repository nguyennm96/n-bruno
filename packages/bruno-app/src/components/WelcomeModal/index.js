import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import Bruno from 'components/Bruno';
import Button from 'ui/Button';
import { useTheme } from 'providers/Theme';
import WelcomeStep from './WelcomeStep';
import ThemeStep from './ThemeStep';
import GetStartedStep from './GetStartedStep';
import StyledWrapper from './StyledWrapper';

const TOTAL_STEPS = 3;

const WelcomeModal = ({ onDismiss, onImportCollection, onCreateCollection }) => {
  const dispatch = useDispatch();
  const {
    storedTheme,
    setStoredTheme,
    themeVariantLight,
    setThemeVariantLight,
    themeVariantDark,
    setThemeVariantDark
  } = useTheme();

  const [step, setStep] = useState(1);

  const handleActionAndDismiss = (action) => () => {
    onDismiss();
    if (action) action();
  };

  const goTo = (s) => setStep(s);

  const steps = [
    <WelcomeStep key="welcome" />,
    <ThemeStep
      key="theme"
      storedTheme={storedTheme}
      setStoredTheme={setStoredTheme}
      themeVariantLight={themeVariantLight}
      setThemeVariantLight={setThemeVariantLight}
      themeVariantDark={themeVariantDark}
      setThemeVariantDark={setThemeVariantDark}
    />,
    <GetStartedStep
      key="getstarted"
      onCreateCollection={handleActionAndDismiss(onCreateCollection)}
      onImportCollection={handleActionAndDismiss(onImportCollection)}
    />
  ];

  const isLastStep = step === TOTAL_STEPS;

  return (
    <StyledWrapper data-testid="welcome-modal">
      <div className="welcome-card">
        <div className="welcome-header">
          <div className="logo-container">
            <Bruno width={48} />
          </div>
          <h1 className="welcome-heading">
            {step === 1 ? 'Welcome to AhaMan' : step === TOTAL_STEPS ? 'Ready to go!' : 'Set up AhaMan'}
          </h1>
          {step === 1 && (
            <p className="welcome-tagline">
              A fast, Git-friendly, and open-source API client.
            </p>
          )}
        </div>

        {steps[step - 1]}

        <div className="welcome-footer">
          <div className="progress-dots">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <button
                type="button"
                key={i}
                className={`dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
                onClick={() => goTo(i + 1)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i + 1 === step ? 'step' : undefined}
              />
            ))}
          </div>

          <div className="footer-buttons">
            <Button type="button" color="secondary" variant="ghost" onClick={onDismiss}>
              Skip
            </Button>
            {step > 1 && (
              <Button type="button" color="secondary" variant="ghost" onClick={() => goTo(step - 1)}>
                Back
              </Button>
            )}
            {!isLastStep && (
              <Button type="button" onClick={() => goTo(step + 1)}>
                {step === 1 ? 'Get Started' : 'Next'}
              </Button>
            )}
            {isLastStep && (
              <Button type="button" color="secondary" onClick={onDismiss}>
                I'll explore on my own
              </Button>
            )}
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default WelcomeModal;
