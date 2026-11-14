// S7 Quick sliders (Figma S07): one slider per spending category plus the retirement share in a white
// tile on the left; "Your month" on the right with a huge total, a stacked color bar, a compact
// legend and take-home / left over, updating live. Free text can fill the sliders after the user confirms.
import { common, ladder } from '@/copy';
import { Card, cx, EstimateTag, formatMoney, formatRate, Slider, Stack, Sticker } from '@/ui-kit';
import type { LadderProgressVM, QuickSlidersVM } from '../model/types';
import { DescribeLife } from './DescribeLife';
import { LadderShell } from './LadderShell';

const t = ladder.sliders;

/** Segment colors of the stacked bar, by position (sliders in order, then debt payments). */
const COLORS = [
  'bg-chart-1', 'bg-chart-3', 'bg-chart-2', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6', 'bg-text-muted', 'bg-ink',
] as const;

export type QuickSlidersProps = { vm: QuickSlidersVM; progress: LadderProgressVM };

export function QuickSliders({ vm, progress }: QuickSlidersProps) {
  const { month, savings, guessGap } = vm;
  const short = month.surplus < 0;
  const rows = [
    ...vm.sliders.map((s) => ({ id: s.category, label: common.categories[s.category], amount: s.value, isEstimate: s.isEstimate })),
    { id: 'debtPayments', label: t.debtPayments, amount: month.debtPayments, isEstimate: false },
  ].map((r, i) => ({ ...r, color: COLORS[i % COLORS.length]! }));
  const barTotal = rows.reduce((sum, r) => sum + Math.max(0, r.amount), 0); // bar geometry only

  return (
    <LadderShell screen="S7" progress={progress} loading={vm.status === 'loading'}>
      <div className="grid items-start gap-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Stack gap="xl">
          <Card title={t.slidersTitle} id="sliders">
            <Stack gap="xl" as="ul" aria-label={t.slidersLabel}>
              {vm.sliders.map((s) => (
                <li key={s.category}>
                  <Slider
                    label={common.categories[s.category]}
                    value={s.value}
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    isEstimate={s.isEstimate}
                    hideBounds
                    formatValue={(v) => formatMoney(v)}
                    onValueChange={(v) => vm.setSpending(s.category, v)}
                  />
                </li>
              ))}
              <li>
                <Slider
                  label={t.savingsLabel}
                  value={savings.value}
                  min={savings.min}
                  max={savings.max}
                  step={savings.step}
                  isEstimate={savings.isEstimate}
                  hideBounds
                  formatValue={(v) => formatRate(v, 0)}
                  onValueChange={vm.setSavingsShare}
                />
              </li>
            </Stack>
          </Card>
          <DescribeLife parse={vm.parse} rows={vm.parsedRows} />
        </Stack>

        <div className="pt-lg lg:sticky lg:top-xl">
          <Card title={t.monthTitle} className="relative" style={{ transform: 'rotate(1deg)' }}>
            {guessGap !== null && Math.abs(guessGap) >= 1 && (
              <Sticker tilt={3} className="absolute -top-lg left-lg text-sm">
                {guessGap > 0 ? t.moreThanGuessed(formatMoney(guessGap)) : t.lessThanGuessed(formatMoney(-guessGap))}
              </Sticker>
            )}
            <Stack gap="lg">
              <p className="font-display text-display font-extrabold leading-display tabular-nums" data-testid="month-cost">
                {formatMoney(vm.monthlyCost)}
              </p>

              <div aria-hidden="true" className="flex h-md w-full gap-xs">
                {barTotal > 0 &&
                  rows
                    .filter((r) => r.amount > 0)
                    .map((r) => (
                      <span
                        key={r.id}
                        className={cx('h-full rounded-full transition-[width] duration-500', r.color)}
                        style={{ width: `${(r.amount / barTotal) * 100}%` }}
                      />
                    ))}
              </div>
              <ul aria-label={t.breakdownLabel} className="flex flex-col gap-xs text-sm">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-md">
                    <span className="flex min-w-0 flex-wrap items-center gap-sm">
                      <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', r.color)} />
                      {r.label}
                      {r.isEstimate && <EstimateTag />}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                  </li>
                ))}
              </ul>

              <dl className="grid grid-cols-2 gap-md border-t border-border pt-md text-sm">
                <div className="flex flex-col">
                  <dt className="flex flex-wrap items-center gap-sm text-text-muted">
                    {t.takeHome}
                    {month.takeHome.isEstimate && <EstimateTag />}
                  </dt>
                  <dd className="text-xl font-bold tabular-nums">{formatMoney(month.takeHome.value)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-muted">{short ? t.shortfall : t.surplus}</dt>
                  <dd className={cx('text-xl font-bold tabular-nums', short ? 'text-negative' : 'text-positive')}>
                    {formatMoney(month.surplus)}
                  </dd>
                </div>
              </dl>
            </Stack>
          </Card>
        </div>
      </div>
    </LadderShell>
  );
}
