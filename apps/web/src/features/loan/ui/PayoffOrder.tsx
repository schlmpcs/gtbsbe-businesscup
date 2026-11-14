'use client';

import { loan as t } from '@/copy';
import { Card, formatRate, Money } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';

/** Your debts plus the selected offer, in the order to pay them off (engine payoffOrder, from the view-model). */
export function PayoffOrder({ plan, selectedName }: { plan: LoanLabVM['payoffPlan']; selectedName: string | null }) {
  if (!plan) return null;
  return (
    <Card title={t.payoffOrder.title} headingLevel={2} className="flex flex-col">
      <ol className="flex flex-col gap-md">
        {plan.steps.map((s, i) => {
          const label = s.isNew && selectedName ? t.payoffOrder.newLoan(selectedName) : (t.payoffOrder.kinds[s.kind] ?? s.kind);
          return (
            <li key={s.id} className="flex items-center gap-md">
              <span
                aria-hidden="true"
                className="flex size-2xl shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-primary"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-lg">{t.payoffOrder.step(label, formatRate(s.apr))}</span>
              <Money value={s.balance} className="text-lg font-bold" />
            </li>
          );
        })}
      </ol>
      <p className="mt-lg text-sm font-semibold">
        {plan.payoffMonth === null ? t.payoffOrder.never : t.payoffOrder.payoff(plan.payoffMonth)}
      </p>
      <p className="mt-xs text-xs text-text-muted">{t.payoffOrder.note}</p>
    </Card>
  );
}
