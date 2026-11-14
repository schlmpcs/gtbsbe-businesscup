// The month so far from the daily log: spent vs the usual month, the projected month end and
// "safe to spend today". Presentational: numbers come from SpendSummaryVM (engine).
import { common, spend as t } from '@/copy';
import { formatMoney, formatMonth, Money } from '@/ui-kit';
import type { SpendSummaryVM } from '../model/types';

export function SpendSummary({ data }: { data: SpendSummaryVM }) {
  const s = t.summary;
  return (
    <div className="grid gap-lg sm:grid-cols-3" data-testid="spend-summary">
      <div className="flex flex-col gap-xs">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{s.spentSince(formatMonth(data.month, 1))}</span>
        <p className="font-display text-4xl font-extrabold leading-display tabular-nums" data-testid="spend-spent">
          <Money value={data.spent} />
        </p>
        <p className="text-sm text-text-muted tabular-nums">{s.ofUsual(formatMoney(data.usual))}</p>
        <p className="text-xs text-text-muted">{data.usualFromHistory ? s.usualFromHistory : s.usualFromProfile}</p>
      </div>
      <div className="flex flex-col gap-xs">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{s.projected}</span>
        <p className="font-display text-4xl font-extrabold leading-display tabular-nums" data-testid="spend-projected">
          <Money value={data.projected} />
        </p>
        <p className="text-xs text-text-muted">{s.projectedHint}</p>
      </div>
      <div className="flex flex-col gap-xs">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{s.safeToday}</span>
        <p className="font-display text-4xl font-extrabold leading-display tabular-nums text-positive" data-testid="spend-safe">
          <Money value={data.safeToday} />
        </p>
        <p className="text-xs text-text-muted">
          {data.remaining < 0 ? s.over(formatMoney(-data.remaining)) : s.safeHint(data.daysLeft)}
        </p>
        {data.billsDue > 0 && <p className="text-xs text-text-muted">{s.billsKept(formatMoney(data.billsDue))}</p>}
      </div>
      <p className="text-xs text-text-muted sm:col-span-3">{common.disclaimer}</p>
    </div>
  );
}
