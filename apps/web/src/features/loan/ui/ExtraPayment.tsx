'use client';

import { loan as t } from '@/copy';
import { Card, formatMoney, Money, Slider, Stat } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';

/** Extra-payment slider on the selected offer: payoff month and total interest update as it moves. */
export function ExtraPayment({
  extra,
  setExtraPayment,
  selectedName,
}: Pick<LoanLabVM, 'extra' | 'setExtraPayment'> & { selectedName: string | null }) {
  if (!extra || !selectedName) {
    return (
      <Card title={t.extra.title} tone="muted">
        <p className="text-sm text-text-muted">{t.extra.noOffer}</p>
      </Card>
    );
  }

  const changed = extra.value > 0;
  const payoffHint =
    extra.payoffMonth === null
      ? changed
        ? t.extra.neverEvenWithExtra
        : undefined
      : extra.monthsSaved !== null && extra.monthsSaved > 0
        ? t.extra.monthsSaved(extra.monthsSaved)
        : t.extra.noChange;

  return (
    <Card title={t.extra.title}>
      <Slider
        label={t.extra.slider(selectedName)}
        value={extra.value}
        min={extra.min}
        max={extra.max}
        step={extra.step}
        onValueChange={setExtraPayment}
        formatValue={(v) => `${formatMoney(v)}${t.extra.perMonth}`}
      />
      <div aria-live="polite" className="mt-lg grid grid-cols-1 gap-lg sm:grid-cols-2" data-testid="extra-result">
        <Stat
          label={t.extra.payoff}
          value={
            <span data-testid="extra-payoff">
              {extra.payoffMonth === null ? t.extra.never : t.extra.payoffMonths(extra.payoffMonth)}
            </span>
          }
          tone={extra.payoffMonth === null ? 'negative' : changed ? 'positive' : 'default'}
          hint={payoffHint}
        />
        <Stat
          label={t.extra.interest}
          value={<Money value={extra.totalInterest} />}
          tone={changed && extra.interestSaved > 0 ? 'positive' : 'default'}
          hint={changed && extra.interestSaved > 0 ? t.extra.interestSaved(formatMoney(extra.interestSaved)) : undefined}
        />
      </div>
    </Card>
  );
}
