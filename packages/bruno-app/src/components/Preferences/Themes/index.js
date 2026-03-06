import React from 'react';
import { useTheme } from 'providers/Theme';
import { IconBrightnessUp, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const THEME_MODES = [
  { key: 'light', label: 'Light', icon: IconBrightnessUp },
  { key: 'dark', label: 'Dark', icon: IconMoon },
  { key: 'system', label: 'System', icon: IconDeviceDesktop }
];

const Themes = () => {
  const { storedTheme, setStoredTheme } = useTheme();

  return (
    <StyledWrapper>
      <div className="appearance-container">
        <div className="section-header">Appearance</div>

        <div className="theme-mode-selector">
          {THEME_MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = storedTheme === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setStoredTheme(mode.key)}
                className={`theme-mode-option ${isSelected ? 'selected' : ''}`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default Themes;
