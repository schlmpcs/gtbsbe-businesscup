// The month as a 7-column calendar (Sunday first). Each day with a charge shows a dot per bill and the
// day's total; tapping is not needed: the list under the grid names every charge.
import { bills as t } from '@/copy';
import { Button, cx, formatMoney, formatMonth } from '@/ui-kit';
import type { BillKindVM, MonthVM } from '../model/types';

export const KIND_DOT: Record<BillKindVM, string> = {
  rent: 'bg-primary',
  debt: 'bg-ink',
  subscription: 'bg-positive',
};

const MAX_DOTS = 3;

export type MonthGridProps = {
  month: MonthVM;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function MonthGrid({ month, onPrev, onNext, onToday }: MonthGridProps) {
  const title = t.month.title(formatMonth(month.month), month.year);
  return (
    <section aria-labelledby="bills-month-heading" className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <Button variant="ghost" size="sm" onClick={onPrev} aria-label={t.month.prev} className="min-h-11 min-w-11">
          <span aria-hidden="true">{t.month.prevGlyph}</span>
        </Button>
        <div className="flex flex-col items-center">
          <h2 id="bills-month-heading" className="font-display text-2xl font-extrabold leading-tight">
            {title}
          </h2>
          {!month.isCurrent && (
            <button type="button" onClick={onToday} className="min-h-11 text-sm font-semibold text-primary hover:underline">
              {t.month.today}
            </button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onNext} aria-label={t.month.next} className="min-h-11 min-w-11">
          <span aria-hidden="true">{t.month.nextGlyph}</span>
        </Button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-xs" aria-label={t.month.gridLabel(title)} data-testid="bills-grid">
        <thead>
          <tr>
            {t.weekdaysShort.map((name, i) => (
              <th key={name} scope="col" abbr={name} className="pb-xs text-xs font-bold uppercase text-text-muted">
                <span className="sm:hidden" aria-hidden="true">
                  {t.weekdaysNarrow[i]}
                </span>
                <span className="hidden sm:inline">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {month.weeks.map((week, w) => (
            <tr key={w}>
              {week.map((cell, d) => {
                if (cell.day === null) return <td key={d} aria-hidden="true" />;
                const n = cell.charges.length;
                const amount = formatMoney(cell.total);
                return (
                  <td
                    key={d}
                    data-testid={n > 0 ? 'bills-day' : undefined}
                    data-day={cell.day}
                    aria-label={t.month.dayLabel(formatMonth(month.month, cell.day), n, amount)}
                    className={cx(
                      'h-16 rounded-md p-xs align-top sm:h-20',
                      n > 0 ? 'bg-surface shadow-sm' : 'bg-surface-strong/40',
                      cell.isToday && 'ring-2 ring-primary',
                    )}
                  >
                    <div aria-hidden="true" className="flex h-full flex-col gap-xs">
                      <span className={cx('text-xs font-bold tabular-nums', cell.isToday ? 'text-primary' : 'text-text-muted')}>
                        {cell.day}
                      </span>
                      {n > 0 && (
                        <>
                          <span className="flex flex-wrap items-center gap-xs">
                            {cell.charges.slice(0, MAX_DOTS).map((c) => (
                              <span key={c.bill.id} className={cx('size-2 rounded-full', KIND_DOT[c.bill.kind])} />
                            ))}
                            {n > MAX_DOTS && <span className="text-xs leading-none text-text-muted">{t.month.more(n - MAX_DOTS)}</span>}
                          </span>
                          <span className="mt-auto truncate text-xs font-semibold tabular-nums">
                            {formatMoney(cell.total, { compact: cell.total >= 1000 })}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
