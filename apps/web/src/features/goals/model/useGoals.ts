// View-model of the Goals screen, "Save up" side (MP11, #171). Fixture-backed: goals in ./goalsStore.ts,
// the status and the monthly saving from the engine's `goalStatus` and `extraSavingToReach` on the demo
// profile. The lines counted toward a goal are the ledger's (`LedgerTransaction.goalId`).
// MP11b: the real goals store, and the person's profile (accountsToProfile) instead of the demo one.
import { useCallback, useMemo, useState } from 'react';
import { extraSavingToReach, goalStatus } from '@lifeguessr/engine';
import { GoalSchema } from '@lifeguessr/types';
import { profileDemo } from '@/fixtures';
import { runEngine } from '@/lib/model/errors';
import type { Loadable } from '@/lib/model/types';
import { useAccountsStore } from '@/features/accounts/model/accountsStore';
import { newestFirst } from '@/features/transactions/model/ledger';
import { toRow } from '@/features/transactions/model/rows';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { useGoalsStore, type StoredGoal } from './goalsStore';
import type { GoalProjectionVM, GoalsVM, NewGoalInput, SaveUpGoalStatus } from './types';

const NAME_MAX = 60;

function project(goal: StoredGoal): Loadable<GoalProjectionVM> {
  return runEngine(() => {
    const target = { target: goal.target, years: goal.years };
    const status = goalStatus(profileDemo, target);
    const saving = extraSavingToReach(profileDemo, target);
    return {
      verdict: status.verdict,
      projected: status.projected,
      gap: status.gap,
      progress: status.progress,
      monthlyToStayOnTrack: saving.extraMonthly,
      reachable: saving.reachable,
    };
  });
}

export function useGoals(): GoalsVM {
  const goals = useGoalsStore((s) => s.goals);
  const transactions = useTransactionsStore((s) => s.transactions);
  const accounts = useAccountsStore((s) => s.accounts);
  const [inputError, setInputError] = useState(false);

  const goalVMs = useMemo(
    () =>
      goals.map((g) => {
        const counted = transactions.filter((t) => t.goalId === g.id);
        const saved = counted.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const completed = saved >= g.target;
        const projection: GoalsVM['goals'][number]['projection'] = completed ? { status: 'ready', data: null } : project(g);
        const status: SaveUpGoalStatus | null = completed
          ? 'completed'
          : projection.status === 'ready' && projection.data !== null
            ? projection.data.verdict === 'onTrack' ? 'onTrack' : 'atRisk'
            : null;
        return {
          id: g.id,
          name: g.name,
          target: g.target,
          years: g.years,
          saved,
          savedShare: saved / g.target,
          status,
          projection,
          transactions: counted.sort(newestFirst).map((t) => toRow(t, accounts)),
        };
      }),
    [goals, transactions, accounts],
  );

  const addGoal = useCallback((input: NewGoalInput): string | null => {
    const name = input.name.trim();
    const parsed = GoalSchema.safeParse({ target: input.target, years: input.years });
    if (name === '' || name.length > NAME_MAX || !parsed.success) {
      setInputError(true);
      return null;
    }
    setInputError(false);
    return useGoalsStore.getState().addGoal({ ...parsed.data, name });
  }, []);

  const allocate = useCallback((goalId: string, transactionId: string): boolean => {
    const known = useGoalsStore.getState().goals.some((g) => g.id === goalId);
    const line = useTransactionsStore.getState().transactions.some((t) => t.id === transactionId);
    if (!known || !line) return false;
    useTransactionsStore.getState().setGoal(transactionId, goalId);
    return true;
  }, []);

  const remove = useCallback((goalId: string) => {
    useGoalsStore.getState().removeGoal(goalId);
    useTransactionsStore.getState().clearGoal(goalId);
  }, []);

  return { ready: true, goals: goalVMs, inputError, addGoal, allocate, remove };
}
