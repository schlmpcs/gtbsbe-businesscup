// JF7, S9 "We found": the paychecks and debts the engine found in the statement just read
// (readStatementFile → statementFindings, in memory), each to confirm or dismiss. The person does
// the least hand work: a paycheck is one tap, a debt one tap plus its balance (the one number a
// statement can't show). Nothing is invented here: take-home pay is the sum of the confirmed
// paychecks' monthly amounts and a debt's payment is the measured one, both from the engine; the
// APR is the kind's typical rate from the engine's sourced assumption, saved tagged as an estimate.
//
// Only numbers and kinds reach the profile (and so the saved session): no payer or lender name.
import type { Money } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { BALANCE_FIELD_BOUNDS, DEBT_BOUNDS } from '@/features/ladder/model/constants';
import { useAppReady, useAppStore } from '@/state';
import { decideFinding, useStatementFindingsStore } from './statementFindings';
import type { FindingStatus, StatementFindingsVM } from './types';

const within = (v: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, v));

export function useStatementFindings(): StatementFindingsVM {
  const ready = useAppReady();
  const findings = useStatementFindingsStore((s) => s.findings);
  const decisions = useStatementFindingsStore((s) => s.decisions);
  const setField = useAppStore((s) => s.setField);
  const addDebt = useAppStore((s) => s.addDebt);

  const statusOf = useCallback((id: string): FindingStatus => decisions[id] ?? 'pending', [decisions]);

  const income = useMemo(
    () => (findings?.income ?? []).map((f) => ({ ...f, status: statusOf(f.id) })),
    [findings, statusOf],
  );
  const debts = useMemo(
    () => (findings?.debts ?? []).map((f) => ({ ...f, aprSource: { ...f.aprSource }, status: statusOf(f.id) })),
    [findings, statusOf],
  );

  /** Sum of the confirmed paychecks, in cents so 4,333.33 + 5,000 stays exact. */
  const takeHomeOf = useCallback(
    (confirmed: ReadonlySet<string>): Money | null => {
      const chosen = (findings?.income ?? []).filter((f) => confirmed.has(f.id));
      if (chosen.length === 0) return null;
      return chosen.reduce((cents, f) => cents + Math.round(f.monthly * 100), 0) / 100;
    },
    [findings],
  );

  const confirmedIds = useMemo(
    () => new Set(Object.entries(decisions).filter(([, d]) => d === 'confirmed').map(([id]) => id)),
    [decisions],
  );

  const confirmIncome = useCallback(
    (id: string) => {
      const finding = findings?.income.find((f) => f.id === id);
      if (!finding || statusOf(id) !== 'pending') return;
      decideFinding(id, 'confirmed');
      // Take-home pay is all the paychecks confirmed from this statement together (two earners are
      // two findings), not just the latest one; typed by the person in effect, so measured.
      const total = takeHomeOf(new Set([...confirmedIds, id]))!;
      setField('takeHomePay', within(total, BALANCE_FIELD_BOUNDS.takeHomePay));
    },
    [findings, statusOf, takeHomeOf, confirmedIds, setField],
  );

  const confirmDebt = useCallback(
    (id: string, balance: Money) => {
      const finding = findings?.debts.find((f) => f.id === id);
      if (!finding || statusOf(id) !== 'pending' || !Number.isFinite(balance)) return;
      decideFinding(id, 'confirmed');
      addDebt({
        kind: finding.kind,
        balance: within(balance, DEBT_BOUNDS.balance),
        apr: within(finding.apr, DEBT_BOUNDS.apr),
        aprIsEstimate: true,
        // The payment seen in the statement is the person's own: kept as measured.
        minPayment: within(finding.monthlyPayment, DEBT_BOUNDS.minPayment),
      });
    },
    [findings, statusOf, addDebt],
  );

  const dismiss = useCallback(
    (id: string) => {
      if (statusOf(id) === 'pending') decideFinding(id, 'dismissed');
    },
    [statusOf],
  );

  const status: StatementFindingsVM['status'] =
    !ready || findings === null ? 'hidden' : income.length + debts.length === 0 ? 'none' : 'found';

  return {
    status,
    income,
    debts,
    confirmedTakeHome: takeHomeOf(confirmedIds),
    balanceBounds: DEBT_BOUNDS.balance,
    confirmIncome,
    dismissIncome: dismiss,
    confirmDebt,
    dismissDebt: dismiss,
  };
}
