import { notFound } from 'next/navigation';
import ImageGenerator from '@/components/ImageGenerator';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { isSiteLocale, SITE_NAME, type SiteLocale } from '@/lib/i18n';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) {
    notFound();
  }

  return (
    <div className="app-shell dot-grid-bg">
      <header className="nav-frosted">
        <div className="nav-inner">
          <a className="brand" href={`/${locale}`}>
            <span className="brand-mark">AI</span>
            <span>{SITE_NAME}</span>
          </a>
          <div className="nav-actions">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <ImageGenerator locale={locale as SiteLocale} />
      <footer className="site-footer">
        <p>{SITE_NAME} · Serverless queue image generation</p>
      </footer>
    </div>
  );
}
