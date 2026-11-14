'use client';

import { loan as t } from '@/copy';
import { EstimateTag, formatRate, Money } from '@/ui-kit';
import type { PayoffPlannerVM } from '../model/types';
import { dateText } from './PayoffCompare';

/** The payoff order of the picked method: kind of debt, rate and balance (never a lender), the new loan marked. */
export function PayoffOrderList({ vm, selectedName }: { vm: PayoffPlannerVM; selectedName: string | null }) {
  if (vm.order.length === 0) return null;
  return (
    <div className="flex flex-col gap-md">
      <h3 id="payoff-order-title" className="text-lg font-bold">
        {t.planner.order.title}
      </h3>
      <ol aria-labelledby="payoff-order-title" className="flex flex-col gap-md">
        {vm.order.map((row, i) => {
          const label = row.isNew && selectedName ? t.planner.order.newLoan(selectedName) : (t.payoffOrder.kinds[row.kind] ?? row.kind);
          return (
            <li key={row.id} className="flex items-center gap-md">
              <span aria-hidden="true" className="flex size-2xl shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-primary">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-sm text-lg">
                  {t.planner.order.step(label, formatRate(row.apr))}
                  {row.minIsEstimate && <EstimateTag />}
                </span>
                <span className="text-sm text-text-muted">{row.payoffDate ? t.planner.order.paidBy(dateText(row.payoffDate)) : t.planner.order.notWithin}</span>
              </span>
              <Money value={row.balance} className="text-lg font-bold" />
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-text-muted">{t.planner.order.note(t.planner.method.names[vm.method])}</p>
    </div>
  );
}
