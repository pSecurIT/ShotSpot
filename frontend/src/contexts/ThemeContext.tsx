import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  themePreference: ThemePreference;
  setThemePreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'themePreference';

function applyThemePreferenceToDocument(themePreference: ThemePreference) {
  const root = document.documentElement;

  if (themePreference === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.setAttribute('data-theme', themePreference);
}

function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getInitialThemePreference());

  useEffect(() => {
    applyThemePreferenceToDocument(themePreference);
    window.localStorage.setItem(STORAGE_KEY, themePreference);
  }, [themePreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      setThemePreference: setThemePreferenceState
    }),
    [themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
