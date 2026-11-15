'use client';

// The sample notice (src/state/sample.ts): a slim strip at the top of the content on every screen that
// shows a profile's numbers while those numbers are the sample household's, never on screens without
// personal numbers (the game, Pro, the What if? hub, onboarding). "Use my numbers" leaves the sample
// and starts onboarding. The root layout renders it by route (through the shell, which hides it on the
// landing and the onboarding story); a page that knows better passes `show`.
// With the person's own transactions in the ledger but a sample profile, it says the plan is the part
// still on sample numbers, and it leaves /transactions (see useSampleBanner).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { common } from '@/copy';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { useSampleBanner } from '@/state';

const t = common.sampleBanner;

/** Where "Use my numbers" starts onboarding. */
const ONBOARDING_START = '/start?ch=2'; // the story's own-month chapter (features/onboarding)

export function SampleBanner({ show }: { show?: boolean }) {
  const pathname = usePathname() ?? '/';
  const where = show === undefined ? pathname : { show };
  const { active } = useSampleBanner(where);
  // The ledger is read only when the notice could show at all (it loads IndexedDB).
  return active ? <SampleStrip where={where} /> : null;
}

function SampleStrip({ where }: { where: string | { show: boolean } }) {
  const { lines, ready } = useLedger();
  const { active, requested, ownLedger, clear } = useSampleBanner(where, { ownLedger: lines.length > 0 });
  if (!ready || !active) return null;
  const text = ownLedger ? t.textLedger : requested ? t.text : t.textDefault;
  return (
    <div className="mx-auto w-full max-w-(--container-7xl) px-lg pt-md">
      <p
        role="status"
        data-testid="sample-banner"
        className="animate-enter flex min-h-11 flex-wrap items-center justify-between gap-x-md gap-y-xs rounded-(--card-radius) border border-border bg-surface px-md text-sm text-text-muted"
      >
        <span className="flex items-center gap-sm">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warning" />
          {text}
        </span>
        <Link
          href={ONBOARDING_START}
          onClick={clear}
          className="inline-flex min-h-11 items-center gap-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t.cta} <span aria-hidden="true">→</span>
        </Link>
      </p>
    </div>
  );
}
