// Where the subscription audit meets the pieces that are not part of it (M5, issue #81).
//
// `useSubscriptions(profile, deps)` takes what it needs from outside, so it can be built and tested on
// fakes (apps/web/src/test/subscriptions.ts). This file connects the real ones:
//   - `catalogue`   the known services (M4, `knownServices` of @lifeguessr/data/subscriptions)
//   - `store`       the tool's slice of the app store (M2): `tools.subscriptions`, `setTool`, `clearTool`
//   - `importedStatement` a statement already read on this page (S9), taken once (features/upload)
//   - `ledger`      the person's Transactions (the same lines Recurring reads), audited when newer than the findings
//   - `track`, `trackTool`, `categorize`, `downloadRenewals`: the hook's own defaults (lib/events, lib/api/statement, lib/download)
import { knownServices } from '@lifeguessr/data/subscriptions';
import { useCallback, useMemo } from 'react';
import { takeStatementRead } from '@/features/upload/model/lastStatementRead';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { recurringInput, type StoredTransaction } from '@/lib/model/transactions';
import { useAppStore } from '@/state';
import type { SubscriptionsStore, SubscriptionsToolState } from './state';
import type { LedgerForAudit, SubscriptionsDeps } from './useSubscriptions';

/**
 * The ledger's lines as the audit reads them: the same `recurringInput` Recurring feeds the detector,
 * with each label's class as the categorizer (or the person) set it. Null read when there are no lines.
 */
export function ledgerForAudit(lines: readonly StoredTransaction[], ready: boolean): LedgerForAudit {
  if (lines.length === 0) return { ready, read: null, latest: null };
  const { items } = recurringInput(lines);
  const classes = new Map<string, StoredTransaction['cls']>();
  for (const line of [...lines].sort((a, b) => a.date.localeCompare(b.date))) classes.set(line.label, line.cls);
  const latest = lines.reduce((max, l) => (l.date > max ? l.date : max), lines[0]!.date);
  return { ready, read: { items, classes: [...classes].map(([label, cls]) => ({ label, class: cls })) }, latest };
}

/** Everything `useSubscriptions` needs from outside, connected to the real catalogue and the app store. */
export function useSubscriptionsDeps(): SubscriptionsDeps {
  const state = useAppStore((s) => s.tools.subscriptions);
  const setTool = useAppStore((s) => s.setTool);
  const clearTool = useAppStore((s) => s.clearTool);
  const save = useCallback((next: SubscriptionsToolState) => setTool('subscriptions', next), [setTool]);
  const clear = useCallback(() => clearTool('subscriptions'), [clearTool]);
  // One object while the saved state is the same, so nothing built from it rebuilds on every render.
  const store: SubscriptionsStore = useMemo(() => ({ state, save, clear }), [state, save, clear]);
  const { lines, ready } = useLedger();
  const ledger = useMemo(() => ledgerForAudit(lines, ready), [lines, ready]);
  return useMemo(() => ({ catalogue: knownServices, store, importedStatement: takeStatementRead, ledger }), [store, ledger]);
}
