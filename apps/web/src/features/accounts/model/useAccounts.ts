// View-model of the Accounts screen (MP11, #171). Fixture-backed: reads the in-memory accounts
// (./accountsStore.ts, seeded from accounts.demo.json). No network.
// MP11b: swap the store for the real one (MP8) and the summary for `netWorthSummary`.
import { useCallback, useMemo, useState } from 'react';
import { downloadTextFile } from '@/lib/download';
import { usEasternDate } from '@/lib/dates';
import { useAccountsStore } from './accountsStore';
import { ACCOUNTS_CSV_FILE, accountsCsv, toGroups, toSummary } from './rows';
import { netWorthSeries, summarizeAccounts, withinPeriod } from './series';
import type { AccountPeriod, AccountsVM, SummaryMode } from './types';

/** `today` is 'YYYY-MM-DD' (default: today in US Eastern time); tests pass it. */
export function useAccounts({ today }: { today?: string } = {}): AccountsVM {
  const accounts = useAccountsStore((s) => s.accounts);
  const adding = useAccountsStore((s) => s.adding);
  const [period, setPeriod] = useState<AccountPeriod>('all');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('totals');
  const month = (today ?? usEasternDate()).slice(0, 7);

  // MP11b: wire to netWorthSummary (MP8).
  const summary = useMemo(() => summarizeAccounts(accounts, month), [accounts, month]);
  const chart = useMemo(() => withinPeriod(netWorthSeries(accounts, month), period, month), [accounts, month, period]);
  const groups = useMemo(() => toGroups(accounts, month), [accounts, month]);
  const bars = useMemo(() => toSummary(summary), [summary]);

  const add = useCallback(() => useAccountsStore.getState().setAdding(true), []);
  const refreshAll = useCallback(() => {
    // Manual accounts have nothing to refresh.
  }, []);
  const exportCsv = useCallback(() => downloadTextFile(ACCOUNTS_CSV_FILE, 'text/csv', accountsCsv(accounts)), [accounts]);

  return {
    ready: true,
    isEmpty: accounts.length === 0,
    netWorth: summary.netWorth,
    change1m: summary.change1m,
    period,
    setPeriod,
    chart,
    groups,
    summaryMode,
    setSummaryMode,
    summary: bars,
    canRefresh: false,
    adding,
    add,
    refreshAll,
    exportCsv,
  };
}
