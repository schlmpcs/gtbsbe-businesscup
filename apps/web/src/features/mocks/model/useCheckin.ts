// S14 Monthly check-in: three steps over the engine.
//   1. Your month: the latest statement month against the average of the months before it
//      (engine monthEnd: projection, vs 3-month average, drift flags). Reads the user's uploads, or
//      the sample statement's months (fixture, labelled) when there are none.
//   2. Your move: progress on the committed move (engine simulate / applyPatch), then "did it" (its
//      patch enters the profile, as on S1) or "keep going"; with no committed move, pick one
//      (engine rankMoves through useNextMoves).
//   3. Your 10 years: the forecast after this check-in, with the committed move as a second line.
// Nothing is saved besides what the existing store actions save (commit, done): it is a preview.
import { applyPatch, forecast, forecastMonths, hasEstimates, monthEnd, movesLevel, simulate, type CurrentMonth } from '@lifeguessr/engine';
import type { CategoryTotals, Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { DRIFT_HISTORY_MONTHS } from '@/features/ladder/model/useStatementUpload';
import { moveTarget, toMoveVM, useNextMoves } from '@/features/forecast/model/useNextMoves';
import { statementTotalsSample } from '@/fixtures';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { areaRates, displayForecast } from '@/lib/model/profile';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore, usePro } from '@/state';
import type {
  CheckinDataSource, CheckinFutureVM, CheckinMonthVM, CheckinMoveAnswer, CheckinStep, CheckinVM, MoveProgressVM, MoveVM,
} from './types';

export const CHECKIN_STEPS: readonly CheckinStep[] = ['month', 'move', 'future'];

/** Days in a 'YYYY-MM' month (calendar arithmetic, not money math). */
export function daysInMonth(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
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

/** Progress on a committed move: card payoff with vs without it, or the category against its target. */
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
    const without = simulate(p, months, { rates }).payoffMonth[target.debtId] ?? null;
    const withMove = simulate(applyPatch(p, move.patch), months, { rates }).payoffMonth[target.debtId] ?? null;
    return { kind: 'cardPayoff', debtId: target.debtId, payoffMonthWith: withMove, payoffMonthWithout: without };
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
  const now = opts.now;

  const [step, setStep] = useState<CheckinStep>('month');
  const [finished, setFinished] = useState(false);
  const [chosenSource, setChosenSource] = useState<CheckinDataSource | null>(null);
  const [answer, setAnswer] = useState<CheckinMoveAnswer>('none');
  const [doneMove, setDoneMove] = useState<MoveVM | null>(null);

  const hasUploads = statementMonths.length > 0;
  // Uploads by default once there are any; the sample otherwise (and whenever the user picks it).
  const source: CheckinDataSource = hasUploads ? (chosenSource ?? 'uploads') : 'sample';

  const review = useMemo(() => {
    const months = source === 'uploads' ? statementMonths : statementTotalsSample;
    return checkinMonthInputs(months, localMonthDay(now));
  }, [source, statementMonths, now]);

  const month: CheckinMonthVM = useMemo(() => {
    const takeHome =
      source === 'sample'
        ? review.latest?.detectedPay !== undefined
          ? { value: review.latest.detectedPay, isEstimate: false }
          : null
        : { ...profile.takeHomePay };
    return {
      source,
      hasUploads,
      month: review.latest?.month ?? null,
      inProgress: review.inProgress,
      historyMonths: review.history.length,
      historyNeeded: DRIFT_HISTORY_MONTHS,
      result: runEngine(() => monthEnd(profile, review.history, review.thisMonth)),
      takeHome,
    };
  }, [profile, review, source, hasUploads]);

  const committedMoveId = profile.committedMoveId;
  const committed: MoveVM | null = useMemo(
    () => (committedMove && committedMoveId === committedMove.id ? toMoveVM(committedMove, { committedMoveId }) : null),
    [committedMove, committedMoveId],
  );

  const progress: Loadable<MoveProgressVM | null> | null = useMemo(
    () => (committed ? runEngine(() => moveProgress(profile, committed, { ...review, source })) : null),
    [committed, profile, review, source],
  );

  const future: Loadable<CheckinFutureVM> = useMemo(
    () =>
      runEngine(() => {
        const base = displayForecast(profile);
        const withMove = committed
          ? forecast(applyPatch(profile, committed.patch), 10, { todaysDollars: true, rates: areaRates(profile) })
          : null;
        return {
          points: base.points,
          in10y: base.in10y,
          bandIsZero: !hasEstimates(profile),
          withMove: withMove && committed ? { move: committed, points: withMove.points, in10y: withMove.in10y } : null,
        };
      }),
    [profile, committed],
  );

  const markDone = useCallback(() => {
    if (!committedMove) return;
    setDoneMove(toMoveVM(committedMove, profile));
    markMoveDone(committedMove);
    setAnswer('done');
  }, [committedMove, profile, markMoveDone]);

  const index = CHECKIN_STEPS.indexOf(step);
  const goTo = useCallback((s: CheckinStep) => {
    setStep(s);
    setFinished(false);
  }, []);

  return {
    status: ready ? 'ready' : 'loading',
    steps: CHECKIN_STEPS,
    step,
    goTo,
    next: () => {
      if (index < CHECKIN_STEPS.length - 1) setStep(CHECKIN_STEPS[index + 1]!);
    },
    back: () => {
      if (index > 0) setStep(CHECKIN_STEPS[index - 1]!);
    },
    finished,
    finish: () => setFinished(true),
    restart: () => {
      setFinished(false);
      setStep('month');
      setAnswer('none');
      setDoneMove(null);
    },
    month,
    setSource: setChosenSource,
    move: {
      committed,
      progress,
      suggestions: nextMoves.moves,
      answer,
      doneMove,
      level: movesLevel(profile),
      commit: nextMoves.commit,
      markDone,
      keepGoing: () => setAnswer('keepGoing'),
    },
    future,
    pro: { isPro, href: SCREEN_ROUTES.S15 },
  };
}
