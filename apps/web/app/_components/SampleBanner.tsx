'use client';

// The sample-life banner (docs/design/USER-JOURNEY.md → Global UI): on every screen while the
// sample profile from "Try with sample data" is on. "Use mine" leaves the sample and starts S5.
import Link from 'next/link';
import { common } from '@/copy';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useSampleBanner } from '@/state';

const t = common.sampleBanner;

export function SampleBanner() {
  const { active, clear } = useSampleBanner();
  if (!active) return null;
  return (
    <div className="mx-auto w-full max-w-(--container-7xl) px-lg pt-md">
      <p
        role="status"
        data-testid="sample-banner"
        className="flex flex-wrap items-center justify-center gap-x-md gap-y-xs rounded-xl bg-surface-strong px-lg py-sm text-center text-sm"
      >
        <span>{t.text}</span>
        <Link href={SCREEN_ROUTES.S5} onClick={clear} className="font-semibold text-primary underline-offset-4 hover:underline">
          {t.cta} <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
