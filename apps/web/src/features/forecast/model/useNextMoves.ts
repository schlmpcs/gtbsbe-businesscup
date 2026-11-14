// Next Moves shared by S1 and S10: engine rankMoves with the screen's rates, plus commit / done.
import { movesLevel, rankMoves } from '@lifeguessr/engine';
import type { Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import { useAppStore } from '@/state';
import type { MoveVM, NextMovesVM } from './types';

export function toMoveVM(move: Move, p: Pick<Profile, 'committedMoveId'>): MoveVM {
  return { ...move, isCommitted: move.id === p.committedMoveId };
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
      if (move) commitMove(move);
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

  const moves: NextMovesVM['moves'] =
    ranked.status === 'ready' ? { status: 'ready', data: ranked.data.map((m) => toMoveVM(m, profile)) } : ranked;

  return { moves, level: movesLevel(profile), doneCount: profile.doneMoveIds.length, commit, uncommit, markDone };
}
