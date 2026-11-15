// S14 Monthly check-in, all from the engine:
// - Your month: the latest month of the person's own money against the usual month (engine
//   monthEndDetail = monthEnd with its per-category rows: month-end projection, the 3-month average,
//   drift flags). Their own months are their transactions (the Transactions ledger, its monthly totals
//   by the engine's statementTotals), else the statements they uploaded on S9; with neither, the
//   sample statement's months (fixture, labelled as a preview).
// - Your move: progress on the committed move (engine simulate / applyPatch), then "I did it" (its
//   patch enters the profile, as on S1) or "not yet"; with no committed move, the top ranked move to
//   commit to (engine rankMoves through useNextMoves).
import { applyPatch, forecastMonths, monthEndDetail, movesLevel, simulate, type CurrentMonth, type MonthEndDetail } from '@lifeguessr/engine';
import type { CategoryTotals, Move, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { DRIFT_HISTORY_MONTHS } from '@/features/ladder/model/useStatementUpload';
import { moveTarget, toMoveVM, useNextMoves } from '@/features/forecast/model/useNextMoves';
import { PLANNER_ROUTES } from '@/features/dashboard/model/links';
import { useLedger } from '@/features/transactions/model/transactionsStore';
import { statementTotalsSample } from '@/fixtures';
import { localMonthDay } from '@/lib/dates';
import { runEngine } from '@/lib/model/errors';
import { areaRates } from '@/lib/model/profile';
import { transactionTotals } from '@/lib/model/transactions';
import type { Loadable } from '@/lib/model/types';
import { useAppReady, useAppStore, useProfile } from '@/state';
import type {
  CheckinCompareVM, CheckinDataSource, CheckinMonthVM, CheckinMoveAnswer, CheckinVM, MoveProgressVM, MoveVM,
} from './types';

const NO_MOVES: MoveVM[] = [];

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

/** The headline numbers and the category bars from monthEndDetail. */
export function compareOf(d: MonthEndDetail): CheckinCompareVM {
  const difference = d.projectedSpend - d.usualSpend;
  return {
    projected: d.projectedSpend,
    usual: d.usualSpend,
    usualFromHistory: d.usualFromHistory,
    difference,
    direction: Math.round(difference) === 0 ? 'even' : difference > 0 ? 'over' : 'under',
    spentSoFar: d.spentSoFar,
    rows: d.rows
      .filter((r) => r.usual > 0 || r.projected > 0)
      .map((r) => ({ category: r.category, usual: r.usual, projected: r.projected, soFar: r.soFar, delta: r.delta, drift: r.drift })),
    driftCount: d.drifts.length,
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
    review.source === 'mine' && review.latest && !review.inProgress ? (review.latest.totals[target.category] ?? 0) : null;
  return {
    kind: 'spendingTarget',
    category: target.category,
    target: target.monthly,
    planned: p.spending[target.category].value,
    actual,
    onTrack: actual === null ? null : actual <= target.monthly,
  };
}

const NO_MONTHS: readonly CategoryTotals[] = [];

export function useCheckin(opts: { now?: Date } = {}): CheckinVM {
  const appReady = useAppReady();
  const profile = useProfile();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const { lines, ready: ledgerReady } = useLedger();
  const committedMove = useAppStore((s) => s.committedMove);
  const markMoveDone = useAppStore((s) => s.markMoveDone);
  const nextMoves = useNextMoves(profile);

  const [chosenSource, setChosenSource] = useState<CheckinDataSource | null>(null);
  const [answer, setAnswer] = useState<CheckinMoveAnswer>('none');
  const [doneMove, setDoneMove] = useState<MoveVM | null>(null);

  // The person's own months: their transactions first (the app's ledger), else their uploaded statements.
  const ledgerMonths = useMemo(() => (lines.length > 0 ? transactionTotals(lines) : NO_MONTHS), [lines]);
  const ownKind = ledgerMonths.length > 0 ? 'ledger' : statementMonths.length > 0 ? 'uploads' : null;
  const own = ownKind === 'ledger' ? ledgerMonths : ownKind === 'uploads' ? statementMonths : NO_MONTHS;
  const hasOwn = ownKind !== null;
  // Their own months by default once there are any; the sample otherwise (and whenever they pick it).
  const source: CheckinDataSource = hasOwn ? (chosenSource ?? 'mine') : 'sample';

  const { month: todayMonth, day: todayDay } = localMonthDay(opts.now);
  const review = useMemo(
    () => checkinMonthInputs(source === 'mine' ? own : statementTotalsSample, { month: todayMonth, day: todayDay }),
    [source, own, todayMonth, todayDay],
  );
  const detail = useMemo(
    () => runEngine(() => monthEndDetail(profile, review.history, review.thisMonth)),
    [profile, review],
  );

  const month: CheckinMonthVM = useMemo(
    () => ({
      source,
      hasOwn,
      ownKind,
      month: review.latest?.month ?? null,
      inProgress: review.inProgress,
      day: detail.status === 'ready' ? detail.data.day : null,
      daysInMonth: detail.status === 'ready' ? detail.data.daysInMonth : null,
      nextStatementMonth: review.latest ? nextMonth(review.latest.month) : todayMonth,
      historyMonths: Math.min(review.history.length, DRIFT_HISTORY_MONTHS),
      historyNeeded: DRIFT_HISTORY_MONTHS,
      result: detail,
    }),
    [detail, review, source, hasOwn, ownKind, todayMonth],
  );

  const compare = useMemo(() => (detail.status === 'ready' ? compareOf(detail.data) : null), [detail]);

  const committedMoveId = profile.committedMoveId;
  // The committed move as stored (its patch and target are what progress is measured against; its source is unknown).
  const stored: MoveVM | null = useMemo(
    () => (committedMove && committedMoveId === committedMove.id ? toMoveVM(committedMove, { committedMoveId }, null) : null),
    [committedMove, committedMoveId],
  );
  // What is shown: the move as ranked now (current number and who made it) when it is on the list, else as stored
  // (no label), like S1.
  const rankedMoves = nextMoves.moves.status === 'ready' ? nextMoves.moves.data : NO_MOVES;
  const committed: MoveVM | null = stored && (rankedMoves.find((m) => m.id === stored.id) ?? stored);

  const progress: Loadable<MoveProgressVM | null> | null = useMemo(
    () => (stored ? runEngine(() => moveProgress(profile, stored, { ...review, source })) : null),
    [stored, profile, review, source],
  );

  const { actionsDisabled } = nextMoves;
  const markDone = useCallback(() => {
    // Like S1: not while the list on screen is a previous profile's answer.
    if (!committedMove || actionsDisabled) return;
    setDoneMove(toMoveVM(committedMove, profile, null));
    markMoveDone(committedMove);
    setAnswer('done');
  }, [committedMove, profile, markMoveDone, actionsDisabled]);

  const { commit: commitMove } = nextMoves;
  const commit = useCallback(
    (id: string) => {
      commitMove(id);
      setAnswer('none');
    },
    [commitMove],
  );

  return {
    status: appReady && ledgerReady ? 'ready' : 'loading',
    month,
    setSource: setChosenSource,
    compare,
    move: {
      committed,
      progress,
      suggestions: nextMoves.moves,
      actionsDisabled,
      answer,
      doneMove,
      level: movesLevel(profile),
      commit,
      markDone,
      keepGoing: () => setAnswer('keepGoing'),
    },
    uploadHref: PLANNER_ROUTES.importCsv,
    movesHref: PLANNER_ROUTES.plan,
  };
}
