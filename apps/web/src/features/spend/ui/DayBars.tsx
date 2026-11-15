// The month day by day: one bar per day (HTML, so it stays crisp at 390px), today outlined, days after
// today empty, a dashed line at the usual pace per day. Bars grow up on first paint (CSS only; reduced
// motion shows them at once). Presentational: every number arrives in the props.
import { spend as t } from '@/copy';
import { cx, formatMoney, formatMonth } from '@/ui-kit';
import type { SpendChartDayVM } from '../model/types';

export type DayBarsProps = {
  days: readonly SpendChartDayVM[];
  /** The chart's top (the tallest bar or the pace, whichever is higher). */
  max: number;
  pacePerDay: number;
  month: string;
  spent: number;
};

const GROW = 'origin-bottom transition-transform duration-700 ease-out starting:scale-y-0 motion-reduce:transition-none';
const pct = (v: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0);

export function DayBars({ days, max, pacePerDay, month, spent }: DayBarsProps) {
  const pace = formatMoney(pacePerDay);
  const ticks = new Set([1, 8, 15, 22, days.length]);
  const paceAt = pct(pacePerDay, max);
  const today = days.find((d) => d.isToday)?.day ?? 0;
  return (
    <figure className="m-0 flex flex-col gap-md" data-testid="spend-chart">
      <div
        role="img"
        aria-label={t.chart.aria(formatMonth(month), formatMoney(spent), pace)}
        className="relative h-44 sm:h-52"
      >
        {/* top value */}
        <span className="absolute left-0 top-0 text-xs tabular-nums text-text-muted">{formatMoney(max, { compact: true })}</span>
        <div className="absolute inset-x-0 bottom-0 top-5 flex items-end gap-[2px] border-b border-border sm:gap-1">
          {days.map((d) => (
            <div key={d.day} className="relative flex h-full min-w-0 flex-1 items-end" title={t.chart.bar(formatMonth(month, d.day), formatMoney(d.total))}>
              {d.isFuture ? (
                <div className="h-1 w-full rounded-full bg-surface-strong" />
              ) : (
                <div
                  className={cx(
                    'w-full rounded-t-sm',
                    GROW,
                    d.total === 0 ? 'h-1 rounded-full bg-surface-strong' : d.overPace ? 'bg-primary' : 'bg-chart-1',
                    d.isToday && 'outline-2 outline-offset-1 outline-ink',
                  )}
                  style={d.total > 0 ? { height: `${Math.max(2, pct(d.total, max))}%`, transitionDelay: `${d.day * 12}ms` } : undefined}
                />
              )}
            </div>
          ))}
          {pacePerDay > 0 && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/60" style={{ bottom: `${paceAt}%` }}>
              <span className="absolute -top-6 right-0 rounded-full bg-surface px-sm text-xs font-semibold tabular-nums text-text">{t.chart.pace(pace)}</span>
            </div>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-[2px] text-xs tabular-nums text-text-muted sm:gap-1">
        {days.map((d) => (
          <span key={d.day} className={cx('min-w-0 flex-1 text-center', d.isToday && 'font-bold text-text')}>
            {d.isToday || (ticks.has(d.day) && Math.abs(d.day - today) > 1) ? d.day : ''}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        <span className="inline-flex items-center gap-xs"><span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1" />{t.chart.under}</span>
        <span className="inline-flex items-center gap-xs"><span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />{t.chart.over}</span>
        <span className="inline-flex items-center gap-xs"><span aria-hidden="true" className="size-2.5 rounded-sm outline-2 outline-ink" />{t.chart.today}</span>
      </figcaption>
    </figure>
  );
}
