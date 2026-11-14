'use client';

import { loan as t } from '@/copy';
import { formatMoney } from '@/ui-kit';
import type { LoanLabVM, LoanOfferVM } from '../model/types';

/**
 * The ink band under the offers (Figma S12): the bottom line in plain words. It only names the offers the
 * view-model flagged (isLowestCost / isLowestMonthly) with the engine's totals; it computes nothing.
 */
export function LoanVerdict({ offers }: Pick<LoanLabVM, 'offers'>) {
  const name = (o: LoanOfferVM) => t.offerName(offers.indexOf(o) + 1);
  const cheapest = offers.filter((o) => o.isLowestCost && o.result);
  const lowestMonthly = offers.filter((o) => o.isLowestMonthly && o.result);
  const names = (list: LoanOfferVM[]) => list.map(name).join(t.verdict.and);
  const same =
    cheapest.length > 0 && cheapest.length === lowestMonthly.length && cheapest.every((o) => lowestMonthly.includes(o));

  let headline: string = t.verdict.none;
  let detail: string | null = null;
  if (cheapest.length > 0) {
    const first = cheapest[0]!.result!;
    headline = same
      ? t.verdict.lowestBoth(names(cheapest), formatMoney(first.totalCost), formatMoney(first.monthly))
      : t.verdict.lowestCost(names(cheapest), formatMoney(first.totalCost));
    if (!same && lowestMonthly.length > 0) {
      detail = t.verdict.lowestMonthly(names(lowestMonthly), formatMoney(lowestMonthly[0]!.result!.monthly));
    }
  }

  return (
    <section
      aria-label={t.verdict.label}
      data-testid="loan-verdict"
      className="flex flex-col gap-xs rounded-xl bg-ink px-xl py-xl text-on-primary sm:px-2xl"
    >
      <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{headline}</p>
      {detail && <p className="text-base text-on-primary/80">{detail}</p>}
      {cheapest.length > 0 && <p className="text-sm text-on-primary/60">{t.compare.totalCostHint}</p>}
    </section>
  );
}
