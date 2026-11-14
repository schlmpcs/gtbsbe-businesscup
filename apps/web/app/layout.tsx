import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { common } from '@/copy';
import '@fontsource-variable/dm-sans';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import './globals.css';

export const metadata: Metadata = {
  title: common.appName,
  description: common.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-text antialiased">
        {children}
        <footer className="mx-auto w-full max-w-(--container-2xl) px-lg pb-xl text-xs text-text-muted">{common.disclaimer}</footer>
      </body>
    </html>
  );
}
