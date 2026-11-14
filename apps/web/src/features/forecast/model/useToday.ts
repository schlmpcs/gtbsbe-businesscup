// S1 Today: month-end card (engine monthEnd), You in N years (the AI forecast, else rules, at the
// horizon picked on S10), the committed / top move and the daily game call to action (the duel's
// progress by default, the slider game's with NEXT_PUBLIC_GAME_MODE=slider: the game /play serves).
import { monthEnd, monthEndHistoryMonths, type CurrentMonth } from '@lifeguessr/engine';
import { useMemo } from 'react';
import { readDuelDayProgress } from '@/features/game/model/duelProgress';
import { gameMode, type GameMode } from '@/lib/config';
import { localMonthDay, usEasternDate } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { isSampleActive, useAppReady, useAppStore, useGameStore } from '@/state';
import { shownForecast } from './forecastAnswer';
import type { Loadable, MonthEndVM, MoveVM, TodayVM } from './types';
import { toMoveVM, useNextMoves } from './useNextMoves';

const NO_MOVES: MoveVM[] = [];
const NO_HOMES: TodayVM['game']['homes'] = [];

export function useToday(opts: { now?: Date; mode?: GameMode } = {}): TodayVM {
  const mode = opts.mode ?? gameMode();
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const profileOrigin = useAppStore((s) => s.profileOrigin);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const committedMove = useAppStore((s) => s.committedMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);
  const isSample = useAppStore(isSampleActive);
  const isSampleFlag = useAppStore((s) => s.isSample);
  const selfGuess = useAppStore((s) => s.selfGuess);
  const gameDate = useGameStore((s) => s.date);
  const cards = useGameStore((s) => s.cards);
  const reveals = useGameStore((s) => s.reveals);
  const nextMoves = useNextMoves(profile);
  const { forecast, horizonYears } = nextMoves;
  const now = opts.now;

  const monthEndVM: Loadable<MonthEndVM> = useMemo(() => {
    // A statement month equal to this calendar month is the month in progress; the rest is history.
    const { month, day: today } = localMonthDay(now);
    const currentTotals = statementMonths.find((m) => m.month === month);
    const history = statementMonths.filter((m) => m.month < month);
    // The month so far is what the statement covers: up to its latest line, not up to today (days
    // after it have no data yet, and counting them would project the month too low). Saved data
    // from before `lastDay` existed falls back to today.
    const current: CurrentMonth | undefined = currentTotals
      ? { month, day: currentTotals.lastDay ?? today, totals: currentTotals.totals }
      : undefined;
    const r = runEngine(() => monthEnd(profile, history, current));
    if (r.status !== 'ready') return r;
    // monthEnd has no average either with too little history or without this month's rows (it
    // then returns the profile's monthly spend). Tell the two apart so the card asks for the
    // right thing.
    const noAverage =
      r.data.vsAverage !== null ? null : !current && history.length >= monthEndHistoryMonths.value ? 'thisMonth' : 'history';
    return {
      status: 'ready',
      data: {
        ...r.data,
        drifts: r.data.drifts.map((d) => ({ ...d })),
        historyMonths: history.length,
        noAverage,
        fromStatement: current !== undefined,
        month,
        asOfDay: current?.day ?? null,
        takeHome: { ...profile.takeHomePay },
      },
    };
  }, [profile, statementMonths, now]);

  // The number at the picked year in today's dollars, from the answer (S10 can also show nominal; S1 never does).
  const shown = useMemo(() => shownForecast(forecast, true, horizonYears), [forecast, horizonYears]);

  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  // The committed move as ranked now (current number and label) when it is on the list, else as stored.
  const committed: MoveVM | null =
    committedMove && profile.committedMoveId === committedMove.id
      ? (rankedMoves.find((m) => m.id === committedMove.id) ?? toMoveVM(committedMove, profile, null))
      : null;

  const topMove: Loadable<MoveVM | null> =
    nextMoves.moves.status === 'ready' ? { status: 'ready', data: nextMoves.moves.data[0] ?? null } : nextMoves.moves;

  // Today's duel progress lives in this browser's duel log (read once saved state is loaded, so the
  // server render and the first client render agree). S1 is its own page: a visit to /play and back
  // remounts this hook and reads it again.
  const duelDay = useMemo(
    () => (mode === 'duel' && ready ? readDuelDayProgress(usEasternDate(now ?? new Date())) : null),
    [mode, ready, now],
  );

  const game: TodayVM['game'] =
    mode === 'duel'
      ? {
          kind: 'duel',
          date: duelDay?.date ?? null,
          played: duelDay?.played ?? 0,
          total: duelDay?.total ?? 0,
          finished: duelDay?.finished ?? false,
          homes: NO_HOMES,
        }
      : {
          kind: 'slider',
          date: gameDate,
          played: cards.filter((c) => reveals[c.id]).length,
          total: cards.length,
          finished: cards.length > 0 && cards.every((c) => reveals[c.id]),
          homes: cards.map((c) => ({ id: c.id, metro: c.metro, played: Boolean(reveals[c.id]) })),
        };
  const played = game.played;
  // First visit: nothing of the user's yet (no profile, no guess, no statement, no move, no sample
  // asked for) and no round played. The screen then explains the app and shows no numbers.
  const firstVisit =
    ready &&
    profileOrigin === 'demo' &&
    !isSampleFlag &&
    selfGuess === null &&
    statementMonths.length === 0 &&
    committedMove === null &&
    profile.doneMoveIds.length === 0 &&
    played === 0 &&
    (mode === 'duel' || Object.keys(reveals).length === 0);

  return {
    status: ready ? 'ready' : 'loading',
    firstVisit,
    isSample,
    profileOrigin,
    isDemoProfile: profileOrigin === 'demo',
    monthEnd: monthEndVM,
    forecastStatus: shown.status,
    forecastError: shown.error,
    source: shown.source,
    horizonYears,
    horizonReady: nextMoves.horizonReady,
    atHorizon: shown.atHorizon,
    bandIsZero: shown.band.isZero,
    bandKind: shown.band.kind,
    isRefreshing: forecast.status === 'ready' && forecast.isRefreshing,
    committedMove: committed,
    markCommittedDone: () => {
      if (committedMove && !nextMoves.actionsDisabled) markMoveDone(committedMove);
    },
    actionsDisabled: nextMoves.actionsDisabled,
    topMove,
    game,
  };
}
