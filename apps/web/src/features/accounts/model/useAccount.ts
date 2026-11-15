// View-model of one account's page (MP11, #171). Reads and edits the Accounts store (MP8) and reads
// the ledger (MP10). `creditLimit` stays null: Account has none yet (packages/types).
import { useCallback, useMemo, useState } from 'react';
import { usEasternDate } from '@/lib/dates';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { addLine } from '@/features/transactions/model/addLine';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { newestFirst, toRow } from '@/features/transactions/model/rows';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { growthWords, parsePercent } from './addForm';
import { hasGrowthField, noteFor, rateText, useGrowthAiField, type AiFill, type GrowthAiInput } from './growthAi';
import { toAccountRow } from './rows';
import { balanceSeries, withinPeriod } from './series';
import type { AccountGrowthVM, AccountPeriod, AccountVM, NewTransactionInput } from './types';

export function useAccount(id: string, { today }: { today?: string } = {}): AccountVM {
  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const { lines, ready: ledgerReady } = useLedger();
  const goalLinks = useGoalLinks((s) => s.links);
  const [period, setPeriod] = useState<AccountPeriod>('all');
  const month = (today ?? usEasternDate()).slice(0, 7);
  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id]);

  const detail = useMemo(() => {
    if (!account) return null;
    const history = [...account.history].sort((a, b) => (a.month < b.month ? -1 : 1));
    return {
      ...toAccountRow(account),
      chart: withinPeriod(balanceSeries(account, month), period, month),
      summary: {
        group: account.group,
        creditLimit: null, // Account has no credit limit yet (packages/types).
        apr: account.apr ?? null,
        minPayment: account.minPayment ?? null,
        debtKind: account.debtKind ?? null,
        lastUpdated: history[history.length - 1]?.month ?? null,
        created: history[0]?.month ?? null,
        growth: hasGrowthField(account.group) ? { rate: account.growth ?? null, aiReason: account.growthNote?.reason ?? null } : null,
      },
      transactions: lines.filter((t) => t.accountId === id).sort(newestFirst).map((t) => toRow(t, accounts, goalLinks)),
    };
  }, [account, accounts, lines, goalLinks, id, month, period]);

  // The store marks a typed balance as measured, so `isEstimate` is not stored (MP11b blocked: no flag on `setBalance`).
  const editBalance = useCallback(
    (value: number, _isEstimate = false): boolean => {
      if (!Number.isFinite(value) || value < 0) return false;
      return useAccountsStore.getState().setBalance(id, value);
    },
    [id],
  );

  const rename = useCallback(
    (name: string): boolean => {
      if (name.trim() === '') return false;
      return useAccountsStore.getState().updateAccount(id, { name });
    },
    [id],
  );

  const exclude = useCallback(
    (excluded?: boolean) => {
      const current = useAccountsStore.getState().accounts.find((a) => a.id === id);
      if (current) useAccountsStore.getState().setExcluded(id, excluded ?? !current.excluded);
    },
    [id],
  );

  // The account's lines stay in the ledger; without the account they read as having none (`toRow`).
  const remove = useCallback(() => useAccountsStore.getState().removeAccount(id), [id]);

  const addTransaction = useCallback(
    (input: Omit<NewTransactionInput, 'accountId'>): string | null => addLine({ ...input, accountId: id }),
    [id],
  );

  // ----- Yearly change, with "Estimate with AI" (assets with that field) ------------------------------
  // The draft is what the field shows; null = not edited yet, so it follows the stored rate. `aiFill` is
  // what the AI wrote: the label (and the note saved) holds only while the text is unchanged.
  const [growthDraft, setGrowthDraft] = useState<string | null>(null);
  const [growthError, setGrowthError] = useState(false);
  const [aiFill, setAiFill] = useState<AiFill | null>(null);
  const storedText = account?.growth === undefined ? '' : rateText(account.growth);
  const growthText = growthDraft ?? storedText;
  const aiInput: GrowthAiInput | null = useMemo(
    () => (account && hasGrowthField(account.group) ? { group: account.group, name: account.name, value: account.balance.value } : null),
    [account],
  );
  const fill = useCallback((f: AiFill) => {
    setAiFill(f);
    setGrowthDraft(f.text);
    setGrowthError(false);
  }, []);
  const [growthAi] = useGrowthAiField(aiInput, fill);

  const setGrowthText = useCallback((text: string) => {
    setGrowthDraft(text);
    setGrowthError(false);
  }, []);
  const saveGrowth = useCallback((): boolean => {
    const rate = parsePercent(growthText);
    if (rate !== null && (Number.isNaN(rate) || rate < -1 || rate > 1)) {
      setGrowthError(true);
      return false;
    }
    const note = rate === null ? null : noteFor(aiFill, growthText);
    const ok = useAccountsStore.getState().updateAccount(id, { growth: rate, ...(note && { growthNote: note }) });
    setGrowthError(!ok);
    if (ok) setGrowthDraft(null);
    return ok;
  }, [growthText, aiFill, id]);

  const storedAiReason = account?.growthNote?.reason ?? null;
  const draftAiReason = noteFor(aiFill, growthText)?.reason ?? null;
  const growth = useMemo((): AccountGrowthVM | null => {
    if (!account || !hasGrowthField(account.group)) return null;
    const { placeholder, hint } = growthWords(account.group);
    return {
      text: growthText,
      setText: setGrowthText,
      placeholder,
      hint,
      error: growthError,
      // While the field shows the stored rate, the stored note labels it; after an AI fill, the fill does.
      aiReason: growthDraft === null ? storedAiReason : draftAiReason,
      save: saveGrowth,
      ai: growthAi,
    };
  }, [account, growthText, setGrowthText, growthError, growthDraft, storedAiReason, draftAiReason, saveGrowth, growthAi]);

  return {
    ready: accountsReady && ledgerReady,
    found: account !== undefined,
    account: detail,
    period,
    setPeriod,
    editBalance,
    rename,
    exclude,
    delete: remove,
    addTransaction,
    growth,
  };
}
