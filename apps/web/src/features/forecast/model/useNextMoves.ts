// Next Moves shared by S1 and S10: engine rankMoves with the screen's rates, plus commit / done.
import { MOVE_LEVELS, movesLevel, rankMoves } from '@lifeguessr/engine';
import type { CostCategory, Move, MoveKind, Profile } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { track } from '@/lib/events';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import type { MoveTarget, MoveVM, NextMovesVM } from './types';

const LEVEL_2_KINDS = (Object.keys(MOVE_LEVELS) as MoveKind[]).filter((k) => MOVE_LEVELS[k] === 2);

/** The change a move's patch makes, for display (no math: values are read from the patch). */
export function moveTarget(move: Move): MoveTarget | null {
  const debt = move.patch.debts?.find((d) => d.extraPayment !== undefined);
  if (debt?.extraPayment !== undefined) return { kind: 'extraPayment', debtId: debt.id, monthly: debt.extraPayment };
  const spending = move.patch.spending ?? {};
  const category = move.category && spending[move.category] !== undefined
    ? move.category
    : (Object.keys(spending) as CostCategory[])[0];
  const monthly = category === undefined ? undefined : spending[category];
  return category !== undefined && monthly !== undefined ? { kind: 'spendingTo', category, monthly } : null;
}

export function toMoveVM(move: Move, p: Pick<Profile, 'committedMoveId'>): MoveVM {
  return { ...move, isCommitted: move.id === p.committedMoveId, target: moveTarget(move) };
}

export function useNextMoves(profile: Profile): NextMovesVM {
  const subscriptionsDetected = useAppStore((s) => s.subscriptionsDetected);
  const committedMove = useAppStore((s) => s.committedMove);
  const commitMove = useAppStore((s) => s.commitMove);
  const uncommit = useAppStore((s) => s.uncommitMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);

  const ranked = useMemo(
    () => runEngine(() => rankMoves(profile, { rates: areaRates(profile), subscriptionsDetected })),
    [profile, subscriptionsDetected],
  );

  const find = useCallback(
    (id: string): Move | undefined =>
      (ranked.status === 'ready' ? ranked.data.find((m) => m.id === id) : undefined) ??
      (committedMove?.id === id ? committedMove : undefined),
    [ranked, committedMove],
  );

  const commit = useCallback(
    (id: string) => {
      const move = find(id);
      if (!move) return;
      commitMove(move);
      track({ name: 'move_committed', props: { kind: move.kind } });
    },
    [find, commitMove],
  );
  const markDone = useCallback(
    (id: string) => {
      const move = find(id);
      if (move) markMoveDone(move);
    },
    [find, markMoveDone],
  );

  // Memoized so the list (and anything derived from it, like S10's comparison) keeps its identity
  // between renders while the ranking is unchanged.
  const committedMoveId = profile.committedMoveId;
  const moves: NextMovesVM['moves'] = useMemo(
    () =>
      ranked.status === 'ready'
        ? { status: 'ready', data: ranked.data.map((m) => toMoveVM(m, { committedMoveId })) }
        : ranked,
    [ranked, committedMoveId],
  );

  return { moves, level: movesLevel(profile), level2Kinds: LEVEL_2_KINDS, doneCount: profile.doneMoveIds.length, commit, uncommit, markDone };
}
