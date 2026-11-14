'use client';

// S12 Loan Lab (Figma Design v3, S12). All numbers come from useLoanLab(), which calls the engine's loan /
// compareLoans / payoffOrder (and, for the planner section, comparePayoff). Nothing is computed here.
import { loan as t } from '@/copy';
import { Art, Stack } from '@/ui-kit';
import type { LinkComponent, LoanLabVM, PayoffPlannerVM } from '../model/types';
import { DebtLoadGauges } from './DebtLoadGauges';
import { ExtraPayment } from './ExtraPayment';
import { LoanParse } from './LoanParse';
import { LoanVerdict } from './LoanVerdict';
import { OfferCompare } from './OfferCompare';
import { PayoffOrder } from './PayoffOrder';
import { PayoffPlanner } from './PayoffPlanner';

function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden="true" className="h-3xl animate-pulse rounded-xl bg-surface" />
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-xl bg-surface" />
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-xl bg-surface" />
    </div>
  );
}

/**
 * `payoff` is the debt payoff planner (usePayoffPlanner). While it is null (planner off) the screen has the
 * single-method payoff order card; once supplied, the planner takes that card's place.
 * `Link` (next/link in the app) is what the planner uses to point at the balance sheet.
 */
export function LoanLabScreen({ vm, payoff = null, Link }: { vm: LoanLabVM; payoff?: PayoffPlannerVM | null; Link?: LinkComponent }) {
  const selectedIndex = vm.offers.findIndex((o) => o.id === vm.selectedOfferId);
  const selectedName = selectedIndex >= 0 ? t.offerName(selectedIndex + 1) : null;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <header className="grid grid-cols-1 items-center gap-xl sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-lg">
          <h1 className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display lg:text-[length:calc(var(--text-display)*1.6)]">
            {t.screens.S12}
          </h1>
          <p className="max-w-prose text-lg text-text-muted sm:text-xl">{t.intro}</p>
        </div>
        <Art name="coins" className="mx-auto w-1/2 max-w-(--container-3xs) sm:w-(--container-3xs)" />
      </header>

      <div className="mt-2xl">
        {vm.status === 'loading' ? (
          <Loading />
        ) : (
          <Stack gap="2xl">
            <Stack gap="xl">
              <OfferCompare
                offers={vm.offers}
                selectedOfferId={vm.selectedOfferId}
                selectOffer={vm.selectOffer}
                edit={{
                  updateOffer: vm.updateOffer,
                  removeOffer: vm.removeOffer,
                  addOffer: vm.addOffer,
                  canAddOffer: vm.canAddOffer,
                }}
              />
              {vm.offers.length > 0 && <LoanVerdict offers={vm.offers} />}
              <LoanParse parse={vm.parse} canAddOffer={vm.canAddOffer} />
            </Stack>
            <DebtLoadGauges gauge={vm.gauge} selectedName={selectedName} />
            <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-2">
              <ExtraPayment extra={vm.extra} setExtraPayment={vm.setExtraPayment} selectedName={selectedName} />
              {payoff ? null : <PayoffOrder plan={vm.payoffPlan} selectedName={selectedName} />}
            </div>
            {payoff && <PayoffPlanner vm={payoff} selectedName={selectedName} Link={Link} />}
            <p className="text-xs text-text-muted">{t.footnote}</p>
          </Stack>
        )}
      </div>
    </main>
  );
}
