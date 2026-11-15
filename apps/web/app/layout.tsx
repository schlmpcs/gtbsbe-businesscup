import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { common } from '@/copy';
import '@fontsource-variable/dm-sans';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import './globals.css';
import { SampleBanner } from './_components/SampleBanner';
import { Shell } from './_components/Shell';

export const metadata: Metadata = {
  title: common.appName,
  description: common.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The phone's bottom tabs pad themselves by env(safe-area-inset-bottom), which needs `cover`.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-text antialiased">
        <Shell
          banner={<SampleBanner />}
          footer={
            <footer className="mx-auto w-full max-w-(--container-2xl) px-lg pb-xl text-xs text-text-muted">{common.disclaimer}</footer>
          }
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
