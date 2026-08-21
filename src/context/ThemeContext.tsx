/**
 * Theme Context (Phase 3)
 * Application-wide Day / Night mode.
 * Does NOT follow the Android system theme — this is an explicit user preference.
 * Persists in localStorage. Applies a data-theme attribute to <html>.
 * Default: NIGHT (preserves existing dark CRM design).
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'DAY' | 'NIGHT';

const THEME_STORAGE_KEY = 'amaratv_crm_theme_v1';
const DEFAULT_THEME: ThemeMode = 'NIGHT';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', mode.toLowerCase());
    // Also set color-scheme for native form elements
    document.documentElement.style.colorScheme = mode === 'DAY' ? 'light' : 'dark';
  }
}

function loadStoredTheme(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'DAY' || stored === 'NIGHT') return stored;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_THEME;
}

function saveTheme(mode: ThemeMode): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  } catch {
    // ignore
  }
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = loadStoredTheme();
    applyThemeToDocument(stored);
    return stored;
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    saveTheme(mode);
    applyThemeToDocument(mode);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'NIGHT' ? 'DAY' : 'NIGHT';
      saveTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  };

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'NIGHT' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return context;
};
