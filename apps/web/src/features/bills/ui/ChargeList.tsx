// A short list of charges ("Thu 20 · Netflix   $15.49") with an optional total row.
import { bills as t } from '@/copy';
import { cx, EstimateTag, formatMoney } from '@/ui-kit';
import type { ChargeVM } from '../model/types';
import { KIND_DOT } from './kind';

export type ChargeListProps = {
  charges: ChargeVM[];
  total: number;
  totalIsEstimate: boolean;
  empty: string;
  testId?: string;
};

export function ChargeList({ charges, total, totalIsEstimate, empty, testId }: ChargeListProps) {
  if (charges.length === 0) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <div className="flex flex-col gap-sm">
      <ul className="flex flex-col gap-xs" data-testid={testId}>
        {charges.map((c) => (
          <li key={`${c.bill.id}-${c.date.iso}`} className={cx('flex min-h-11 items-center justify-between gap-md', c.isPast && 'text-text-muted')}>
            <span className="flex min-w-0 items-center gap-sm">
              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', KIND_DOT[c.bill.kind])} />
              <span className="truncate">
                {t.soon.line(t.weekdaysShort[c.date.weekday] ?? '', c.date.day, c.bill.label)}
                {c.isToday && <span className="ml-xs text-xs font-bold uppercase text-primary">{t.soon.today}</span>}
                {c.isPast && <span className="ml-xs text-xs text-text-muted">{t.month.paidMark}</span>}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-xs font-semibold tabular-nums">
              {formatMoney(c.bill.amount)}
              {c.bill.amountIsEstimate && <EstimateTag />}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-between gap-md border-t border-border pt-sm font-bold">
        <span>{t.soon.total}</span>
        <span className="flex items-center gap-xs tabular-nums">
          {formatMoney(total)}
          {totalIsEstimate && <EstimateTag />}
        </span>
      </p>
    </div>
  );
}
