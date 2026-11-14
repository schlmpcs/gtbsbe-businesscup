'use client';

// The mixed-profile warning on /future and /afford (JF1): the pay is the person's own but the spending
// is still a sample family's. One tap scales the sample categories to their S5 guess; or set the
// spending for real. Its own block so the forecast and afford screens stay untouched.
import Link from 'next/link';
import { ladder } from '@/copy';
import { useMixedProfile } from '@/features/ladder/model/useMixedProfile';
import { Button, formatMoney } from '@/ui-kit';

const t = ladder.mixedProfile;

export function MixedProfileNotice() {
  const vm = useMixedProfile();
  if (!vm) return null;
  return (
    <div className="mx-auto w-full max-w-(--container-7xl) px-lg pt-md">
      <div
        role="status"
        data-testid="mixed-profile"
        className="flex flex-wrap items-center justify-center gap-x-md gap-y-sm rounded-xl bg-surface-strong px-lg py-sm text-center text-sm"
      >
        <span>
          {t.text}
          {vm.guess !== null && ` ${t.guess(formatMoney(vm.guess))}`}
        </span>
        {vm.useGuess && (
          <Button size="sm" onClick={vm.useGuess}>
            {t.useGuess}
          </Button>
        )}
        <Link href={vm.spendingHref} className="font-semibold text-primary underline-offset-4 hover:underline">
          {t.setSpending}
        </Link>
      </div>
    </div>
  );
}
