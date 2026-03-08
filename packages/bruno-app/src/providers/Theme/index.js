import React from 'react';
import themes from 'themes/index';
import useLocalStorage from 'hooks/useLocalStorage/index';
import TransitionOverlay from './TransitionOverlay';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { ThemeProvider as SCThemeProvider } from 'styled-components';

// Helper: Get effective mode ('light' or 'dark') based on storedTheme
const getEffectiveMode = (storedTheme) => {
  if (storedTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return storedTheme;
};

// Helper: Apply light/dark class to root element for Tailwind dark mode
const applyThemeToRoot = (mode) => {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
};

export const ThemeContext = createContext();
export const ThemeProvider = ({ children }) => {
  // storedTheme: 'light' | 'dark' | 'system'  (mode selector)
  const [storedTheme, setStoredTheme] = useLocalStorage('bruno.theme', 'system');
  // themeVariantLight / themeVariantDark: specific theme name for each mode
  const [themeVariantLight, setThemeVariantLight] = useLocalStorage('bruno.themeVariantLight', 'light');
  const [themeVariantDark, setThemeVariantDark] = useLocalStorage('bruno.themeVariantDark', 'dark');
  const [displayedTheme, setDisplayedTheme] = useState(() => getEffectiveMode(storedTheme));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef(null);

  // Show overlay, run cb(), then hide after the re-render settles
  const startTransition = useCallback((cb) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setIsTransitioning(true);
    // Give React one frame to paint the overlay, then apply the change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cb();
        transitionTimerRef.current = setTimeout(() => setIsTransitioning(false), 400);
      });
    });
  }, []);

  // Wrapped setters that show the transition overlay
  const handleSetStoredTheme = useCallback((theme) => {
    startTransition(() => setStoredTheme(theme));
  }, [startTransition, setStoredTheme]);

  const handleSetThemeVariantLight = useCallback((variant) => {
    startTransition(() => setThemeVariantLight(variant));
  }, [startTransition, setThemeVariantLight]);

  const handleSetThemeVariantDark = useCallback((variant) => {
    startTransition(() => setThemeVariantDark(variant));
  }, [startTransition, setThemeVariantDark]);

  // Listen for system theme changes (only affects 'system' mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      if (storedTheme !== 'system') return;
      const newMode = e.matches ? 'light' : 'dark';
      setDisplayedTheme(newMode);
      applyThemeToRoot(newMode);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [storedTheme]);

  // Apply mode class when storedTheme changes
  useEffect(() => {
    const effectiveMode = getEffectiveMode(storedTheme);
    setDisplayedTheme(effectiveMode);
    applyThemeToRoot(effectiveMode);

    if (window.ipcRenderer) {
      window.ipcRenderer.send('renderer:theme-change', storedTheme);
    }
  }, [storedTheme]);

  // Resolve the actual theme object from variant selections
  const theme = useMemo(() => {
    const isLight = displayedTheme === 'light';
    const variantName = isLight ? themeVariantLight : themeVariantDark;
    const fallback = isLight ? themes.light : themes.dark;
    return themes[variantName] ?? fallback;
  }, [displayedTheme, themeVariantLight, themeVariantDark]);

  const value = {
    theme,
    storedTheme,
    displayedTheme,
    setStoredTheme: handleSetStoredTheme,
    themeVariantLight,
    setThemeVariantLight: handleSetThemeVariantLight,
    themeVariantDark,
    setThemeVariantDark: handleSetThemeVariantDark,
    startTransition
  };

  return (
    <ThemeContext.Provider value={value}>
      <SCThemeProvider theme={theme}>
        {children}
        {isTransitioning && <TransitionOverlay />}
      </SCThemeProvider>
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
