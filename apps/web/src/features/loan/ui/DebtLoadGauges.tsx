'use client';

import { loan as t } from '@/copy';
import { cx, EstimateTag, formatRate } from '@/ui-kit';
import { useId, type CSSProperties } from 'react';
import type { DebtLoadGaugeVM, LoanLabVM } from '../model/types';

/** Position on the bar (0–100%) for a load; Infinity pins to the end, NaN to the start. */
function pct(value: number, max: number): number {
  if (Number.isNaN(value) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

const ZONE_WORD = { green: 'low', yellow: 'medium', red: 'high' } as const;
const ZONE_TEXT = { green: 'text-positive', yellow: 'text-warning', red: 'text-primary' } as const;

/** One reading on the bar: a round marker that is also the meter for screen readers. */
function Marker({ label, gauge, max, hollow }: { label: string; gauge: DebtLoadGaugeVM; max: number; hollow?: boolean }) {
  const zone = ZONE_WORD[gauge.zone];
  const now = Number.isFinite(gauge.value) ? Math.min(max, Math.max(0, gauge.value)) : Number.isNaN(gauge.value) ? 0 : max;
  const style: CSSProperties = { left: `${pct(gauge.value, max)}%` };
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={`${formatRate(gauge.value)}, ${t.gauge.zones[zone]}`}
      style={style}
      className={cx(
        'absolute top-1/2 size-xl -translate-x-1/2 -translate-y-1/2 rounded-full border-4 transition-[left] duration-500',
        hollow ? 'border-on-primary bg-ink' : 'border-ink bg-on-primary',
      )}
    />
  );
}

/** Debt load today → with the selected offer, on one green / yellow / red bar in a black score bar (Figma S12). */
export function DebtLoadGauges({ gauge, selectedName }: { gauge: LoanLabVM['gauge']; selectedName: string | null }) {
  const headingId = useId();
  const { before, after, max, isEstimate } = gauge;
  const showAfter = after !== null && selectedName !== null;
  const { yellow, red } = before.thresholds;
  const segments = [
    { key: 'green', from: 0, to: pct(yellow, max), color: 'bg-positive', label: t.gauge.zones.low },
    { key: 'yellow', from: pct(yellow, max), to: pct(red, max), color: 'bg-warning', label: t.gauge.zones.medium },
    { key: 'red', from: pct(red, max), to: 100, color: 'bg-primary', label: t.gauge.risky(t.gauge.zones.high, formatRate(red)) },
  ] as const;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-lg rounded-xl bg-ink px-xl py-xl text-on-primary sm:px-2xl">
      <div className="grid grid-cols-1 items-center gap-xl lg:grid-cols-[2fr_3fr]">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 id={headingId} className="flex items-center gap-sm text-sm font-semibold text-on-primary/60">
            {t.gauge.title}
            {isEstimate && <EstimateTag className="border-on-primary/60 text-on-primary/60" />}
          </h2>
          <p className="font-display text-4xl font-extrabold leading-tight tabular-nums sm:text-display sm:leading-display">
            <span className={ZONE_TEXT[before.zone]}>{formatRate(before.value)}</span>
            {showAfter && (
              <>
                {' '}
                <span aria-hidden="true" className="text-on-primary/60">
                  {t.gauge.arrow}
                </span>{' '}
                <span className={ZONE_TEXT[after.zone]}>{formatRate(after.value)}</span>
              </>
            )}
          </p>
          <p className="text-sm text-on-primary/60">{showAfter ? t.gauge.caption(selectedName) : t.gauge.captionToday}</p>
          {!showAfter && <p className="text-sm text-on-primary/80">{t.gauge.noOffer}</p>}
        </div>

        <div className="flex min-w-0 flex-col gap-sm">
          <div className="relative py-sm">
            <div aria-hidden="true" className="flex h-md gap-xs">
              {segments
                .filter((s) => s.to > s.from)
                .map((s) => (
                  <div key={s.key} style={{ width: `${s.to - s.from}%` }} className={cx('h-full rounded-full', s.color)} />
                ))}
            </div>
            <Marker label={t.gauge.before} gauge={before} max={max} hollow />
            {showAfter && <Marker label={t.gauge.after(selectedName)} gauge={after} max={max} />}
          </div>
          <div aria-hidden="true" className="flex justify-between gap-sm text-sm font-semibold">
            <span className="text-positive">{segments[0].label}</span>
            <span className="text-warning">{segments[1].label}</span>
            <span className="text-primary">{segments[2].label}</span>
          </div>
          <div className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-on-primary/80">
            <span className="flex items-center gap-xs">
              <span aria-hidden="true" className="size-md rounded-full border-2 border-on-primary bg-ink" />
              {t.gauge.before}
            </span>
            {showAfter && (
              <span className="flex items-center gap-xs">
                <span aria-hidden="true" className="size-md rounded-full border-2 border-ink bg-on-primary" />
                {t.gauge.after(selectedName)}
              </span>
            )}
          </div>
        </div>
      </div>
      <details className="text-xs text-on-primary/60">
        <summary className="cursor-pointer font-medium">{t.gauge.howTitle}</summary>
        <p className="mt-xs">
          {t.gauge.hint} {t.gauge.guidance(formatRate(yellow), formatRate(red))}
        </p>
      </details>
    </section>
  );
}
