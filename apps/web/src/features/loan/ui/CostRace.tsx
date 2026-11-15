'use client';

// "Where the money goes": one stacked bar per valid offer (price, interest, fees), on one scale (the
// costliest total), growing in from the left. Every amount is the view-model's (engine loan results).
import { loan as t } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import { MOTION, TONE_BG, type ChartTone } from '@/ui-kit/reports';
import type { LoanLabVM } from '../model/types';

const PARTS = [
  { key: 'price', tone: 'c6' },
  { key: 'interest', tone: 'primary' },
  { key: 'fees', tone: 'warning' },
] as const satisfies readonly { key: 'price' | 'interest' | 'fees'; tone: ChartTone }[];

export function CostRace({ offers, costScale, bestId }: Pick<LoanLabVM, 'offers' | 'costScale'> & { bestId: string | null }) {
  const rows = offers.map((o, i) => ({ o, name: t.offerName(i + 1) })).filter((r) => r.o.cost && r.o.result);
  if (rows.length === 0 || costScale <= 0) return null;
  return (
    <div data-testid="loan-cost-race" className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h3 className="text-base font-semibold">{t.cost.title}</h3>
        <p className="text-xs text-text-muted">{t.cost.subtitle}</p>
      </div>
      <ul className="flex flex-col gap-md">
        {rows.map(({ o, name }) => {
          const c = o.cost!;
          const total = o.result!.totalCost;
          const best = o.id === bestId;
          return (
            <li key={o.id} className="flex flex-col gap-xs">
              <span className="sr-only">{t.cost.row(name, formatMoney(total), formatMoney(c.price), formatMoney(c.interest), formatMoney(c.fees))}</span>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-md text-sm">
                <span className={cx('font-semibold', best && 'text-primary')}>{name}</span>
                <span className={cx('font-display text-lg font-extrabold tabular-nums', best && 'text-primary')}>{formatMoney(total)}</span>
              </div>
              <div aria-hidden="true" className="h-4 w-full overflow-hidden rounded-full bg-surface-strong">
                <div className={cx('flex h-full', MOTION.growX)} style={{ width: `${(total / costScale) * 100}%` }}>
                  {PARTS.map((p) => {
                    const v = c[p.key];
                    return v > 0 ? <span key={p.key} className={cx('h-full', TONE_BG[p.tone])} style={{ width: `${(v / total) * 100}%` }} /> : null;
                  })}
                </div>
              </div>
              <div aria-hidden="true" className="flex flex-wrap gap-x-md text-xs text-text-muted tabular-nums">
                <span>
                  {t.cost.parts.interest} {formatMoney(c.interest)}
                </span>
                {c.fees > 0 && (
                  <span>
                    {t.cost.parts.fees} {formatMoney(c.fees)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        {PARTS.map((p) => (
          <span key={p.key} className="flex items-center gap-xs">
            <span className={cx('size-2 rounded-full', TONE_BG[p.tone])} />
            {t.cost.parts[p.key]}
          </span>
        ))}
      </div>
    </div>
  );
}
