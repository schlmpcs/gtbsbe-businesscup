'use client';

// S12 Loan Lab, "Which loan costs less?". The offers (inputs, editable on their cards), the answer card (the
// cheapest offer in dollars and the stacked total-cost bars), then for the selected offer: paying it off
// faster (balance line + extra slider), whether the month can carry it (left over + debt load), what it does
// to the plan ("Add to my plan"), and, behind disclosures, the debt payoff planner and the sentence box.
// All numbers come from useLoanLab(), usePayoffPlanner() and useLoanPlan() (engine); nothing is computed here.
import { loan as t } from '@/copy';
import { cx, formatMoney, Money } from '@/ui-kit';
import { MOTION } from '@/ui-kit/reports';
import { ToolPlanImpact } from '@/ui-kit/ToolPlanImpact';
import type { ReactNode } from 'react';
import type { LinkComponent, LoanLabVM, PayoffPlannerVM, ToolPlanEventVM } from '../model/types';
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

const PlainLink: LinkComponent = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/** A secondary section, closed by default (JF16). */
function Disclosure({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <details className="group card card-pad" data-testid={testId}>
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md text-lg font-bold"
        data-testid={testId && `${testId}-summary`}
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-lg">{children}</div>
    </details>
  );
}

/** JF14: "left over each month after this loan" (engine numbers, formatted here). */
function LeftOver({ leftOver, selectedName }: { leftOver: LoanLabVM['leftOver']; selectedName: string | null }) {
  if (!leftOver) return null;
  const l = t.leftOver;
  const withLoan = leftOver.after !== null && selectedName !== null;
  const shown = withLoan ? leftOver.after! : leftOver.before;
  return (
    <section aria-label={l.title} data-testid="loan-left-over" className="flex flex-col gap-xs">
      <h3 className="text-sm font-medium text-text-muted">{l.title}</h3>
      <p className={cx('font-display text-3xl font-extrabold leading-tight tabular-nums', shown < 0 ? 'text-negative' : 'text-positive')}>
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
 * `plan` is the selected offer measured on /plan (useLoanPlan); null hides that card.
 * `Link` (next/link in the app) points at the balance sheet and at /plan.
 */
export function LoanLabScreen({
  vm,
  payoff = null,
  plan = null,
  Link = PlainLink,
}: {
  vm: LoanLabVM;
  payoff?: PayoffPlannerVM | null;
  plan?: ToolPlanEventVM | null;
  Link?: LinkComponent;
}) {
  const selectedIndex = vm.offers.findIndex((o) => o.id === vm.selectedOfferId);
  const selectedName = selectedIndex >= 0 ? t.offerName(selectedIndex + 1) : null;
  const selectedValid = selectedIndex >= 0 && vm.offers[selectedIndex]!.result !== null;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <header className="flex flex-col gap-xs">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t.eyebrow}</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t.screens.S12}</h1>
        <p className="max-w-prose text-base text-text-muted sm:text-lg">{t.intro}</p>
      </header>

      <div className="mt-xl">
        {vm.status === 'loading' ? (
          <Loading />
        ) : (
          <div className="flex flex-col gap-xl">
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
            {vm.offers.length > 0 && <LoanVerdict offers={vm.offers} best={vm.best} costScale={vm.costScale} />}
            <div className={cx('grid grid-cols-1 items-start gap-xl lg:grid-cols-2', MOTION.rise)}>
              <ExtraPayment extra={vm.extra} setExtraPayment={vm.setExtraPayment} selectedName={selectedName} balanceChart={vm.balanceChart} />
              <section aria-labelledby="loan-load-title" className="card card-pad flex min-w-0 flex-col gap-xl">
                <h2 id="loan-load-title" className="text-lg font-bold leading-tight">
                  {t.sections.load}
                </h2>
                <LeftOver leftOver={vm.leftOver} selectedName={selectedName} />
                <DebtLoadGauges gauge={vm.gauge} selectedName={selectedName} />
              </section>
            </div>
            {plan && selectedValid && selectedName && (
              <ToolPlanImpact
                scenarioName={plan.scenarioName}
                preview={plan.preview}
                add={plan.add}
                added={plan.added}
                planHref={plan.planHref}
                what={t.plan.what(selectedName)}
                Link={Link}
              />
            )}
            <div className="flex flex-col gap-md">
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
            </div>
            <p className="text-xs text-text-muted">{t.footnote}</p>
          </div>
        )}
      </div>
    </main>
  );
}
