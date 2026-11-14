// S14 Monthly check-in, all from the engine:
// - Your month: the latest statement month against the 3 full months before it (engine monthEnd:
//   projection, vs 3-month average, drift flags). Reads the user's uploads, or the sample
//   statement's months (fixture, labelled) when there are none.
// - Your move: progress on the committed move (engine simulate / applyPatch), then "I did it" (its
//   patch enters the profile, as on S1) or "not yet"; with no committed move, pick one of the ranked
//   moves (engine rankMoves through useNextMoves).
// Nothing is saved besides what the store's existing actions save (commit, done): it is a preview.
import { applyPatch, forecastMonths, monthEnd, movesLevel, simulate, type CurrentMonth } from '@lifeguessr/engine';
import type { CategoryTotals, CostCategory, MonthEnd, Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { DRIFT_HISTORY_MONTHS } from '@/features/ladder/model/useStatementUpload';
import { moveTarget, toMoveVM, useNextMoves } from '@/features/forecast/model/useNextMoves';
import { statementTotalsSample } from '@/fixtures';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, usePro } from '@/state';
import type {
  CheckinCompareVM, CheckinDataSource, CheckinMonthVM, CheckinMoveAnswer, CheckinVM, MoveProgressVM, MoveVM,
} from './types';

/** Categories that get a tile on the check-in (drifted ones first, the rest as "on track"). */
export const TILE_CATEGORIES: readonly CostCategory[] = ['eatingOut', 'subscriptions', 'groceries', 'car'];

