'use client';

// The payoff timeline of the picked method: one bar per debt, in payoff order, from now to the month it is
// paid off, on one scale (the debt-free month). Months and dates come from the planner's view-model
// (engine comparePayoff); the bars only draw them.
import { loan as t } from '@/copy';
import { cx, formatRate } from '@/ui-kit';
import { CYCLE, MOTION, TONE_BG } from '@/ui-kit/reports';
import type { PayoffPlannerVM } from '../model/types';
import { dateText } from './PayoffCompare';

export function PayoffTimeline({ vm, selectedName }: { vm: PayoffPlannerVM; selectedName: string | null }) {
  const plan = vm.selected;
  if (!plan || vm.order.length === 0) return null;
  const months = new Map(plan.perDebt.map((d) => [d.id, d.payoffMonth]));
  const known = vm.order.map((r) => months.get(r.id) ?? null).filter((m): m is number => m !== null);
  if (known.length === 0) return null;
  const scale = Math.max(1, ...known);
  const end = vm.debtFreeDate;

  return (
    <div data-testid="payoff-timeline" className="flex flex-col gap-md">
      <h3 className="text-lg font-bold">{t.planner.timeline.title}</h3>
      <ol className="flex flex-col gap-md">
        {vm.order.map((row, i) => {
          const m = months.get(row.id) ?? null;
          const label = row.isNew && selectedName ? t.planner.order.newLoan(selectedName) : (t.payoffOrder.kinds[row.kind] ?? row.kind);
          const date = row.payoffDate ? dateText(row.payoffDate) : t.planner.timeline.never;
          const tone = row.isNew ? 'primary' : CYCLE[i % CYCLE.length]!;
          return (
            <li key={row.id} className="flex flex-col gap-xs">
              <span className="sr-only">{t.planner.timeline.row(label, date)}</span>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-md text-sm">
                <span className="min-w-0 truncate font-semibold">
                  {label} <span className="font-normal text-text-muted">· {formatRate(row.apr)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">{date}</span>
              </div>
              <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full bg-surface-strong">
                <div style={{ width: `${m === null ? 100 : Math.max(2, (m / scale) * 100)}%` }} className="h-full">
                  <div className={cx('h-full rounded-full', m === null ? 'bg-negative' : TONE_BG[tone], MOTION.growX)} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="flex justify-between text-xs text-text-muted">
        <span>{t.planner.timeline.now}</span>
        {end && <span>{dateText(end)}</span>}
      </div>
    </div>
  );
}
