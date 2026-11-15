// The month as a 7-column calendar (Sunday first). A day with bills shows an amount chip per bill in its
// kind's color (two at most, then "+n") on a wide screen, and one chip with the day's total on a phone.
// Days before today are dimmed: those bills have gone out. The lists beside the grid name every charge.
import { bills as t } from '@/copy';
import { Button, cx, formatMoney, formatMonth } from '@/ui-kit';
import type { MonthVM } from '../model/types';
import { KIND_CHIP } from './kind';

const MAX_CHIPS = 2;

export type MonthGridProps = {
  month: MonthVM;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

const chipMoney = (n: number) => formatMoney(n, { compact: n >= 1000 });

export function MonthGrid({ month, onPrev, onNext, onToday }: MonthGridProps) {
  const title = t.month.title(formatMonth(month.month), month.year);
  return (
    <section aria-labelledby="bills-month-heading" className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="bills-month-heading" className="font-display text-xl font-extrabold leading-tight sm:text-2xl">
          {title}
        </h2>
        <div className="flex items-center gap-xs">
          {!month.isCurrent && (
            <Button variant="ghost" size="sm" onClick={onToday} className="min-h-11">
              {t.month.today}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onPrev} aria-label={t.month.prev} className="min-h-11 min-w-11">
            <span aria-hidden="true">{t.month.prevGlyph}</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label={t.month.next} className="min-h-11 min-w-11">
            <span aria-hidden="true">{t.month.nextGlyph}</span>
          </Button>
        </div>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-[3px] sm:border-spacing-xs" aria-label={t.month.gridLabel(title)} data-testid="bills-grid">
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
                const first = cell.charges[0];
                return (
                  <td
                    key={d}
                    data-testid={n > 0 ? 'bills-day' : undefined}
                    data-day={cell.day}
                    aria-label={t.month.dayLabel(formatMonth(month.month, cell.day), n, amount)}
                    className={cx(
                      'h-14 rounded-md p-[3px] align-top sm:h-24 sm:p-xs',
                      n > 0 ? 'bg-surface ring-1 ring-border' : 'bg-surface-strong/40',
                      cell.isPast && 'opacity-60',
                      cell.isToday && 'ring-2 ring-primary',
                    )}
                  >
                    <div aria-hidden="true" className="flex h-full min-w-0 flex-col gap-[2px] sm:gap-xs">
                      <span className={cx('text-xs font-bold tabular-nums', cell.isToday ? 'text-primary' : 'text-text-muted')}>{cell.day}</span>
                      {n > 0 && first && (
                        <>
                          {/* Phone: one chip, the day's total, in the first bill's color. */}
                          <span className={cx('mt-auto truncate rounded-sm px-[2px] text-center text-[10px] font-bold leading-4 tabular-nums sm:hidden', KIND_CHIP[first.bill.kind])}>
                            {chipMoney(cell.total)}
                          </span>
                          <span className="hidden min-w-0 flex-col gap-[2px] sm:flex">
                            {cell.charges.slice(0, MAX_CHIPS).map((c) => (
                              <span
                                key={c.bill.id}
                                className={cx('truncate rounded-sm px-xs text-xs font-semibold leading-5 tabular-nums', KIND_CHIP[c.bill.kind])}
                              >
                                {chipMoney(c.bill.amount)}
                              </span>
                            ))}
                            {n > MAX_CHIPS && <span className="text-xs leading-none text-text-muted">{t.month.more(n - MAX_CHIPS)}</span>}
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
