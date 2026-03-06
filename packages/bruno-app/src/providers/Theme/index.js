import React from 'react';
import themes from 'themes/index';
import useLocalStorage from 'hooks/useLocalStorage/index';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ThemeProvider as SCThemeProvider } from 'styled-components';

// Helper: Get effective theme ('light' or 'dark') based on storedTheme
const getEffectiveTheme = (storedTheme) => {
  if (storedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return storedTheme;
};

// Helper: Apply theme class to root element
const applyThemeToRoot = (theme) => {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

export const ThemeContext = createContext();
export const ThemeProvider = (props) => {
  const [storedTheme, setStoredTheme] = useLocalStorage('bruno.theme', 'system');
  const [displayedTheme, setDisplayedTheme] = useState(() => getEffectiveTheme(storedTheme));

  // Listen for system theme changes (only affects 'system' mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      if (storedTheme !== 'system') return;
      const newTheme = e.matches ? 'light' : 'dark';
      setDisplayedTheme(newTheme);
      applyThemeToRoot(newTheme);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [storedTheme]);

  // Apply theme when storedTheme changes
  useEffect(() => {
    const effectiveTheme = getEffectiveTheme(storedTheme);
    setDisplayedTheme(effectiveTheme);
    applyThemeToRoot(effectiveTheme);

    if (window.ipcRenderer) {
      window.ipcRenderer.send('renderer:theme-change', storedTheme);
    }
  }, [storedTheme]);

  // storedTheme: 'light' | 'dark' | 'system'
  // displayedTheme: 'light' | 'dark'
  const theme = useMemo(() => {
    const effective = getEffectiveTheme(storedTheme);
    return effective === 'light' ? themes.light : themes.dark;
  }, [storedTheme]);

  const value = {
    theme,
    storedTheme,
    displayedTheme,
    setStoredTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <SCThemeProvider theme={theme} {...props} />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error(`useTheme must be used within a ThemeProvider`);
  }

  return context;
};

export default ThemeProvider;
