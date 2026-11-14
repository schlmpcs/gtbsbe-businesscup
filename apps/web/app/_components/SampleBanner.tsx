'use client';

// The sample notice (src/state/sample.ts): on every screen that shows a profile's numbers while those
// numbers are the sample household's, never on screens without personal numbers (the game, Pro, the
// What if? hub, onboarding). "Use mine" leaves the sample and starts onboarding (S5, /me/guess).
// The root layout renders it by route; Home renders its own (`show`), since a first visit has no numbers.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { common } from '@/copy';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useSampleBanner } from '@/state';

const t = common.sampleBanner;

export function SampleBanner({ show }: { show?: boolean }) {
  const pathname = usePathname() ?? '/';
  const { active, requested, clear } = useSampleBanner(show === undefined ? pathname : { show });
  if (!active) return null;
  return (
    <div className="mx-auto w-full max-w-(--container-7xl) px-lg pt-md">
      <p
        role="status"
        data-testid="sample-banner"
        className="flex flex-wrap items-center justify-center gap-x-md gap-y-xs rounded-xl bg-primary-soft px-lg py-sm text-center text-sm font-semibold"
      >
        <span>{requested ? t.text : t.textDefault}</span>
        <Link
          href={SCREEN_ROUTES.S5}
          onClick={clear}
          className="inline-flex min-h-11 items-center gap-xs font-bold text-primary underline-offset-4 hover:underline"
        >
          {t.cta} <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
