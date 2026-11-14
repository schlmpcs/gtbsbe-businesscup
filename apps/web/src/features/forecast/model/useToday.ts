// S1 Today: month-end card (engine monthEnd), You in 10 years, the committed / top move and the
// daily game call to action.
import { hasEstimates, monthEnd, type CurrentMonth } from '@lifeguessr/engine';
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { displayForecast } from '@/lib/model/profile';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import type { Loadable, MonthEndVM, MoveVM, TodayVM } from './types';
import { toMoveVM, useNextMoves } from './useNextMoves';

export function useToday(opts: { now?: Date } = {}): TodayVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const committedMove = useAppStore((s) => s.committedMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);
  const gameDate = useGameStore((s) => s.date);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);
  const nextMoves = useNextMoves(profile);
  const now = opts.now;

  const monthEndVM: Loadable<MonthEndVM> = useMemo(() => {
    // A statement month equal to this calendar month is the month in progress; the rest is history.
    const { month, day } = localMonthDay(now);
    const currentTotals = statementMonths.find((m) => m.month === month);
    const history = statementMonths.filter((m) => m.month < month);
    const current: CurrentMonth | undefined = currentTotals ? { month, day, totals: currentTotals.totals } : undefined;
    const r = runEngine(() => monthEnd(profile, history, current));
    if (r.status !== 'ready') return r;
    return {
      status: 'ready',
      data: {
        ...r.data,
        drifts: r.data.drifts.map((d) => ({ ...d })),
        historyMonths: history.length,
        fromStatement: current !== undefined,
        takeHome: { ...profile.takeHomePay },
      },
    };
  }, [profile, statementMonths, now]);

  const in10y = useMemo(() => displayForecast(profile).in10y, [profile]);

  const committed: MoveVM | null =
    committedMove && profile.committedMoveId === committedMove.id ? toMoveVM(committedMove, profile) : null;

  const topMove: Loadable<MoveVM | null> =
    nextMoves.moves.status === 'ready' ? { status: 'ready', data: nextMoves.moves.data[0] ?? null } : nextMoves.moves;

  const played = cards.filter((c) => reveals[c.id]).length;

  return {
    status: ready ? 'ready' : 'loading',
    profileOrigin,
    isDemoProfile: profileOrigin === 'demo',
    monthEnd: monthEndVM,
    in10y,
    in10yBandIsZero: !hasEstimates(profile),
    committedMove: committed,
    markCommittedDone: () => {
      if (committedMove) markMoveDone(committedMove);
    },
    topMove,
    game: { date: gameDate, played, total: cards.length, finished: cards.length > 0 && played === cards.length },
  };
}
