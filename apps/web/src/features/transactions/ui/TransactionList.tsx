// The ledger lines: a clean table on wide screens (date, merchant, category chip, account, amount) and a
// card per line on phones (merchant and amount on top, date and account under, the category chip below),
// one DOM so a 390px phone never scrolls sideways. Ledger rows keep their cents; totals elsewhere are
// whole dollars. Presentational: rows come from the view-model; a category change is an event
// (`onCategory`), left out where the screen cannot change one (Account detail).
import { planner, transactions as t } from '@/copy';
import { cx, formatMoney, formatMonth, Select } from '@/ui-kit';
import { CategoryChip, CLASS_TONE, Initials, TONE_BG } from '@/ui-kit/reports';
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
const COLS_WITH_ACCOUNT = 'sm:grid-cols-[6.5rem_minmax(0,1fr)_11rem_8rem_7rem]';
const COLS = 'sm:grid-cols-[6.5rem_minmax(0,1fr)_11rem_7rem]';

/** 'YYYY-MM-DD' → "November 12". */
const dayLabel = (iso: string) => formatMonth(iso.slice(0, 7), Number(iso.slice(8, 10)));

export function TransactionList({ rows, onCategory, applyAll = false, showAccount = true }: TransactionListProps) {
  const cols = showAccount ? COLS_WITH_ACCOUNT : COLS;
  return (
    <div className="min-w-0" data-testid="transactions-list">
      <div aria-hidden="true" className={cx('hidden border-b border-border px-sm pb-sm section-label', GRID, cols)}>
        <span>{t.screen.columns.date}</span>
        <span>{t.screen.columns.label}</span>
        <span>{t.screen.columns.category}</span>
        {showAccount && <span>{t.screen.columns.account}</span>}
        <span className="text-right">{t.screen.columns.amount}</span>
      </div>
      <ul className="flex flex-col gap-sm sm:gap-0 sm:divide-y sm:divide-border">
        {rows.map((r) => (
          <li
            key={r.id}
            data-testid="transaction-row"
            className={cx(
              'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-md gap-y-xs rounded-lg border border-border p-md',
              'sm:rounded-none sm:border-0 sm:px-sm sm:py-sm sm:transition-colors sm:hover:bg-surface-strong/40',
              GRID,
              cols,
            )}
          >
            <span className="col-span-3 row-start-2 pl-[3.25rem] text-xs text-text-muted sm:col-span-1 sm:row-start-auto sm:pl-0 sm:text-sm">
              {dayLabel(r.date)}
              {showAccount && <span className="sm:hidden"> · {r.accountName ?? t.screen.noAccount}</span>}
            </span>
            <span className="col-span-2 row-start-1 flex min-w-0 items-center gap-md sm:col-span-1 sm:row-start-auto">
              <Initials name={r.label} className="sm:size-8 sm:text-xs" />
              <span className="min-w-0 truncate font-medium" title={r.label}>
                {r.label}
              </span>
            </span>
            <span className="col-span-3 row-start-3 flex min-w-0 items-center gap-xs pl-[3.25rem] sm:col-span-1 sm:row-start-auto sm:pl-0">
              {onCategory ? (
                <span className="relative flex min-w-0 max-w-full items-center">
                  <span aria-hidden="true" className={cx('pointer-events-none absolute left-sm z-10 size-2 rounded-full', TONE_BG[CLASS_TONE[r.category]])} />
                  <Select
                    variant="pill"
                    size="sm"
                    aria-label={t.screen.changeCategory(r.label)}
                    value={r.category}
                    onChange={(e) => onCategory(r.id, e.target.value as StatementClass, applyAll)}
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {planner.categories[c]}
                      </option>
                    ))}
                  </Select>
                </span>
              ) : (
                <CategoryChip category={r.category} name={planner.categories[r.category]} />
              )}
              {r.categoryOverridden && (
                <span title={t.screen.overridden} className="shrink-0 text-xs text-primary">
                  ●<span className="sr-only">{t.screen.overridden}</span>
                </span>
              )}
            </span>
            {showAccount && <span className="hidden truncate text-sm text-text-muted sm:block">{r.accountName ?? t.screen.noAccount}</span>}
            <span className={cx('col-start-3 row-start-1 text-right font-semibold tabular-nums sm:col-start-auto sm:row-start-auto', TONE[r.tone])}>
              {formatMoney(r.amount, { cents: true, signed: r.amount > 0 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
