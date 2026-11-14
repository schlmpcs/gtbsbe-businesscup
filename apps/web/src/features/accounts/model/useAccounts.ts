// View-model of the Accounts screen (MP11, #171). Reads the Accounts store (MP8, lib/model/accounts.ts);
// the totals, groups and the 1-month change are the engine's `netWorthSummary`. No network.
import { netWorthSummary } from '@lifeguessr/engine';
import { useCallback, useMemo, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { downloadTextFile } from '@/lib/download';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { useAccountsUiStore } from './accountsStore';
import { ACCOUNTS_CSV_FILE, accountsCsv, toGroups, toSummary } from './rows';
import { netWorthSeries, withinPeriod } from './series';
import type { AccountPeriod, AccountsVM, SummaryMode } from './types';

/** `today` is 'YYYY-MM-DD' (default: today in US Eastern time); tests pass it. */
export function useAccounts({ today }: { today?: string } = {}): AccountsVM {
  const ready = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const adding = useAccountsUiStore((s) => s.adding);
  const [period, setPeriod] = useState<AccountPeriod>('all');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('totals');
  const month = (today ?? usEasternDate()).slice(0, 7);

  const summary = useMemo(() => netWorthSummary(accounts), [accounts]);
  const chart = useMemo(() => withinPeriod(netWorthSeries(accounts, month), period, month), [accounts, month, period]);
  const groups = useMemo(() => toGroups(accounts), [accounts]);
  const bars = useMemo(() => toSummary(summary), [summary]);

  const add = useCallback(() => useAccountsUiStore.getState().setAdding(true), []);
  const refreshAll = useCallback(() => {
    // Manual accounts have nothing to refresh.
  }, []);
  const exportCsv = useCallback(() => downloadTextFile(ACCOUNTS_CSV_FILE, 'text/csv', accountsCsv(accounts)), [accounts]);

  return {
    ready,
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
