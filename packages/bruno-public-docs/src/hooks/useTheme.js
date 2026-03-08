import { useState, useCallback } from 'react';
import { lightTheme, darkTheme } from '../styles/theme';

const STORAGE_KEY = 'bruno-docs-theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark') return darkTheme;
    if (saved === 'light') return lightTheme;
  } catch {
    // ignore
  }
  // Default to system preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return darkTheme;
  }
  return lightTheme;
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev.isDark ? lightTheme : darkTheme;
      try {
        localStorage.setItem(STORAGE_KEY, next.isDark ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { theme, isDark: theme.isDark, toggleTheme };
}
