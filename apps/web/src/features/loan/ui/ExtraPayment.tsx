'use client';

import { loan as t } from '@/copy';
import { Card, cx, formatMoney, Money, Slider } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';

/** Extra-payment slider on the selected offer: payoff month and total interest update as it moves. */
export function ExtraPayment({
  extra,
  setExtraPayment,
  selectedName,
}: Pick<LoanLabVM, 'extra' | 'setExtraPayment'> & { selectedName: string | null }) {
  if (!extra || !selectedName) {
    return (
      <Card title={t.extra.title}>
        <p className="text-sm text-text-muted">{t.extra.noOffer}</p>
      </Card>
    );
  }

  const changed = extra.value > 0;
  const saved = changed && extra.interestSaved > 0;
  const sooner = extra.payoffMonth !== null && extra.monthsSaved !== null && extra.monthsSaved > 0;

  return (
    <Card
      title={t.extra.title}
      headingLevel={2}
      className="flex flex-col gap-lg"
    >
      <Slider
        label={t.extra.slider(selectedName)}
        value={extra.value}
        min={extra.min}
        max={extra.max}
        step={extra.step}
        onValueChange={setExtraPayment}
        formatValue={(v) => `${formatMoney(v)}${t.extra.perMonth}`}
      />
      <div aria-live="polite" data-testid="extra-result" className="flex flex-col gap-md">
        {(saved || sooner) && (
          <p className="flex flex-wrap gap-x-sm text-lg font-semibold text-positive">
            {saved && <span>{t.extra.interestSaved(formatMoney(extra.interestSaved))}</span>}
            {saved && sooner && <span aria-hidden="true">·</span>}
            {sooner && <span>{t.extra.monthsSaved(extra.monthsSaved!)}</span>}
          </p>
        )}
        {extra.payoffMonth === null && changed && <p className="text-sm font-semibold text-negative">{t.extra.neverEvenWithExtra}</p>}
        {!changed && extra.payoffMonth !== null && <p className="text-sm text-text-muted">{t.extra.noChange}</p>}
        <dl className="grid grid-cols-2 gap-lg">
          <div className="flex flex-col gap-xs">
            <dt className="text-sm text-text-muted">{t.extra.payoff}</dt>
            <dd
              className={cx(
                'font-display text-3xl font-extrabold tabular-nums',
                extra.payoffMonth === null ? 'text-negative' : changed ? 'text-positive' : 'text-text',
              )}
            >
              <span data-testid="extra-payoff">
                {extra.payoffMonth === null ? t.extra.never : t.extra.payoffMonths(extra.payoffMonth)}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-xs">
            <dt className="text-sm text-text-muted">{t.extra.interest}</dt>
            <dd className={cx('font-display text-3xl font-extrabold tabular-nums', saved ? 'text-positive' : 'text-text')}>
              <Money value={extra.totalInterest} />
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
