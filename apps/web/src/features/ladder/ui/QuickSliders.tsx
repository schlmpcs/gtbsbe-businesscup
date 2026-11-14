// S7 Quick sliders (Design v3, Figma 202:2004): one slider per spending category (a colored dot, the
// label, an estimate tag, the value on the right) plus the retirement share in a white card on the
// left; free text can fill the sliders after the user confirms. On the right an ink card: the S5
// guess struck through, "Your month: $Y" in orange and how far off the guess was, with take-home
// and what's left over; then the house under construction.
import { common, ladder } from '@/copy';
import { Art, cx, EstimateTag, formatMoney, formatRate, Slider, Sticker } from '@/ui-kit';
import type { LadderProgressVM, QuickSlidersVM } from '../model/types';
import { DescribeLife } from './DescribeLife';
import { LadderShell } from './LadderShell';

const t = ladder.sliders;

/** Dot colors by slider position (decorative). */
const COLORS = ['bg-chart-1', 'bg-chart-3', 'bg-chart-2', 'bg-chart-4', 'bg-chart-6', 'bg-chart-5', 'bg-text-muted'] as const;

export type QuickSlidersProps = { vm: QuickSlidersVM; progress: LadderProgressVM };

export function QuickSliders({ vm, progress }: QuickSlidersProps) {
  const { month, savings, guessGap, selfGuess } = vm;
  const short = month.surplus < 0;

  const summary = (
    <section
      aria-label={t.monthTitle}
      className="relative flex flex-col gap-md rounded-xl bg-ink p-xl text-on-primary shadow-md"
    >
      {selfGuess !== null && (
        <p className="text-lg text-on-primary/60 line-through tabular-nums">{t.youGuessed(formatMoney(selfGuess))}</p>
      )}
      <p className="flex flex-wrap items-baseline gap-x-sm font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
        <span>{t.yourMonth}</span>
        <span data-testid="month-cost" className="tabular-nums">
          {formatMoney(vm.monthlyCost)}
        </span>
      </p>
      {guessGap !== null && Math.abs(guessGap) >= 1 && (
        <Sticker tone="white" tilt={2} className="text-sm">
          {guessGap > 0 ? t.moreThanGuessed(formatMoney(guessGap)) : t.lessThanGuessed(formatMoney(-guessGap))}
        </Sticker>
      )}
      <dl className="mt-sm grid grid-cols-3 gap-md border-t border-on-primary/20 pt-md text-sm">
        <div className="flex flex-col">
          <dt className="flex flex-wrap items-center gap-xs text-on-primary/60">
            {t.takeHome}
            {month.takeHome.isEstimate && <EstimateTag className="bg-surface" />}
          </dt>
          <dd className="text-lg font-bold tabular-nums">{formatMoney(month.takeHome.value)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-on-primary/60">{t.debtPayments}</dt>
          <dd className="text-lg font-bold tabular-nums">{formatMoney(month.debtPayments)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-on-primary/60">{short ? t.shortfall : t.surplus}</dt>
          <dd className={cx('text-lg font-bold tabular-nums', short ? 'text-negative' : 'text-positive')}>
            {formatMoney(month.surplus)}
          </dd>
        </div>
      </dl>
    </section>
  );

  return (
    <LadderShell
      screen="S7"
      progress={progress}
      loading={vm.status === 'loading'}
      aside={
        <>
          {summary}
          <Art name="house-crane" className="mx-auto hidden w-full max-w-(--container-md) lg:block" />
        </>
      }
    >
      <div id="sliders" className="rounded-xl bg-surface p-xl shadow-md">
        <h2 className="sr-only">{t.slidersTitle}</h2>
        <ul aria-label={t.slidersLabel} className="flex flex-col gap-lg">
          {vm.sliders.map((s, i) => (
            <li key={s.category}>
              <Slider
                label={
                  <span className="inline-flex items-center gap-sm text-base font-semibold">
                    <span aria-hidden="true" className={cx('size-sm shrink-0 rounded-full', COLORS[i % COLORS.length])} />
                    {common.categories[s.category]}
                  </span>
                }
                value={s.value}
                min={s.min}
                max={s.max}
                step={s.step}
                isEstimate={s.isEstimate}
                hideBounds
                formatValue={(v) => formatMoney(v)}
                onValueChange={(v) => vm.setSpending(s.category, v)}
                className="[&_output]:font-display [&_output]:text-xl [&_output]:font-extrabold"
              />
            </li>
          ))}
          <li className="border-t border-border pt-lg">
            <Slider
              label={<span className="text-base font-semibold">{t.savingsLabel}</span>}
              value={savings.value}
              min={savings.min}
              max={savings.max}
              step={savings.step}
              isEstimate={savings.isEstimate}
              hideBounds
              formatValue={(v) => formatRate(v, 0)}
              onValueChange={vm.setSavingsShare}
              className="[&_output]:font-display [&_output]:text-xl [&_output]:font-extrabold"
            />
          </li>
        </ul>
      </div>
      <DescribeLife parse={vm.parse} rows={vm.parsedRows} />
    </LadderShell>
  );
}
