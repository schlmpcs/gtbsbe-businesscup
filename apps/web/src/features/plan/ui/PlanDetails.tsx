'use client';

// Under the chart: the year-by-year card with tabs Accounts / Cash flow / Events (usePlan → tables).
// Years are columns; the first column (row names) stays put while the table scrolls sideways inside the
// card. Accounts group as Assets › Cash › each account (expandable); Cash flow opens Income and Expenses
// into their lines. Every cell arrives formatted; this file only lays them out.
import { useState } from 'react';
import { plan as copy } from '@/copy';
import { Tabs, cx } from '@/ui-kit';
import type { PlanAccountsTableVM, PlanCashFlowTableVM, PlanEventRowVM, PlanTone } from '../model/types';
import { EventBadge } from './EventIcon';

type TabId = 'accounts' | 'cashFlow' | 'events';

export type PlanDetailsProps = {
  events: readonly PlanEventRowVM[];
  cashFlow: PlanCashFlowTableVM;
  accounts: PlanAccountsTableVM;
  onOpenEvent: (id: string) => void;
};

export function PlanDetails({ events, cashFlow, accounts, onOpenEvent }: PlanDetailsProps) {
  const t = copy.screen;
  const [tab, setTab] = useState<TabId>('accounts');

  return (
    <section aria-labelledby="plan-details" className="card card-pad flex min-w-0 flex-col gap-md">
      <h2 id="plan-details" className="text-lg font-bold">{t.tabs.label}</h2>
      <Tabs<TabId>
        label={t.tabs.label}
        value={tab}
        onValueChange={setTab}
        tabs={[
          { id: 'accounts', label: t.tabs.accounts, panel: <AccountsTable table={accounts} /> },
          { id: 'cashFlow', label: t.tabs.cashFlow, panel: <CashFlowTable table={cashFlow} /> },
          { id: 'events', label: t.tabs.events, panel: <EventList events={events} onOpen={onOpenEvent} /> },
        ]}
      />
    </section>
  );
}

// ----- The year-columns table ------------------------------------------------------------------

type YearColumn = { year: number; age: number; highlight: boolean };
type YearRow = {
  id: string;
  label: string;
  depth: 0 | 1 | 2;
  cells: readonly string[];
  tones?: readonly (PlanTone | null)[];
  strong?: boolean;
  /** Expandable rows: whether open, and the toggle. */
  expanded?: boolean;
  onToggle?: () => void;
};

const STICKY = 'sticky left-0 z-10 bg-surface';

