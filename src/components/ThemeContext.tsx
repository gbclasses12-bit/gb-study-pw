import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'SYSTEM',
  setTheme: () => {},
  resolvedDark: false,
});

function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem('USER_THEME');
    if (raw === 'LIGHT' || raw === 'DARK' || raw === 'SYSTEM') {
      return raw;
    }
    localStorage.setItem('USER_THEME', 'SYSTEM');
  } catch {
    // Ignore storage access errors
  }
  return 'SYSTEM';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
  const [resolvedDark, setResolvedDark] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark =
        theme === 'DARK' ? true : theme === 'LIGHT' ? false : media.matches;
      root.classList.toggle('dark', dark);
      setResolvedDark(dark);
    };

    apply();
    try {
      localStorage.setItem('USER_THEME', theme);
    } catch {
      // Ignore
    }

    if (theme === 'SYSTEM') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, resolvedDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
