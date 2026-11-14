'use client';

// P3 Transactions (/transactions): summary, filters and search, the ledger with a category picker per
// line, manual add, CSV import (read in this browser) and export. Presentational: everything comes from
// useTransactions; the route passes its Link component, the import link and today's date.
import { useState, type ComponentType, type ReactNode } from 'react';
import { planner, transactions as t } from '@/copy';
import { Button, buttonClassName, Card, Choice, cx, formatMoney, formatMonthYear, PageHeader, Stack } from '@/ui-kit';
import type { DirectionFilter, ImportStateVM, StatementClass, TransactionsVM } from '../model/types';
import { AddTransactionForm } from './AddTransactionForm';
import { TransactionList } from './TransactionList';

export type TransactionsScreenProps = {
  vm: TransactionsVM;
  links: { upload: string };
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
  /** 'YYYY-MM-DD' the add form's date starts at. */
  today?: string;
};

const SELECT = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-border bg-surface px-sm text-base';
const DIRECTIONS: DirectionFilter[] = ['all', 'in', 'out'];

export function TransactionsScreen({ vm, links, Link, today }: TransactionsScreenProps) {
  const [adding, setAdding] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const noLines = vm.ready && vm.options.months.length === 0;

  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="2xl">
        <PageHeader title={t.title} intro={t.screen.intro} />
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.screen.loading}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-sm">
              <Button onClick={() => setAdding((a) => !a)} aria-expanded={adding} data-testid="transactions-add">
                {t.add}
              </Button>
              <ImportButton vm={vm} />
              <Link href={links.upload} className={buttonClassName({ variant: 'ghost' })}>
                {t.screen.importGuided}
              </Link>
              {!noLines && (
                <Button variant="ghost" onClick={() => setExportFailed(vm.export() === 'failed')}>
                  {t.export}
                </Button>
              )}
            </div>
            <ImportStatus state={vm.importState} />
            {exportFailed && (
              <p role="alert" className="text-sm text-negative">
                {t.screen.exportFailed}
              </p>
            )}
            {adding && (
              <Card title={t.addForm.title}>
                <AddTransactionForm onAdd={vm.add} accounts={vm.options.accounts} defaultDate={today} onDone={() => setAdding(false)} />
              </Card>
            )}
            {noLines ? (
              <Card data-testid="transactions-empty" className="flex flex-col items-center gap-md text-center">
                <h2 className="font-display text-3xl font-extrabold">{t.screen.emptyAllTitle}</h2>
                <p className="max-w-prose text-text-muted">{t.screen.emptyAllBody}</p>
                <div className="flex flex-wrap justify-center gap-sm">
                  <Link href={links.upload} className={buttonClassName({ variant: 'primary' })}>
                    {t.screen.importGuided}
                  </Link>
                  {!adding && (
                    <Button variant="secondary" onClick={() => setAdding(true)}>
                      {t.add}
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <>
                <Summary vm={vm} />
                <Filters vm={vm} />
                <Card className="p-lg sm:p-xl">
                  <label className="mb-md flex min-h-11 items-center gap-sm text-sm">
                    <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="size-5 accent-primary" />
                    {t.applyAll}
                  </label>
                  {vm.rows.length === 0 ? (
                    <p className="py-xl text-center text-text-muted" data-testid="transactions-no-match">
                      {t.empty}
                    </p>
                  ) : (
                    <TransactionList rows={vm.rows} onCategory={vm.setCategory} applyAll={applyAll} />
                  )}
                  <Pager vm={vm} />
                </Card>
              </>
            )}
          </>
        )}
        <p className="text-xs text-text-muted">
          {t.localOnly} {planner.educational}
        </p>
      </Stack>
    </main>
  );
}

function ImportButton({ vm }: { vm: TransactionsVM }) {
  const busy = vm.importState.status === 'reading';
  return (
    <label className={cx(buttonClassName({ variant: 'secondary' }), 'cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-focus', busy && 'opacity-50')}>
      {t.import}
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={t.screen.importFile}
        disabled={busy}
        data-testid="transactions-import-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void vm.importCsv(file);
        }}
      />
    </label>
  );
}

