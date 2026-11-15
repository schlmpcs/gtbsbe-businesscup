'use client';

// The answer card under the offers: "Offer A costs $1,134 less than Offer B", the lowest monthly payment when
// another offer has it, and the stacked total-cost bars. It names what the view-model found (best, the
// isLowest flags) with the engine's totals; it computes nothing.
import { loan as t } from '@/copy';
import { formatMoney } from '@/ui-kit';
import type { LoanLabVM, LoanOfferVM } from '../model/types';
import { CostRace } from './CostRace';

export function LoanVerdict({ offers, best, costScale }: Pick<LoanLabVM, 'offers' | 'best' | 'costScale'>) {
  const name = (o: LoanOfferVM) => t.offerName(offers.indexOf(o) + 1);
  const lowestMonthly = offers.filter((o) => o.isLowestMonthly && o.result);
  const bestOffer = best ? offers.find((o) => o.id === best.id) ?? null : null;
  const valid = offers.filter((o) => o.result).length;

  let headline: string = valid === 1 ? t.verdict.one : t.verdict.none;
  if (best?.runnerUp) {
    const a = t.offerName(best.index);
    const b = t.offerName(best.runnerUp.index);
    headline = best.runnerUp.costsMore < 1 ? t.verdict.tie(a, b) : t.verdict.saves(a, b, formatMoney(best.runnerUp.costsMore));
  }
  const monthlyElsewhere = bestOffer && lowestMonthly.length > 0 && !lowestMonthly.includes(bestOffer);

  return (
    <section aria-label={t.verdict.label} data-testid="loan-verdict" className="card card-pad flex min-w-0 flex-col gap-lg" aria-live="polite">
      <div className="flex flex-col gap-sm">
        {bestOffer && (
          <span className="w-fit rounded-full bg-positive px-md py-xs text-sm font-bold text-on-primary">{t.verdict.pill(name(bestOffer))}</span>
        )}
        <p data-testid="loan-verdict-headline" className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {headline}
        </p>
        {bestOffer?.result && <p className="text-base text-text-muted">{t.verdict.total(name(bestOffer), formatMoney(bestOffer.result.totalCost))} {t.compare.totalCostHint}</p>}
        {monthlyElsewhere && (
          <p className="text-base font-semibold">{t.verdict.lowestMonthly(lowestMonthly.map(name).join(t.verdict.and), formatMoney(lowestMonthly[0]!.result!.monthly))}</p>
        )}
      </div>
      <CostRace offers={offers} costScale={costScale} bestId={best?.id ?? null} />
    </section>
  );
}
