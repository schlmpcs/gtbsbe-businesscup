// S1 Today: month-end card (engine monthEnd), You in 10 years (AI forecast, else rules), the
// committed / top move and the daily game call to action.
import { hasEstimates, monthEnd, type CurrentMonth } from '@lifeguessr/engine';
import type { Forecast, ForecastPoint } from '@lifeguessr/types';
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { useAppReady, useAppStore, useGameStore } from '@/state';
import type { BandKind, Loadable, MonthEndVM, MoveVM, TodayVM } from './types';
import { answerDollars } from './useForecastBundle';
import { toMoveVM, useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];
/** Shown until the first forecast arrives: the card shows a skeleton, not this. */
const NO_IN10Y: ForecastPoint = { month: 120, low: 0, mid: 0, high: 0 };

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
  const base: Loadable<Forecast> | null = useMemo(() => {
    if (forecast.status !== 'ready') return null;
    const { answer } = forecast;
    return runEngine(() => answerDollars(answer, true)(answer.bundle.base));
  }, [forecast]);
  const in10y = base?.status === 'ready' ? base.data.in10y : NO_IN10Y;

  const source = forecast.status === 'ready' ? forecast.source : null;
  const in10yBandKind: BandKind = source === 'ai' ? 'model' : 'inputs';
  const failure = forecast.status === 'error' ? forecast.error : base?.status === 'error' ? base.error : null;

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
    forecastStatus: failure ? 'error' : base?.status === 'ready' ? 'ready' : 'loading',
    forecastError: failure,
    source,
    in10y,
    in10yBandIsZero: source === 'ai' ? in10y.high - in10y.low < 1 : !hasEstimates(profile),
    in10yBandKind,
    committedMove: committed,
    markCommittedDone: () => {
      if (committedMove) markMoveDone(committedMove);
    },
    topMove,
    game: { date: gameDate, played, total: cards.length, finished: cards.length > 0 && played === cards.length },
  };
}
