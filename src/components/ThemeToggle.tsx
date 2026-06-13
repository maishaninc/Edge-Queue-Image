'use client';

import { useEffect, useSyncExternalStore } from 'react';

const THEME_CHANGE_EVENT = 'aivro-theme-change';

function getPreferredDark() {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('theme');
  return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeToTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  media.addEventListener('change', callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    media.removeEventListener('change', callback);
  };
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeToTheme, getPreferredDark, () => false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      className="icon-button"
      type="button"
      onClick={() => {
        const next = !dark;
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? '切换浅色模式' : '切换深色模式'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
