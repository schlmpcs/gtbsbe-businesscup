'use client';

// The ledger lines: a table on wide screens, a card per line on phones (one DOM, the grid reflows, so a
// 390px phone never scrolls sideways). Presentational: rows come from the view-model; a category change
// is an event (`onCategory`), left out where the screen cannot change one (Account detail).
import { planner, transactions as t } from '@/copy';
import { cx, formatMoney, formatMonth } from '@/ui-kit';
import type { StatementClass, TransactionRowVM, TransactionTone } from '../model/types';

export type TransactionListProps = {
  rows: TransactionRowVM[];
  /** Change one line's category; with `applyAll`, every line of the same merchant. Omit for read-only categories. */
  onCategory?: (id: string, category: StatementClass, applyAll: boolean) => void;
  /** Whether a category change applies to the whole merchant. */
  applyAll?: boolean;
  /** Show the account column (off on Account detail). */
  showAccount?: boolean;
};

/** Every class, in the copy's order, for the category picker. */
export const ALL_CATEGORIES = Object.keys(planner.categories) as StatementClass[];

const TONE: Record<TransactionTone, string> = {
  income: 'text-positive',
  refund: 'text-positive',
  spending: 'text-text',
  transfer: 'text-text-muted',
};

const GRID = 'sm:grid sm:items-center sm:gap-md';
const COLS_WITH_ACCOUNT = 'sm:grid-cols-[7rem_minmax(0,1fr)_11rem_8rem_7rem]';
const COLS = 'sm:grid-cols-[7rem_minmax(0,1fr)_11rem_7rem]';

/** 'YYYY-MM-DD' → "November 12". */
const dayLabel = (iso: string) => formatMonth(iso.slice(0, 7), Number(iso.slice(8, 10)));

export function TransactionList({ rows, onCategory, applyAll = false, showAccount = true }: TransactionListProps) {
  const cols = showAccount ? COLS_WITH_ACCOUNT : COLS;
  return (
    <div className="min-w-0" data-testid="transactions-list">
      <div aria-hidden="true" className={cx('hidden border-b border-border pb-sm text-xs font-medium text-text-muted', GRID, cols)}>
        <span>{t.screen.columns.date}</span>
        <span>{t.screen.columns.label}</span>
        <span>{t.screen.columns.category}</span>
        {showAccount && <span>{t.screen.columns.account}</span>}
        <span className="text-right">{t.screen.columns.amount}</span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.id}
            data-testid="transaction-row"
            className={cx('grid grid-cols-[minmax(0,1fr)_auto] gap-x-md gap-y-xs py-md', GRID, cols)}
          >
            <span className="col-span-2 text-xs text-text-muted sm:col-span-1 sm:text-sm">{dayLabel(r.date)}</span>
            <span className="min-w-0 truncate font-medium" title={r.label}>
              {r.label}
            </span>
            <span className={cx('row-span-1 text-right font-semibold tabular-nums sm:order-last', TONE[r.tone])}>
              {formatMoney(r.amount, { cents: true, signed: r.amount > 0 })}
            </span>
            <span className="flex min-w-0 items-center gap-xs">
              {onCategory ? (
                <select
                  aria-label={t.screen.changeCategory(r.label)}
                  value={r.category}
                  onChange={(e) => onCategory(r.id, e.target.value as StatementClass, applyAll)}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-sm text-sm sm:min-h-9"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {planner.categories[c]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm">{planner.categories[r.category]}</span>
              )}
              {r.categoryOverridden && (
                <span title={t.screen.overridden} className="shrink-0 text-xs text-primary">
                  ●<span className="sr-only">{t.screen.overridden}</span>
                </span>
              )}
            </span>
            {showAccount && <span className="truncate self-center text-right text-sm text-text-muted sm:text-left">{r.accountName ?? t.screen.noAccount}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
