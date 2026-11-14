// S1 Today: month-end card (engine monthEnd), You in 10 years (AI forecast, else rules), the
// committed / top move and the daily game call to action.
import { monthEnd, type CurrentMonth } from '@lifeguessr/engine';
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import { shownForecast } from './forecastAnswer';
import type { Loadable, MonthEndVM, MoveVM, TodayVM } from './types';
import { toMoveVM, useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];

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
  const { forecast } = nextMoves;
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

  // The 10-year number in today's dollars, from the answer (S10 can also show nominal; S1 never does).
  const shown = useMemo(() => shownForecast(forecast, true), [forecast]);

  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  // The committed move as ranked now (current number and label) when it is on the list, else as stored.
  const committed: MoveVM | null =
    committedMove && profile.committedMoveId === committedMove.id
      ? (rankedMoves.find((m) => m.id === committedMove.id) ?? toMoveVM(committedMove, profile, null))
      : null;

  const topMove: Loadable<MoveVM | null> =
    nextMoves.moves.status === 'ready' ? { status: 'ready', data: nextMoves.moves.data[0] ?? null } : nextMoves.moves;

  const played = cards.filter((c) => reveals[c.id]).length;

  return {
    status: ready ? 'ready' : 'loading',
    profileOrigin,
    isDemoProfile: profileOrigin === 'demo',
    monthEnd: monthEndVM,
    forecastStatus: shown.status,
    forecastError: shown.error,
    source: shown.source,
    in10y: shown.in10y,
    in10yBandIsZero: shown.band.isZero,
    in10yBandKind: shown.band.kind,
    isRefreshing: forecast.status === 'ready' && forecast.isRefreshing,
    committedMove: committed,
    markCommittedDone: () => {
      if (committedMove && !nextMoves.actionsDisabled) markMoveDone(committedMove);
    },
    actionsDisabled: nextMoves.actionsDisabled,
    topMove,
    game: { date: gameDate, played, total: cards.length, finished: cards.length > 0 && played === cards.length },
  };
}
