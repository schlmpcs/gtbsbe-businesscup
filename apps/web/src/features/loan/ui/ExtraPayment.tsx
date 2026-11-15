'use client';

import { loan as t } from '@/copy';
import { cx, formatMoney, Money, Slider } from '@/ui-kit';
import { ToolLineChart } from '@/ui-kit/ToolLineChart';
import type { LoanLabVM } from '../model/types';

/** Year ticks for a span of `months` (about 4–6 labels). */
function yearTicks(months: number): number[] {
  const years = Math.max(1, Math.ceil(months / 12));
  const step = years <= 6 ? 1 : years <= 12 ? 2 : 5;
  const ticks: number[] = [];
  for (let y = 0; y <= years; y += step) ticks.push(y * 12);
  return ticks;
}

/** The selected offer's balance over time (amortization), on schedule and with the extra payment. */
function BalanceOverTime({ chart, name, extraValue, summary }: { chart: NonNullable<LoanLabVM['balanceChart']>; name: string; extraValue: number; summary: string }) {
  const end = Math.max(chart.base.at(-1)?.month ?? 0, chart.withExtra?.at(-1)?.month ?? 0);
  return (
    <ToolLineChart
      data-testid="loan-balance-chart"
      title={t.balance.title(name)}
      summary={summary}
      height={200}
      series={[
        { id: 'base', label: t.balance.onSchedule, tone: chart.withExtra ? 'ink' : 'primary', dashed: chart.withExtra !== null, area: !chart.withExtra, points: chart.base.map((p) => ({ x: p.month, y: p.balance })) },
        ...(chart.withExtra
          ? [{ id: 'extra', label: t.balance.withExtra(formatMoney(extraValue)), tone: 'positive' as const, area: true, points: chart.withExtra.map((p) => ({ x: p.month, y: p.balance })) }]
          : []),
      ]}
      xTicks={yearTicks(end)}
      formatX={t.balance.tick}
      formatY={(v) => formatMoney(v, { compact: true })}
    />
  );
}

/** Extra-payment slider on the selected offer: the balance line, payoff month and total interest update as it moves. */
export function ExtraPayment({
  extra,
  setExtraPayment,
  selectedName,
  balanceChart = null,
}: Pick<LoanLabVM, 'extra' | 'setExtraPayment'> & { selectedName: string | null; balanceChart?: LoanLabVM['balanceChart'] }) {
  if (!extra || !selectedName) {
    return (
      <section className="card card-pad">
        <h2 className="text-lg font-bold">{t.extra.title}</h2>
        <p className="text-sm text-text-muted">{t.extra.noOffer}</p>
      </section>
    );
  }
  const months = (n: number | null) => (n === null ? t.extra.never : t.extra.payoffMonths(n));
  const summary =
    extra.value > 0
      ? t.balance.summaryExtra(selectedName, months(extra.basePayoffMonth), months(extra.payoffMonth))
      : t.balance.summary(selectedName, months(extra.basePayoffMonth));

  const changed = extra.value > 0;
  const saved = changed && extra.interestSaved > 0;
  const sooner = extra.payoffMonth !== null && extra.monthsSaved !== null && extra.monthsSaved > 0;

  return (
    <section aria-labelledby="loan-extra-title" data-testid="loan-extra" className="card card-pad flex min-w-0 flex-col gap-lg">
      <h2 id="loan-extra-title" className="text-lg font-bold leading-tight">
        {t.sections.payoff}
      </h2>
      {balanceChart && <BalanceOverTime chart={balanceChart} name={selectedName} extraValue={extra.value} summary={summary} />}
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
                'font-display text-2xl font-extrabold tabular-nums sm:text-3xl',
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
            <dd className={cx('font-display text-2xl font-extrabold tabular-nums sm:text-3xl', saved ? 'text-positive' : 'text-text')}>
              <Money value={extra.totalInterest} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
