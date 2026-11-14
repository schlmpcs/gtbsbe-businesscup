// /kit: developer showcase of every ui-kit primitive with sample props. Not linked from the nav;
// reviewers and the e2e smoke test use it. Not indexed by search engines.
import type { Metadata } from 'next';
import { common, kitShowcase } from '@/copy';
import { KitShowcase } from './KitShowcase';

export const metadata: Metadata = {
  title: `${kitShowcase.title} · ${common.appName}`,
  robots: { index: false, follow: false },
};

export default function KitPage() {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="text-2xl font-semibold leading-tight">{kitShowcase.title}</h1>
      <p className="mt-sm text-sm text-text-muted">{kitShowcase.intro}</p>
      <p className="mt-xs mb-xl text-xs text-text-muted">{kitShowcase.sampleNote}</p>
      <KitShowcase />
    </main>
  );
}
