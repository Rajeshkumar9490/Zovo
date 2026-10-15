import { createContext, useContext, useLayoutEffect, useState, ReactNode } from 'react';
import { ThemeMode } from '../types.js';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('zovo_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Private browsing and embedded webviews can disable local storage.
  }
  return 'dark';
}

function prefersDark(theme: ThemeMode): boolean {
  return theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readSavedTheme);

  const [isDark, setIsDark] = useState<boolean>(() => prefersDark(theme));

  useLayoutEffect(() => {
    const root = document.documentElement;
    try {
      localStorage.setItem('zovo_theme', theme);
    } catch {
      // The selected appearance still applies when persistence is unavailable.
    }
    root.style.colorScheme = prefersDark(theme) ? 'dark' : 'light';

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mediaQuery.matches);
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const listener = (e: MediaQueryListEvent) => {
        setIsDark(e.matches);
        root.style.colorScheme = e.matches ? 'dark' : 'light';
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else if (theme === 'dark') {
      root.classList.add('dark');
      setIsDark(true);
    } else {
      root.classList.remove('dark');
      setIsDark(false);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
