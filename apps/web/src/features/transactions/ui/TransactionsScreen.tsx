'use client';

// P3 Transactions (/transactions): summary, filters and search, the ledger with a category picker per
// line, manual add, CSV import (read in this browser) and export. Presentational: everything comes from
// useTransactions; the route passes its Link component, the import link and today's date.
import { useState, type ComponentType, type ReactNode } from 'react';
import { bankDemo, planner, transactions as t } from '@/copy';
import { Button, buttonClassName, cx, formatMoney, formatMonthYear, PageHeader, Tag } from '@/ui-kit';
import { EmptyState, KpiStrip, Panel, Segmented } from '@/ui-kit/reports';
import type { DirectionFilter, ImportStateVM, StatementClass, TransactionsVM } from '../model/types';
import { AddTransactionForm } from './AddTransactionForm';
import { TransactionList } from './TransactionList';

export type TransactionsScreenProps = {
  vm: TransactionsVM;
  links: { upload: string };
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
  /** 'YYYY-MM-DD' the add form's date starts at. */
  today?: string;
  /** Open the import panel on arrival (the dashboard's "Import CSV" links here with ?import=1). */
  openImport?: boolean;
  /** Opens the demo bank link (labelled a demo; the route renders it and imports its statement). */
  onConnectBank?: () => void;
};

const SELECT = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg px-sm text-base sm:text-sm';
const DIRECTIONS: DirectionFilter[] = ['all', 'in', 'out'];

export function TransactionsScreen({ vm, links, Link, today, openImport = false, onConnectBank }: TransactionsScreenProps) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(openImport);
  const [applyAll, setApplyAll] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const noLines = vm.ready && vm.options.months.length === 0;

  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader
        title={t.title}
        intro={t.screen.intro}
        aside={
          vm.ready && !noLines ? (
            <div className="flex flex-wrap gap-sm">
              <Button variant="ghost" onClick={() => setExportFailed(vm.export() === 'failed')}>
                {t.export}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setImporting((o) => !o)}
                aria-expanded={importing}
                aria-controls="transactions-import"
                data-testid="transactions-import"
              >
                {t.import}
              </Button>
              <Button onClick={() => setAdding((a) => !a)} aria-expanded={adding} data-testid="transactions-add">
                {t.add}
              </Button>
            </div>
          ) : undefined
        }
      />
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-(--card-radius) bg-surface">
          <span className="sr-only">{t.screen.loading}</span>
        </div>
      ) : (
        <>
          {!noLines && importing && (
            <Panel title={t.screen.importTitle} data-testid="transactions-import-panel">
              <div id="transactions-import">
                <ImportPanel vm={vm} links={links} Link={Link} onConnectBank={onConnectBank} />
              </div>
            </Panel>
          )}
          <ImportStatus state={vm.importState} />
          {exportFailed && (
            <p role="alert" className="text-sm text-negative">
              {t.screen.exportFailed}
            </p>
          )}
          {adding && (
            <Panel title={t.addForm.title}>
              <AddTransactionForm onAdd={vm.add} accounts={vm.options.accounts} defaultDate={today} onDone={() => setAdding(false)} />
            </Panel>
          )}
          {noLines ? (
            <EmptyState
              data-testid="transactions-empty"
              art="upload"
              title={t.screen.emptyAllTitle}
              body={t.screen.emptyAllBody}
              actions={
                <div className="flex w-full flex-col items-center gap-md">
                  <div className="flex flex-wrap justify-center gap-sm">
                    <ImportButton vm={vm} />
                    {!adding && (
                      <Button variant="secondary" onClick={() => setAdding(true)} data-testid="transactions-add">
                        {t.add}
                      </Button>
                    )}
                  </div>
                  <GuidedLink links={links} Link={Link} />
                  {onConnectBank && <ConnectBank onClick={onConnectBank} />}
                </div>
              }
            />
          ) : (
            <>
              <Summary vm={vm} />
              <Panel aria-label={t.title} delay={60}>
                <Filters vm={vm} />
                <label className="mt-md flex min-h-11 items-center gap-sm text-sm text-text-muted">
                  <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="size-5 accent-primary" />
                  {t.applyAll}
                </label>
                <div className="mt-md border-t border-border pt-md">
                  {vm.rows.length === 0 ? (
                    <p className="py-xl text-center text-text-muted" data-testid="transactions-no-match">
                      {t.empty}
                    </p>
                  ) : (
                    <TransactionList rows={vm.rows} onCategory={vm.setCategory} applyAll={applyAll} />
                  )}
                </div>
                <Pager vm={vm} />
              </Panel>
            </>
          )}
        </>
      )}
      <p className="text-xs text-text-muted">
        {t.localOnly} {planner.educational}
      </p>
    </main>
  );
}

/** The one import control: pick a CSV here, or take the guided path (it has a sample statement). */
function ImportPanel({
  vm,
  links,
  Link,
  onConnectBank,
}: {
  vm: TransactionsVM;
  links: { upload: string };
  Link: TransactionsScreenProps['Link'];
  onConnectBank?: () => void;
}) {
  return (
    <div className="flex flex-col gap-md">
      <p className="max-w-prose text-sm text-text-muted">{t.screen.importBody}</p>
      <div className="flex flex-wrap items-center gap-md">
        <ImportButton vm={vm} label={t.screen.importFile} />
        <GuidedLink links={links} Link={Link} />
      </div>
      {onConnectBank && <ConnectBank onClick={onConnectBank} />}
    </div>
  );
}

/** "Connect your bank (demo)": the demo bank link, labelled a demo with sample data. */
function ConnectBank({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-md rounded-lg border-2 border-primary bg-surface p-md text-left">
      <span className="flex min-w-0 flex-1 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <span className="font-semibold">{bankDemo.entry.short}</span>
          <Tag className="border-primary font-bold text-primary">{bankDemo.badge}</Tag>
        </span>
        <span className="text-sm text-text-muted">{bankDemo.disclaimer}</span>
      </span>
      <Button variant="secondary" size="sm" onClick={onClick} data-testid="transactions-connect-bank">
        {bankDemo.entry.cta}
      </Button>
    </div>
  );
}

function GuidedLink({ links, Link }: { links: { upload: string }; Link: TransactionsScreenProps['Link'] }) {
  return (
    <span className="text-sm text-text-muted">
      {t.screen.importNoFile}{' '}
      <Link href={links.upload} className="font-semibold text-primary underline-offset-2 hover:underline">
        {t.screen.importGuided}
      </Link>
    </span>
  );
}

function ImportButton({ vm, label = t.import }: { vm: TransactionsVM; label?: string }) {
  const busy = vm.importState.status === 'reading';
  return (
    <label className={cx(buttonClassName(), 'cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus', busy && 'opacity-50')}>
      {busy ? t.importStates.reading : label}
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
  const tile = (id: string, value: string) => <span data-testid={`transactions-summary-${id}`}>{value}</span>;
  return (
    <KpiStrip
      data-testid="transactions-summary"
      aria-label={t.summaryLabel}
      items={[
        { id: 'count', label: t.summary.count, value: tile('count', String(vm.summary.count)) },
        { id: 'income', label: t.summary.income, dot: 'positive', tone: 'positive', value: tile('income', formatMoney(vm.summary.income)) },
        { id: 'spending', label: t.summary.spending, dot: 'c2', value: tile('spending', formatMoney(vm.summary.spending)) },
        ...(vm.summary.largest ? [{ id: 'largest', label: t.summary.largest, value: tile('largest', formatMoney(vm.summary.largest.amount)) }] : []),
      ]}
    />
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
      <Segmented
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