/** Days in a 'YYYY-MM' month (calendar arithmetic, not money math). */
export function daysInMonth(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

/** The month after a 'YYYY-MM' month. */
export function nextMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m!, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type CheckinMonthInputs = {
  /** The latest statement month, under review; null when there are none. */
  latest: CategoryTotals | null;
  inProgress: boolean;
  /** The months before it, oldest first. */
  history: CategoryTotals[];
  thisMonth: CurrentMonth | undefined;
};

/**
 * What monthEnd gets for a check-in: the latest statement month is the month under review. If it is
 * the current calendar month it is in progress (projected from `today.day`), otherwise it is over
 * (day = its last day, so the projection is what was spent). Earlier months are the history.
 */
export function checkinMonthInputs(months: readonly CategoryTotals[], today: { month: string; day: number }): CheckinMonthInputs {
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  if (!latest) return { latest: null, inProgress: false, history: [], thisMonth: undefined };
  const inProgress = latest.month === today.month;
  const day = inProgress ? today.day : daysInMonth(latest.month);
  return {
    latest,
    inProgress,
    history: sorted.filter((m) => m.month < latest.month),
    thisMonth: { month: latest.month, day, totals: latest.totals },
  };
}

/** The headline numbers, once monthEnd has an average. */
export function compareOf(m: MonthEnd): CheckinCompareVM | null {
  if (m.vsAverage === null) return null;
  const drifted = new Set(m.drifts.map((d) => d.category));
  return {
    projected: m.projectedSpend,
    average: m.projectedSpend - m.vsAverage,
    difference: m.vsAverage,
    direction: Math.round(m.vsAverage) === 0 ? 'even' : m.vsAverage > 0 ? 'over' : 'under',
    drifts: m.drifts.map((d) => ({ category: d.category, delta: d.delta })),
    onTrack: TILE_CATEGORIES.filter((c) => !drifted.has(c)),
  };
}

/** Progress on a committed move: the card this month and its payoff, or the category against its target. */
export function moveProgress(
  p: Profile,
  move: Move,
  review: { latest: CategoryTotals | null; inProgress: boolean; source: CheckinDataSource },
): MoveProgressVM | null {
  const target = moveTarget(move);
  if (!target) return null;
  if (target.kind === 'extraPayment') {
    const months = forecastMonths(10);
    const rates = areaRates(p);
    const without = simulate(p, months, { rates });
    const withMove = simulate(applyPatch(p, move.patch), months, { rates });
    const balance = withMove.path[0]!.debts[target.debtId] ?? 0;
    const paidThisMonth = Math.max(0, balance - (withMove.path[1]!.debts[target.debtId] ?? 0));
    return {
      kind: 'cardPayoff',
      debtId: target.debtId,
      balance,
      paidThisMonth,
      share: balance > 0 ? paidThisMonth / balance : 1,
      payoffMonthWith: withMove.payoffMonth[target.debtId] ?? null,
      payoffMonthWithout: without.payoffMonth[target.debtId] ?? null,
    };
  }
  // Only the user's own finished month says what they actually spent (not the sample, not a partial month).
  const actual =
    review.source === 'uploads' && review.latest && !review.inProgress ? (review.latest.totals[target.category] ?? 0) : null;
  return {
    kind: 'spendingTarget',
    category: target.category,
    target: target.monthly,
    planned: p.spending[target.category].value,
    actual,
    onTrack: actual === null ? null : actual <= target.monthly,
  };
}

export function useCheckin(opts: { now?: Date } = {}): CheckinVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const committedMove = useAppStore((s) => s.committedMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);
  const nextMoves = useNextMoves(profile);
  const isPro = usePro().isPro;

  const [chosenSource, setChosenSource] = useState<CheckinDataSource | null>(null);
  const [answer, setAnswer] = useState<CheckinMoveAnswer>('none');
  const [doneMove, setDoneMove] = useState<MoveVM | null>(null);

  const hasUploads = statementMonths.length > 0;
  // Uploads by default once there are any; the sample otherwise (and whenever the user picks it).
  const source: CheckinDataSource = hasUploads ? (chosenSource ?? 'uploads') : 'sample';

  const { month: todayMonth, day: todayDay } = localMonthDay(opts.now);
  const review = useMemo(
    () => checkinMonthInputs(source === 'uploads' ? statementMonths : statementTotalsSample, { month: todayMonth, day: todayDay }),
    [source, statementMonths, todayMonth, todayDay],
  );

  const month: CheckinMonthVM = useMemo(
    () => ({
      source,
      hasUploads,
      month: review.latest?.month ?? null,
      inProgress: review.inProgress,
      nextStatementMonth: review.latest ? nextMonth(review.latest.month) : todayMonth,
      historyMonths: review.history.length,
      historyNeeded: DRIFT_HISTORY_MONTHS,
      result: runEngine(() => monthEnd(profile, review.history, review.thisMonth)),
    }),
    [profile, review, source, hasUploads, todayMonth],
  );

  const compare = useMemo(() => (month.result.status === 'ready' ? compareOf(month.result.data) : null), [month]);

  const committedMoveId = profile.committedMoveId;
  const committed: MoveVM | null = useMemo(
    () => (committedMove && committedMoveId === committedMove.id ? toMoveVM(committedMove, { committedMoveId }) : null),
    [committedMove, committedMoveId],
  );

  const progress: Loadable<MoveProgressVM | null> | null = useMemo(
    () => (committed ? runEngine(() => moveProgress(profile, committed, { ...review, source })) : null),
    [committed, profile, review, source],
  );

  const markDone = useCallback(() => {
    if (!committedMove) return;
    setDoneMove(toMoveVM(committedMove, profile));
    markMoveDone(committedMove);
    setAnswer('done');
  }, [committedMove, profile, markMoveDone]);

  const { commit: commitMove } = nextMoves;
  const commit = useCallback(
    (id: string) => {
      commitMove(id);
      setAnswer('none');
    },
    [commitMove],
  );

  return {
    status: ready ? 'ready' : 'loading',
    month,
    setSource: setChosenSource,
    compare,
    move: {
      committed,
      progress,
      suggestions: nextMoves.moves,
      answer,
      doneMove,
      level: movesLevel(profile),
      commit,
      markDone,
      keepGoing: () => setAnswer('keepGoing'),
    },
    uploadHref: SCREEN_ROUTES.S9,
    movesHref: SCREEN_ROUTES.S10,
    pro: { isPro, href: SCREEN_ROUTES.S15 },
  };
}
