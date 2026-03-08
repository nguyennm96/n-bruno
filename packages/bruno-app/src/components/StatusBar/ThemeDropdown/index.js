import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  useFloating,
  useDismiss,
  useInteractions,
  FloatingPortal,
  autoUpdate,
  offset,
  flip,
  shift
} from '@floating-ui/react';
import { IconCheck, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons';
import ToolHint from 'components/ToolHint';
import { useTheme } from 'providers/Theme';
import { getLightThemes, getDarkThemes } from 'themes/index';
import StyledWrapper from './StyledWrapper';

const MODES = ['light', 'dark', 'system'];
const MODE_BUTTONS = [
  { mode: 'light', icon: IconSun, title: 'Light' },
  { mode: 'dark', icon: IconMoon, title: 'Dark' },
  { mode: 'system', icon: IconDeviceDesktop, title: 'System' }
];

const ThemeDropdown = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [focusedSection, setFocusedSection] = useState('mode');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  const modeButtonRefs = useRef([]);
  const lightItemRefs = useRef([]);
  const darkItemRefs = useRef([]);

  const {
    storedTheme,
    setStoredTheme,
    displayedTheme,
    themeVariantLight,
    themeVariantDark,
    setThemeVariantLight,
    setThemeVariantDark
  } = useTheme();

  const lightThemes = getLightThemes();
  const darkThemes = getDarkThemes();
  const isSystemMode = storedTheme === 'system';

  const getFocusedClass = (section, index) =>
    isKeyboardNav && focusedSection === section && focusedIndex === index ? 'focused' : '';

  const handleModeSelect = (mode) => setStoredTheme(mode);

  const handleThemeSelect = (themeId, isLight) => {
    if (isLight) {
      setThemeVariantLight(themeId);
    } else {
      setThemeVariantDark(themeId);
    }
  };

  const handleOpen = () => {
    setTooltipEnabled(false);
    setIsOpen(true);
    setFocusedSection('mode');
    setFocusedIndex(0);
    setIsKeyboardNav(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setTooltipEnabled(true), 100);
  };

  const handleMouseEnter = (section, index) => {
    setIsKeyboardNav(false);
    setFocusedSection(section);
    setFocusedIndex(index);
  };

  const getAvailableSections = useCallback(() => {
    if (isSystemMode) return ['mode', 'light', 'dark'];
    return storedTheme === 'light' ? ['mode', 'light'] : ['mode', 'dark'];
  }, [isSystemMode, storedTheme]);

  const getMaxIndex = useCallback((section) => {
    switch (section) {
      case 'mode': return 2;
      case 'light': return lightThemes.length - 1;
      case 'dark': return darkThemes.length - 1;
      default: return 0;
    }
  }, [lightThemes.length, darkThemes.length]);

  const getModeIndex = useCallback(() => MODES.indexOf(storedTheme), [storedTheme]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const refs = { mode: modeButtonRefs, light: lightItemRefs, dark: darkItemRefs };
      refs[focusedSection]?.current[focusedIndex]?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, focusedSection, focusedIndex]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    const maxIndex = getMaxIndex(focusedSection);
    const sections = getAvailableSections();

    const handlers = {
      Escape: () => {
        e.preventDefault(); handleClose();
      },
      ArrowDown: () => {
        e.preventDefault();
        setIsKeyboardNav(true);
        if (focusedSection === 'mode') {
          setFocusedSection(sections[1]);
          setFocusedIndex(0);
        } else if (focusedIndex < maxIndex) {
          setFocusedIndex(focusedIndex + 1);
        }
      },
      ArrowUp: () => {
        e.preventDefault();
        setIsKeyboardNav(true);
        if (focusedSection !== 'mode') {
          if (focusedIndex > 0) setFocusedIndex(focusedIndex - 1);
          else {
            setFocusedSection('mode'); setFocusedIndex(getModeIndex());
          }
        }
      },
      ArrowLeft: () => {
        e.preventDefault();
        setIsKeyboardNav(true);
        if (focusedSection === 'mode') {
          if (focusedIndex > 0) setFocusedIndex(focusedIndex - 1);
        } else if (isSystemMode && focusedSection === 'dark') {
          setFocusedSection('light');
          setFocusedIndex(Math.min(focusedIndex, lightThemes.length - 1));
        }
      },
      ArrowRight: () => {
        e.preventDefault();
        setIsKeyboardNav(true);
        if (focusedSection === 'mode') {
          if (focusedIndex < 2) setFocusedIndex(focusedIndex + 1);
        } else if (isSystemMode && focusedSection === 'light') {
          setFocusedSection('dark');
          setFocusedIndex(Math.min(focusedIndex, darkThemes.length - 1));
        }
      },
      Enter: () => {
        e.preventDefault();
        if (focusedSection === 'mode') handleModeSelect(MODES[focusedIndex]);
        else if (focusedSection === 'light') handleThemeSelect(lightThemes[focusedIndex].id, true);
        else if (focusedSection === 'dark') handleThemeSelect(darkThemes[focusedIndex].id, false);
      },
      Tab: () => handleClose()
    };
    handlers[e.key]?.();
  }, [isOpen, focusedSection, focusedIndex, getAvailableSections, getMaxIndex, getModeIndex, isSystemMode, lightThemes, darkThemes, handleClose, handleModeSelect, handleThemeSelect]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (next) => { next ? handleOpen() : handleClose(); },
    placement: 'top-start',
    strategy: 'fixed',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const renderThemeList = (themeList, isLight, currentVariant, label) => {
    const itemRefs = isLight ? lightItemRefs : darkItemRefs;
    const section = isLight ? 'light' : 'dark';
    const isActiveSystemTheme = isSystemMode && ((isLight && displayedTheme === 'light') || (!isLight && displayedTheme === 'dark'));

    return (
      <div className="theme-list" role="listbox" aria-label={label}>
        <div className="theme-list-label">
          {label}
          {isActiveSystemTheme && <span className="active-badge">Active</span>}
        </div>
        {themeList.map((t, index) => {
          const isActive = currentVariant === t.id;
          return (
            <div
              key={t.id}
              ref={(el) => (itemRefs.current[index] = el)}
              className={`theme-item ${isActive ? 'active' : ''} ${getFocusedClass(section, index)}`}
              role="option"
              aria-selected={isActive}
              tabIndex={-1}
              onClick={() => handleThemeSelect(t.id, isLight)}
              onMouseEnter={() => handleMouseEnter(section, index)}
            >
              <span className="theme-item-label">{t.name}</span>
              {isActive && <IconCheck size={14} strokeWidth={2} className="check-icon" />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ToolHint text="Theme" toolhintId="ThemeDropdown" place="top" offset={10} hidden={!tooltipEnabled}>
      <div
        ref={refs.setReference}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        {...getReferenceProps()}
      >
        {children}
      </div>
      {isOpen && (
        <FloatingPortal>
          <StyledWrapper ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 9999 }} {...getFloatingProps()}>
            <div
              className={`theme-menu ${isSystemMode ? 'two-columns' : ''}`}
              role="dialog"
              aria-label="Theme selector"
            >
              <div className="mode-section">
                <div className="mode-label">Appearance</div>
                <div className="mode-buttons" role="radiogroup">
                  {MODE_BUTTONS.map((btn, index) => {
                    const Icon = btn.icon;
                    const isActive = storedTheme === btn.mode;
                    return (
                      <button
                        key={btn.mode}
                        ref={(el) => (modeButtonRefs.current[index] = el)}
                        className={`mode-button ${isActive ? 'active' : ''} ${getFocusedClass('mode', index)}`}
                        role="radio"
                        aria-checked={isActive}
                        tabIndex={-1}
                        onClick={() => handleModeSelect(btn.mode)}
                        onMouseEnter={() => handleMouseEnter('mode', index)}
                        title={btn.title}
                      >
                        <Icon size={18} strokeWidth={1.5} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={`theme-lists ${isSystemMode ? 'two-columns' : ''}`}>
                {(storedTheme === 'light' || isSystemMode) && renderThemeList(lightThemes, true, themeVariantLight, 'Light theme')}
                {(storedTheme === 'dark' || isSystemMode) && renderThemeList(darkThemes, false, themeVariantDark, 'Dark theme')}
              </div>
            </div>
          </StyledWrapper>
        </FloatingPortal>
      )}
    </ToolHint>
  );
};

export default ThemeDropdown;
