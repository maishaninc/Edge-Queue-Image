import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ImageGenerator from '@/components/ImageGenerator';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LOCALES,
  OG_LOCALE_BY_LOCALE,
  COPY,
  SEO_COPY,
  SITE_NAME,
  absoluteLocaleUrl,
  isSiteLocale,
  relativeLanguageAlternates,
  relativeLocalePath,
  type SiteLocale,
} from '@/lib/i18n';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSiteLocale(locale)) {
    notFound();
  }
  const current = SEO_COPY[locale];

  return {
    title: current.title,
    description: current.description,
    keywords: current.keywords,
    alternates: {
      canonical: relativeLocalePath(locale),
      languages: relativeLanguageAlternates(),
    },
    openGraph: {
      title: current.title,
      description: current.description,
      url: absoluteLocaleUrl(locale),
      siteName: SITE_NAME,
      locale: OG_LOCALE_BY_LOCALE[locale],
      alternateLocale: LOCALES.filter((item) => item !== locale).map((item) => OG_LOCALE_BY_LOCALE[item]),
      type: 'website',
      images: [{ url: '/logo.svg', alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary',
      title: current.title,
      description: current.description,
      images: ['/logo.svg'],
    },
  };
}

export default async function LocalePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) {
    notFound();
  }
  const siteLocale = locale as SiteLocale;
  const copy = COPY[siteLocale];

  return (
    <div className="app-shell dot-grid-bg">
      <header className="nav-frosted">
        <div className="nav-inner">
          <a className="brand" href={`/${locale}`}>
            <span className="brand-mark" aria-hidden="true" />
            <span>{SITE_NAME}</span>
          </a>
          <div className="nav-actions">
            <LanguageSwitcher currentLocale={siteLocale} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <ImageGenerator locale={siteLocale} />
      <footer className="site-footer">
        <p>{SITE_NAME} · {copy.footer}</p>
      </footer>
    </div>
  );
}
