// View-model of one account's page (MP11, #171). Fixture-backed (see ./accountsStore.ts).
// MP11b: swap the stores for the real ones (MP8/MP10); needs `creditLimit` on Account for the summary.
import { useCallback, useMemo, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { filterTransactions, NO_FILTERS, toRow } from '@/features/transactions/model/rows';
import { validNewTransaction } from '@/features/transactions/model/validate';
import { useAccountsStore } from './accountsStore';
import { toAccountRow } from './rows';
import { balanceSeries, withinPeriod } from './series';
import type { AccountPeriod, AccountVM, NewTransactionInput } from './types';

export function useAccount(id: string, { today }: { today?: string } = {}): AccountVM {
  const accounts = useAccountsStore((s) => s.accounts);
  const transactions = useTransactionsStore((s) => s.transactions);
  const [period, setPeriod] = useState<AccountPeriod>('all');
  const month = (today ?? usEasternDate()).slice(0, 7);
  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id]);

  const detail = useMemo(() => {
    if (!account) return null;
    const history = [...account.history].sort((a, b) => (a.month < b.month ? -1 : 1));
    const lines = filterTransactions(transactions, { ...NO_FILTERS, accountId: id });
    return {
      ...toAccountRow(account, month),
      chart: withinPeriod(balanceSeries(account, month), period, month),
      summary: {
        group: account.group,
        creditLimit: null, // MP11b: Account has no credit limit yet (packages/types).
        apr: account.apr ?? null,
        minPayment: account.minPayment ?? null,
        debtKind: account.debtKind ?? null,
        lastUpdated: history[history.length - 1]?.month ?? null,
        created: history[0]?.month ?? null,
      },
      transactions: lines.map((t) => toRow(t, accounts)),
    };
  }, [account, accounts, transactions, id, month, period]);

  const editBalance = useCallback(
    (value: number, isEstimate = false): boolean => {
      if (!Number.isFinite(value) || value < 0) return false;
      useAccountsStore.getState().updateAccount(id, (a) => ({
        ...a,
        balance: { value, isEstimate },
        // One point per month, the last edit wins.
        history: [...a.history.filter((p) => p.month !== month), { month, balance: value }].sort((x, y) => (x.month < y.month ? -1 : 1)),
      }));
      return true;
    },
    [id, month],
  );

  const rename = useCallback(
    (name: string): boolean => {
      const trimmed = name.trim();
      if (trimmed === '') return false;
      useAccountsStore.getState().updateAccount(id, (a) => ({ ...a, name: trimmed }));
      return true;
    },
    [id],
  );

  const exclude = useCallback(
    (excluded?: boolean) => useAccountsStore.getState().updateAccount(id, (a) => ({ ...a, excluded: excluded ?? !a.excluded })),
    [id],
  );

  const remove = useCallback(() => {
    useAccountsStore.getState().removeAccount(id);
    useTransactionsStore.getState().removeAccountLinks(id);
  }, [id]);

  const addTransaction = useCallback(
    (input: Omit<NewTransactionInput, 'accountId'>): string | null => {
      const valid = validNewTransaction({ ...input, accountId: id });
      return valid === null ? null : useTransactionsStore.getState().addTransaction(valid);
    },
    [id],
  );

  return { ready: true, found: account !== undefined, account: detail, period, setPeriod, editBalance, rename, exclude, delete: remove, addTransaction };
}
