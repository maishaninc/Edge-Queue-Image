'use client';

import { useEffect, useRef, useState } from 'react';
import { LANGUAGE_LABELS, LOCALES, isSiteLocale, type SiteLocale } from '@/lib/i18n';

type LanguageSwitcherProps = {
  currentLocale: SiteLocale;
};

export default function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownId = 'language-switcher-menu';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLocale(locale: SiteLocale) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] && isSiteLocale(parts[0])) {
      parts[0] = locale;
    } else {
      parts.unshift(locale);
    }
    window.location.assign(`/${parts.join('/')}${window.location.search}${window.location.hash}`);
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-btn"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Switch language"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={dropdownId}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{LANGUAGE_LABELS[currentLocale]}</span>
      </button>
      {open ? (
        <div id={dropdownId} className="lang-dropdown" role="menu">
          {LOCALES.map((locale) => (
            <button key={locale} type="button" role="menuitem" onClick={() => switchLocale(locale)} className={currentLocale === locale ? 'active' : ''}>
              {LANGUAGE_LABELS[locale]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
