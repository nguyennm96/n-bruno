import React from 'react';
import Tippy from '@tippyjs/react';
import { IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import ToolHint from 'components/ToolHint';
import { useTheme } from 'providers/Theme';
import StyledWrapper from './StyledWrapper';

const MODE_BUTTONS = [
  { mode: 'light', icon: IconSun, title: 'Light' },
  { mode: 'dark', icon: IconMoon, title: 'Dark' },
  { mode: 'system', icon: IconDeviceDesktop, title: 'System' }
];

const ThemeDropdown = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tooltipEnabled, setTooltipEnabled] = React.useState(true);
  const { storedTheme, setStoredTheme } = useTheme();

  const handleOpen = () => {
    setTooltipEnabled(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setTooltipEnabled(true), 100);
  };

  const menuContent = (
    <StyledWrapper>
      <div className="theme-menu" role="dialog" aria-label="Theme selector">
        <div className="menu-label">Appearance</div>
        <div className="mode-buttons" role="radiogroup">
          {MODE_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            const isActive = storedTheme === btn.mode;
            return (
              <button
                key={btn.mode}
                className={`mode-button ${isActive ? 'active' : ''}`}
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  setStoredTheme(btn.mode); handleClose();
                }}
                title={btn.title}
              >
                <Icon size={16} strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>
    </StyledWrapper>
  );

  return (
    <ToolHint text="Theme" toolhintId="ThemeDropdown" place="top" offset={10} hidden={!tooltipEnabled}>
      <Tippy
        content={menuContent}
        placement="top-start"
        interactive
        arrow={false}
        animation={false}
        visible={isOpen}
        onClickOutside={handleClose}
        appendTo="parent"
      >
        <div onClick={() => (isOpen ? handleClose() : handleOpen())}>
          {children}
        </div>
      </Tippy>
    </ToolHint>
  );
};

export default ThemeDropdown;