function YearTable({ caption, columns, rows }: { caption: string; columns: readonly YearColumn[]; rows: readonly YearRow[] }) {
  const t = copy.screen.tables;
  return (
    <div className="flex flex-col gap-xs">
      <p className="text-xs text-text-muted">{t.scrollHint}</p>
      <div className="-mx-lg overflow-x-auto overscroll-x-contain sm:mx-0" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs text-text-muted">
            <tr>
              <th scope="col" className={cx(STICKY, 'w-36 min-w-36 border-b border-border px-md py-sm text-left font-medium sm:w-52 sm:min-w-52')}>
                {t.rowHeader}
              </th>
              {columns.map((c) => (
                <th
                  key={c.year}
                  scope="col"
                  className={cx('min-w-24 border-b border-border px-md py-sm text-right font-medium', c.highlight && 'bg-primary-soft text-text')}
                  title={c.highlight ? t.retirementYear : undefined}
                >
                  <span className="block font-semibold text-text">{c.year}</span>
                  <span className="block font-normal">{t.age(c.age)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cx('group', r.strong && 'font-semibold')}>
                <th
                  scope="row"
                  className={cx(
                    STICKY,
                    'max-w-36 border-b border-border py-xs pr-sm text-left font-normal group-hover:bg-surface-strong sm:max-w-52',
                    r.depth === 0 ? 'pl-md' : r.depth === 1 ? 'pl-xl' : 'pl-2xl text-text-muted',
                    r.strong && 'font-semibold',
                  )}
                >
                  {r.onToggle ? (
                    <button
                      type="button"
                      aria-expanded={r.expanded}
                      aria-label={r.expanded ? t.collapse(r.label) : t.expand(r.label)}
                      onClick={r.onToggle}
                      className="flex min-h-11 w-full items-center gap-xs text-left font-[inherit] hover:text-primary"
                    >
                      <svg aria-hidden="true" viewBox="0 0 16 16" className={cx('size-md shrink-0 transition-transform motion-reduce:transition-none', r.expanded && 'rotate-90')}>
                        <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{r.label}</span>
                    </button>
                  ) : (
                    <span className="flex min-h-9 items-center truncate">{r.label}</span>
                  )}
                </th>
                {r.cells.map((cell, i) => {
                  const tone = r.tones?.[i];
                  return (
                    <td
                      key={columns[i]?.year ?? i}
                      className={cx(
                        'whitespace-nowrap border-b border-border px-md py-xs text-right group-hover:bg-surface-strong',
                        columns[i]?.highlight && 'bg-primary-soft/60',
                        tone === 'bad' && 'text-negative',
                        tone === 'good' && 'text-positive',
                        r.depth === 2 && 'text-text-muted',
                      )}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Which expandable rows are open (UI state only). */
function useOpenRows(initial: readonly string[]) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { isOpen: (id: string) => open.has(id), toggle };
}

function AccountsTable({ table }: { table: PlanAccountsTableVM }) {
  const t = copy.screen.tables;
  const { isOpen, toggle } = useOpenRows(['assets', 'liabilities']);
  const columns = table.rows.map((r) => ({ year: r.year, age: r.age, highlight: r.isRetirementYear }));
  const nameOf = new Map(table.columns.map((c) => [c.accountId, c.name]));

  const rows: YearRow[] = [];
  for (const s of table.sections) {
    if (s.groups.length === 0) continue;
    const sOpen = isOpen(s.id);
    rows.push({
      id: s.id, label: s.label, depth: 0, strong: true, expanded: sOpen, onToggle: () => toggle(s.id),
      cells: table.rows.map((r) => (s.id === 'assets' ? r.assetsLabel : r.liabilitiesLabel)),
    });
    if (!sOpen) continue;
    for (const g of s.groups) {
      const key = `${s.id}:${g.group}`;
      const gOpen = isOpen(key);
      rows.push({
        id: key, label: g.label, depth: 1, expanded: gOpen, onToggle: () => toggle(key),
        cells: table.rows.map((r) => r.groupEnds[g.group] ?? '—'),
      });
      if (!gOpen) continue;
      for (const id of g.accountIds) {
        rows.push({ id: `${key}:${id}`, label: nameOf.get(id) ?? id, depth: 2, cells: table.rows.map((r) => r.cells[id]?.end ?? '—') });
      }
    }
  }
  rows.push({ id: 'netWorth', label: t.netWorth, depth: 0, strong: true, cells: table.rows.map((r) => r.netWorthLabel) });

  return <YearTable caption={copy.screen.tabs.accounts} columns={columns} rows={rows} />;
}

function CashFlowTable({ table }: { table: PlanCashFlowTableVM }) {
  const c = copy.tables.cashFlow;
  const { isOpen, toggle } = useOpenRows([]);
  const columns = table.rows.map((r) => ({ year: r.year, age: r.age, highlight: false }));
  const first = table.rows[0];
  const lineRows = (kind: 'incomeLines' | 'expenseLines', parent: string): YearRow[] =>
    (first?.[kind] ?? []).map((l) => ({
      id: `${parent}:${l.key}`,
      label: l.label,
      depth: 2,
      cells: table.rows.map((r) => r[kind].find((x) => x.key === l.key)?.amountLabel ?? '—'),
    }));

  const rows: YearRow[] = [
    { id: 'income', label: c.income, depth: 0, expanded: isOpen('income'), onToggle: () => toggle('income'), cells: table.rows.map((r) => r.incomeLabel) },
    ...(isOpen('income') ? lineRows('incomeLines', 'income') : []),
    { id: 'expenses', label: c.expenses, depth: 0, expanded: isOpen('expenses'), onToggle: () => toggle('expenses'), cells: table.rows.map((r) => r.expensesLabel) },
    ...(isOpen('expenses') ? lineRows('expenseLines', 'expenses') : []),
    { id: 'withdrawals', label: c.withdrawals, depth: 0, cells: table.rows.map((r) => r.withdrawalsLabel) },
    { id: 'net', label: c.net, depth: 0, strong: true, cells: table.rows.map((r) => r.netLabel), tones: table.rows.map((r) => r.netTone) },
  ];
  return <YearTable caption={copy.screen.tabs.cashFlow} columns={columns} rows={rows} />;
}

function EventList({ events, onOpen }: { events: readonly PlanEventRowVM[]; onOpen: (id: string) => void }) {
  const t = copy.screen.events;
  if (events.length === 0) return <p className="py-lg text-sm text-text-muted">{t.empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {events.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onOpen(e.id)}
            aria-label={t.edit(e.name ?? e.title)}
            className={cx(
              'flex min-h-11 w-full items-center gap-md rounded-md px-xs py-md text-left hover:bg-surface-strong',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              !e.enabled && 'opacity-50',
            )}
          >
            <EventBadge id={e.icon} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {e.name ?? e.title}
                {!e.enabled && <span className="ml-sm text-xs font-normal text-text-muted">({t.off})</span>}
              </span>
              <span className="truncate text-sm text-text-muted">{e.summary}</span>
            </span>
            <span className="shrink-0 text-right text-sm tabular-nums">
              <span className="block font-semibold">{e.year}</span>
              <span className="block text-xs text-text-muted">{copy.chart.ageTick(e.age)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
