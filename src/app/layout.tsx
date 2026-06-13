import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { DEFAULT_LOCALE, SEO_COPY, SITE_NAME, SITE_URL, localeFromPathname, relativeLanguageAlternates } from '@/lib/i18n';

const defaultSeo = SEO_COPY[DEFAULT_LOCALE];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: defaultSeo.title,
  description: defaultSeo.description,
  keywords: defaultSeo.keywords,
  alternates: {
    canonical: '/',
    languages: relativeLanguageAlternates(),
  },
  openGraph: {
    title: defaultSeo.title,
    description: defaultSeo.description,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    images: [{ url: '/logo.svg', alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: defaultSeo.title,
    description: defaultSeo.description,
    images: ['/logo.svg'],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const locale = localeFromPathname(headersList.get('x-pathname'));

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
