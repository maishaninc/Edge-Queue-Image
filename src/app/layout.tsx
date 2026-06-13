import type { Metadata } from 'next';
import './globals.css';
import { SITE_NAME } from '@/lib/i18n';

export const metadata: Metadata = {
  title: SITE_NAME,
  description: 'A Vercel-compatible free image generation queue for OpenAI-compatible image models.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
