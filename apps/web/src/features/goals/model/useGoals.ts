// View-model of the Goals screen, "Save up" side (MP11, #171). Goals are the person's own, kept in this
// browser (./goalsStore.ts); the status and the monthly saving are the engine's `goalStatus` and
// `extraSavingToReach` on the person's profile (kept in line with their accounts). The lines counted
// toward a goal are the ledger's (a line made with a goal, or one allocated later: ../../transactions/model/goalLinks.ts).
import { useCallback, useMemo, useState } from 'react';
import { extraSavingToReach, goalStatus } from '@lifeguessr/engine';
import { GoalSchema } from '@lifeguessr/types';
import type { Profile } from '@lifeguessr/types';
import { useAccountsReady, useAccountsStore } from '@/lib/model/accounts';
import { runEngine } from '@/lib/model/errors';
import type { Loadable } from '@/lib/model/types';
import { useProfile } from '@/state/profile';
import { usePersistedReady } from '@/features/dashboard/model/persisted';
import { useGoalLinks } from '@/features/transactions/model/goalLinks';
import { newestFirst, toRow } from '@/features/transactions/model/rows';
import { ledger, useLedger } from '@/features/transactions/model/transactionsStore';
import { useGoalsStore, type StoredGoal } from './goalsStore';
import type { GoalProjectionVM, GoalsVM, NewGoalInput, SaveUpGoalStatus } from './types';

const NAME_MAX = 60;

function project(goal: StoredGoal, profile: Profile): Loadable<GoalProjectionVM> {
  return runEngine(() => {
    const target = { target: goal.target, years: goal.years };
    const status = goalStatus(profile, target);
    const saving = extraSavingToReach(profile, target);
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
  const goalsReady = usePersistedReady(useGoalsStore);
  const goalLinks = useGoalLinks((s) => s.links);
  const linksReady = usePersistedReady(useGoalLinks);
  const { lines, ready: ledgerReady } = useLedger();
  const accountsReady = useAccountsReady();
  const accounts = useAccountsStore((s) => s.accounts);
  const profile = useProfile();
  const [inputError, setInputError] = useState(false);

  const goalVMs = useMemo(
    () =>
      goals.map((g) => {
        const counted = lines.filter((t) => (t.goalId ?? goalLinks[t.id]) === g.id);
        const saved = counted.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const completed = saved >= g.target;
        const projection: GoalsVM['goals'][number]['projection'] = completed ? { status: 'ready', data: null } : project(g, profile);
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
          transactions: counted.sort(newestFirst).map((t) => toRow(t, accounts, goalLinks)),
        };
      }),
    [goals, lines, goalLinks, accounts, profile],
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
    const line = ledger().list().some((t) => t.id === transactionId);
    if (!known || !line) return false;
    useGoalLinks.getState().link(transactionId, goalId);
    return true;
  }, []);

  const remove = useCallback((goalId: string) => {
    useGoalsStore.getState().removeGoal(goalId);
    useGoalLinks.getState().unlinkGoal(goalId);
  }, []);

  return { ready: goalsReady && linksReady && ledgerReady && accountsReady, goals: goalVMs, inputError, addGoal, allocate, remove };
}