function ImportStatus({ state }: { state: ImportStateVM }) {
  if (state.status === 'idle') return null;
  const text =
    state.status === 'reading'
      ? t.importStates.reading
      : state.status === 'done'
        ? t.screen.importDone(state.added, state.skipped)
        : t.importStates.error;
  return (
    <p role="status" aria-live="polite" data-testid="transactions-import-status" className={cx('text-sm', state.status === 'error' ? 'text-negative' : 'text-text-muted')}>
      {text}
    </p>
  );
}

function Summary({ vm }: { vm: TransactionsVM }) {
  const items = [
    { id: 'count', label: t.summary.count, value: String(vm.summary.count) },
    { id: 'income', label: t.summary.income, value: formatMoney(vm.summary.income, { cents: true }) },
    { id: 'spending', label: t.summary.spending, value: formatMoney(vm.summary.spending, { cents: true }) },
    ...(vm.summary.largest ? [{ id: 'largest', label: t.summary.largest, value: formatMoney(vm.summary.largest.amount, { cents: true }) }] : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-sm sm:grid-cols-4" data-testid="transactions-summary">
      {items.map((i) => (
        <div key={i.id} className="flex min-w-0 flex-col gap-xs rounded-lg bg-surface p-md shadow-sm">
          <dt className="text-xs text-text-muted">{i.label}</dt>
          <dd className="truncate text-lg font-bold tabular-nums" data-testid={`transactions-summary-${i.id}`}>
            {i.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Filters({ vm }: { vm: TransactionsVM }) {
  const f = vm.filters;
  return (
    <section aria-label={t.screen.filtersLabel} className="flex flex-col gap-md">
      <div className="flex gap-sm">
        <input
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          value={f.query}
          onChange={(e) => vm.search(e.target.value)}
          data-testid="transactions-search"
          className={cx(SELECT, 'flex-1 px-md')}
        />
        {f.query !== '' && (
          <Button variant="ghost" size="sm" onClick={() => vm.search('')}>
            {t.screen.clearSearch}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <select
          aria-label={t.screen.category}
          value={f.category}
          onChange={(e) => vm.setFilter('category', e.target.value as StatementClass | 'all')}
          data-testid="transactions-filter-category"
          className={SELECT}
        >
          <option value="all">{t.allCategories}</option>
          {vm.options.categories.map((c) => (
            <option key={c} value={c}>
              {planner.categories[c]}
            </option>
          ))}
        </select>
        <select
          aria-label={t.screen.account}
          value={f.accountId}
          onChange={(e) => vm.setFilter('accountId', e.target.value)}
          data-testid="transactions-filter-account"
          className={SELECT}
        >
          <option value="all">{t.allAccounts}</option>
          {vm.options.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t.screen.month}
          value={f.month}
          onChange={(e) => vm.setFilter('month', e.target.value)}
          data-testid="transactions-filter-month"
          className={SELECT}
        >
          <option value="all">{t.screen.allMonths}</option>
          {vm.options.months.map((m) => (
            <option key={m} value={m}>
              {formatMonthYear(m)}
            </option>
          ))}
        </select>
      </div>
      <Choice
        legend={t.screen.direction}
        name="transactions-direction"
        value={f.direction}
        options={DIRECTIONS.map((d) => ({ value: d, label: t.directions[d] }))}
        onChange={(d) => vm.setFilter('direction', d)}
      />
    </section>
  );
}

function Pager({ vm }: { vm: TransactionsVM }) {
  if (vm.pageCount <= 1) return null;
  return (
    <nav aria-label={t.screen.page(vm.page + 1, vm.pageCount)} className="mt-md flex items-center justify-between gap-sm border-t border-border pt-md">
      <Button variant="ghost" size="sm" disabled={vm.page === 0} onClick={() => vm.setPage(vm.page - 1)}>
        {t.screen.prev}
      </Button>
      <span className="text-sm text-text-muted tabular-nums" data-testid="transactions-page">
        {t.screen.page(vm.page + 1, vm.pageCount)}
      </span>
      <Button variant="ghost" size="sm" disabled={vm.page >= vm.pageCount - 1} onClick={() => vm.setPage(vm.page + 1)}>
        {t.screen.next}
      </Button>
    </nav>
  );
}
