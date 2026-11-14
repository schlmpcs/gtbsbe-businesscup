'use client';

// S12 Loan Lab (Figma Design v3, S12). All numbers come from useLoanLab(), which calls the engine's loan /
// compareLoans / payoffOrder (and, for the planner section, comparePayoff). Nothing is computed here.
// JF14/JF16: one message (offers + what is left over each month), secondary tools behind disclosures.
import { loan as t } from '@/copy';
import { Art, cx, formatMoney, Money, Stack } from '@/ui-kit';
import type { ReactNode } from 'react';
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

/** A secondary section, closed by default (JF16). */
function Disclosure({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl bg-surface p-lg shadow-md" data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-display text-xl font-extrabold">
        <span>{title}</span>
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-md">{children}</div>
    </details>
  );
}

/** JF14: "left over each month after this loan", next to the debt load (engine numbers, formatted here). */
function LeftOver({ leftOver, selectedName }: { leftOver: LoanLabVM['leftOver']; selectedName: string | null }) {
  if (!leftOver) return null;
  const l = t.leftOver;
  const shown = leftOver.after !== null && selectedName !== null ? leftOver.after : leftOver.before;
  const withLoan = leftOver.after !== null && selectedName !== null;
  return (
    <section aria-label={l.title} data-testid="loan-left-over" className="flex flex-col gap-xs rounded-xl bg-surface p-xl shadow-md">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{l.title}</h2>
      <p className={cx('font-display text-5xl font-extrabold leading-display tabular-nums', shown < 0 ? 'text-primary' : 'text-positive')}>
        {shown < 0 ? l.short(formatMoney(-shown)) : <Money value={shown} />}
      </p>
      <p className="text-sm text-text-muted">
        {withLoan ? (
          <>
            {l.after(selectedName)} · {l.vsToday(formatMoney(leftOver.before))}
          </>
        ) : (
          l.today
        )}
      </p>
      {shown < 0 && <p className="text-sm font-semibold">{l.shortNote}</p>}
    </section>
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
            </Stack>
            <div className="grid grid-cols-1 items-stretch gap-xl lg:grid-cols-[2fr_3fr]">
              <LeftOver leftOver={vm.leftOver} selectedName={selectedName} />
              <DebtLoadGauges gauge={vm.gauge} selectedName={selectedName} />
            </div>
            <Stack gap="md">
              <Disclosure title={t.disclosures.extra} testId="extra-disclosure">
                <ExtraPayment extra={vm.extra} setExtraPayment={vm.setExtraPayment} selectedName={selectedName} />
              </Disclosure>
              <Disclosure title={t.disclosures.payoff} testId="payoff-disclosure">
                {payoff ? (
                  <PayoffPlanner vm={payoff} selectedName={selectedName} Link={Link} />
                ) : (
                  <PayoffOrder plan={vm.payoffPlan} selectedName={selectedName} />
                )}
              </Disclosure>
              <Disclosure title={t.disclosures.parse} testId="parse-disclosure">
                <LoanParse parse={vm.parse} canAddOffer={vm.canAddOffer} />
              </Disclosure>
            </Stack>
            <p className="text-xs text-text-muted">{t.footnote}</p>
          </Stack>
        )}
      </div>
    </main>
  );
}
