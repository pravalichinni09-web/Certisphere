import { useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'light';

const STORAGE_KEY = 'cms_theme';
const EVENT = 'cms-theme-updated';

// Dark mode has been removed — the app is light-mode only.
const readStoredTheme = (): ThemeMode => 'light';

export const applyTheme = (_mode?: ThemeMode) => {
  if (typeof document === 'undefined') return;
  // Always force light mode regardless of the requested mode.
  document.documentElement.setAttribute('data-theme', 'light');
  try {
    window.localStorage.setItem(STORAGE_KEY, 'light');
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent<ThemeMode>(EVENT, { detail: 'light' }));
  } catch {
    /* ignore */
  }
};

/** Run as early as possible so the page paints with the correct theme. */
export const initTheme = () => {
  applyTheme(readStoredTheme());
};

export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  // Dark mode removed — ensure the document always stays in light mode,
  // even if another tab wrote an old value to storage.
  useEffect(() => {
    const enforceLight = () => {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== 'light') enforceLight();
    };
    window.addEventListener(EVENT, enforceLight);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(EVENT, enforceLight);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const setMode = useCallback(() => {
    applyTheme('light');
    setTheme('light');
  }, []);

  // Dark mode removed — toggling is a no-op that keeps the app in light mode.
  const toggle = useCallback(() => {
    applyTheme('light');
    setTheme('light');
  }, []);

  return { theme, setMode, toggle };
};
