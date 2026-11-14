'use client';

// Under the chart: tabs Events / Cash flow / Accounts (usePlan → tables) and the "Add event" catalog
// (useEventCatalog). The tables arrive formatted; this file only lays them out.
import { useState } from 'react';
import { plan as copy } from '@/copy';
import { Button, Card, Sheet, Tabs, cx } from '@/ui-kit';
import type {
  EventCatalogVM, PlanAccountsTableVM, PlanCashFlowTableVM, PlanEventRowVM,
} from '../model/types';
import { EventIcon } from './EventIcon';

type TabId = 'events' | 'cashFlow' | 'accounts';

export type PlanDetailsProps = {
  events: readonly PlanEventRowVM[];
  cashFlow: PlanCashFlowTableVM;
  accounts: PlanAccountsTableVM;
  catalog: EventCatalogVM;
};

const TH = 'px-md py-sm font-medium whitespace-nowrap';
const TD = 'px-md py-xs whitespace-nowrap';

export function PlanDetails({ events, cashFlow, accounts, catalog }: PlanDetailsProps) {
  const t = copy.screen;
  const [tab, setTab] = useState<TabId>('events');
  const [catalogOpen, setCatalogOpen] = useState(false);

  return (
    <Card
      title={t.tabs.label}
      action={
        <Button size="sm" onClick={() => setCatalogOpen(true)}>
          {t.events.add}
        </Button>
      }
    >
      <Tabs<TabId>
        label={t.tabs.label}
        value={tab}
        onValueChange={setTab}
        tabs={[
          { id: 'events', label: t.tabs.events, panel: <EventList events={events} onOpen={catalog.openEditor} /> },
          { id: 'cashFlow', label: t.tabs.cashFlow, panel: <CashFlowTable table={cashFlow} /> },
          { id: 'accounts', label: t.tabs.accounts, panel: <AccountsTable table={accounts} /> },
        ]}
      />

      <Sheet open={catalogOpen} onClose={() => setCatalogOpen(false)} title={t.events.catalogTitle} description={t.events.catalogIntro}>
        <ul className="grid gap-sm sm:grid-cols-2">
          {catalog.entries.map((e) => (
            <li key={e.type}>
              <button
                type="button"
                disabled={!e.enabled}
                onClick={() => {
                  setCatalogOpen(false);
                  catalog.add(e.type);
                }}
                className={cx(
                  'flex h-full min-h-11 w-full items-start gap-md rounded-md border border-border bg-bg p-md text-left',
                  'hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <span className="mt-xs flex size-2xl shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <EventIcon id={e.icon} />
                </span>
                <span className="flex min-w-0 flex-col gap-xs">
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-sm text-text-muted">{e.enabled ? e.description : t.events.onlyOne}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </Card>
  );
}

function EventList({ events, onOpen }: { events: readonly PlanEventRowVM[]; onOpen: (id: string) => void }) {
  const t = copy.screen.events;
  if (events.length === 0) return <p className="text-sm text-text-muted">{t.empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {events.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onOpen(e.id)}
            aria-label={t.edit(e.name ?? e.title)}
            className={cx(
              'flex min-h-11 w-full items-center gap-md py-md text-left hover:bg-surface-strong',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              !e.enabled && 'opacity-50',
            )}
          >
            <span className="flex size-2xl shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <EventIcon id={e.icon} />
            </span>
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

function CashFlowTable({ table }: { table: PlanCashFlowTableVM }) {
  const c = copy.tables.cashFlow;
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 bg-surface-strong text-left text-xs text-text-muted">
          <tr>
            <th scope="col" className={TH}>{c.year}</th>
            <th scope="col" className={TH}>{c.age}</th>
            <th scope="col" className={cx(TH, 'text-right')}>{c.income}</th>
            <th scope="col" className={cx(TH, 'text-right')}>{c.expenses}</th>
            <th scope="col" className={cx(TH, 'text-right')}>{c.withdrawals}</th>
            <th scope="col" className={cx(TH, 'text-right')}>{c.net}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.year} className="border-t border-border">
              <td className={TD}>{r.year}</td>
              <td className={TD}>{r.age}</td>
              <td className={cx(TD, 'text-right')}>{r.incomeLabel}</td>
              <td className={cx(TD, 'text-right')}>{r.expensesLabel}</td>
              <td className={cx(TD, 'text-right')}>{r.withdrawalsLabel}</td>
              <td className={cx(TD, 'text-right font-semibold', r.netTone === 'bad' ? 'text-negative' : 'text-positive')}>{r.netLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountsTable({ table }: { table: PlanAccountsTableVM }) {
  const a = copy.tables.accounts;
  return (
    <div className="flex flex-col gap-xs">
      <p className="text-xs text-text-muted sm:hidden">{copy.screen.tables.scrollHint}</p>
      <div className="max-h-96 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-surface-strong text-left text-xs text-text-muted">
            <tr>
              <th scope="col" className={TH}>{a.year}</th>
              <th scope="col" className={TH}>{a.age}</th>
              {table.columns.map((col) => (
                <th key={col.accountId} scope="col" className={cx(TH, 'text-right')}>
                  <span className="block text-text">{col.name}</span>
                  <span className="block">{col.groupLabel}</span>
                </th>
              ))}
              <th scope="col" className={cx(TH, 'text-right')}>{copy.screen.tables.netWorth}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.year} className={cx('border-t border-border', r.isRetirementYear && 'bg-primary-soft')}>
                <td className={TD}>{r.year}</td>
                <td className={TD}>{r.age}</td>
                {table.columns.map((col) => (
                  <td key={col.accountId} className={cx(TD, 'text-right')}>
                    {r.cells[col.accountId]?.end ?? '—'}
                  </td>
                ))}
                <td className={cx(TD, 'text-right font-semibold')}>{r.netWorthLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
