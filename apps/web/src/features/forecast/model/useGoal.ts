import { useMemo, useState } from 'react';
import {
  extraSavingToReach,
  goalStatus,
  movesTowardGoal,
  rankMoves,
} from '@lifeguessr/engine';
import { GoalSchema, type Goal } from '@lifeguessr/types';
import { useAppReady, useAppStore, useProfile } from '@/state';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import { track, useTrackOnce } from '@/lib/events';
import type { GoalVM } from './types';
const TARGET_PRESETS = [50_000, 100_000, 250_000, 500_000, 1_000_000];
const YEAR_PRESETS = [5, 10, 15, 20, 30];
/** Independent rules-only goal model; never uses or modifies the AI forecast bundle. */
export function useGoal(): GoalVM {
  const ready = useAppReady(),
    profile = useProfile(),
    goal = useAppStore((s) => s.goal);
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const [inputError, setInputError] = useState(false);
  const result = useMemo(
    () =>
      runEngine(() => {
        if (!goal) return null;
        const opts = { rates: areaRates(profile) };
        const moves = rankMoves(profile, { ...opts, subscriptionsDetected });
        return {
          status: goalStatus(profile, goal, opts),
          saving: extraSavingToReach(profile, goal, opts),
          moves: movesTowardGoal(profile, goal, moves, opts),
          moveLabels: moves,
        };
      }),
    [profile, goal, subscriptionsDetected],
  );
  const status = result.status === 'ready' ? result.data?.status : null;
  useTrackOnce(
    ready && !!status,
    `goal-verdict:${goal?.years}:${status?.verdict}`,
    {
      name: 'goal_verdict_shown',
      props: { verdict: status?.verdict ?? 'behind' },
    },
  );
  const setGoal = (next: Goal) => {
    const parsed = GoalSchema.safeParse(next);
    setInputError(!parsed.success);
    if (!parsed.success) return;
    useAppStore.getState().setGoal(parsed.data);
    track({ name: 'goal_set', props: { years: parsed.data.years } });
  };
  const clearGoal = () => {
    useAppStore.getState().clearGoal();
    setInputError(false);
    track({ name: 'goal_cleared' });
  };
  const data = result.status === 'ready' ? result.data : null;
  return {
    goal,
    setGoal,
    clearGoal,
    inputError,
    presets: { targets: TARGET_PRESETS, years: YEAR_PRESETS },
    moveLabels: data?.moveLabels ?? [],
    status: !ready
      ? { status: 'loading' }
      : result.status === 'error'
        ? result
        : { status: 'ready', data: data?.status ?? null },
    saving: !ready
      ? { status: 'loading' }
      : result.status === 'error'
        ? result
        : { status: 'ready', data: data?.saving ?? null },
    moves: !ready
      ? { status: 'loading' }
      : result.status === 'error'
        ? result
        : { status: 'ready', data: data?.moves ?? null },
  };
}
