// M13 (issue #89): the debt payoff planner, a section of Loan Lab (S12). It compares avalanche, snowball and
// minimums only on the same debts Loan Lab pays off today (the profile's debts plus the selected offer), with its
// own extra payment, the debt-free date, the interest and months against minimums, and the extra per month that
// would finish by a chosen month. Composed beside useLoanLab, which it never changes.
//
// Code does the math: every figure here comes from the payoff engine (comparePayoff, extraToFinishBy; issue #88).
// The engine, the event sender and today's date come in through `options`, so the planner can be built and tested
// before they are bound; with `options` null it answers null and Loan Lab stays as it is (wiring.ts).
import { PAYOFF_TIMELINE_MAX_MONTHS, type ClientFunnelEvent, type Debt, type Money, type PayoffComparison, type PayoffMethod, type PayoffPlan } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runEngine } from '@/lib/model/errors';
import { linearSliderVM } from '@/lib/model/slider';
import type { Loadable } from '@/lib/model/types';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady, useAppStore } from '@/state';
import { hasNonFinite } from './finite';
import { addMonths, monthsBetween, type PayoffDate } from './payoffDates';
import { NEW_LOAN_DEBT_ID, PAYOFF_PAID_OFF_EPSILON, payoffDebts } from './payoffDebts';
import type {
  LoanLabVM, PayoffChartVM, PayoffChoice, PayoffColumnVM, PayoffDelta, PayoffFixVM, PayoffOrderRowVM, PayoffPlannerVM, PayoffTargetVM,
} from './types';

/** Largest extra the box accepts per month: far above any household's budget; the engine takes any finite amount. */
export const PAYOFF_EXTRA_LIMIT: Money = 100_000;
/** The slider track is at least this long ($0 to $1,000 a month), and longer when a typed extra is longer. */
export const PAYOFF_EXTRA_SLIDER_FLOOR: Money = 1_000;
export const PAYOFF_EXTRA_STEP: Money = 25;
/**
 * A plan that never pays off gets one suggestion: the extra per month that clears it within this many months
 * (10 years). The engine's own limit is 100 years, which is not a plan anyone would call fixed.
 */
export const PAYOFF_NEVER_FIX_MONTHS = 120;
/** The balance chart shows at least this many months when a plan never ends (10 years). */
export const PAYOFF_CHART_NEVER_MONTHS = 120;
/** Under this many dollars of difference to minimums only, the interest is called "the same" (it shows as $0). */
export const PAYOFF_SAME_INTEREST: Money = 0.5;

/** The two engine functions the planner uses; their signatures are those of packages/engine/loan/payoff.ts (issue #88). */
export type PayoffEngine = {
  comparePayoff: (debts: Debt[], extra: Money) => PayoffComparison;
  extraToFinishBy: (debts: Debt[], months: number, method: PayoffChoice) => { extra: Money; reachable: boolean };
};

/** What the store keeps for the planner (`tools.payoff`, issue #78): the picks, browser-local. `targetMonths` counts from the month it was saved. */
export type PayoffStoredState = { method: PayoffChoice; extra: Money; targetMonths?: number };

export type PayoffPlannerOptions = {
  engine: PayoffEngine;
  /** `track` from lib/events. */
  track: (event: ClientFunnelEvent, opts?: { once?: string }) => void;
  /** Today's month as 'YYYY-MM' (lib/dates `localMonthDay()`); the model never reads the clock. */
  today: () => { month: string };
  /** The saved picks, if any. */
  stored?: PayoffStoredState;
  /** Called with the picks after each change by the person (never for the saved ones alone). Failures are ignored. */
  onStore?: (state: PayoffStoredState) => void;
  /** Streamer mode: nothing personal is computed or shown. */
  streamer?: boolean;
};

const METHODS: readonly PayoffMethod[] = ['avalanche', 'snowball', 'minimum'];

const clampExtra = (value: number): Money => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(PAYOFF_EXTRA_LIMIT, Math.round(value * 100) / 100);
};

const isChoice = (method: unknown): method is PayoffChoice => method === 'avalanche' || method === 'snowball';

type Edits = { method?: PayoffChoice; extra?: Money; target?: string | null };

type TargetCheck =
  | { status: 'none' | 'invalid' | 'past' | 'tooFar' }
  | { status: 'ok'; months: number; date: PayoffDate };

function checkTarget(target: string | null, today: string | null): TargetCheck {
  if (target === null || target === '') return { status: 'none' };
  const months = today === null ? null : monthsBetween(today, target);
  if (months === null) return { status: 'invalid' };
  if (months < 1) return { status: 'past' };
  if (months > PAYOFF_TIMELINE_MAX_MONTHS) return { status: 'tooFar' };
  return { status: 'ok', months, date: addMonths(today!, months)! };
}

/** A signed difference to minimums only as a size and a direction: a negative one is "costs", never a saving. */
const delta = (value: number, sameBelow: number): PayoffDelta =>
  Math.abs(value) < sameBelow ? { kind: 'same', amount: Math.abs(value) } : { kind: value > 0 ? 'saves' : 'costs', amount: Math.abs(value) };

function solveTarget(
  check: TargetCheck, extra: Money, debts: Debt[], method: PayoffChoice, engine: PayoffEngine | undefined, active: boolean,
  selected: PayoffPlan | null,
): PayoffTargetVM {
  if (!active || !engine) return { status: 'none' };
  if (check.status === 'tooFar') return { status: 'tooFar', years: PAYOFF_TIMELINE_MAX_MONTHS / 12 };
  if (check.status !== 'ok') return { status: check.status };
  const solved = runEngine(() => engine.extraToFinishBy(debts, check.months, method));
  if (solved.status === 'error') return { status: 'error', error: solved.error };
  if (solved.status === 'loading' || hasNonFinite(solved.data) || solved.data.extra < 0) return { status: 'error', error: { kind: 'invalidResponse' } };
  const { date, months } = check;
  // On track is read off the plan on screen, not off the solver: it answers within $1 above the least extra that works,
  // so at an extra a little under its answer the plan can already finish in time.
  if (selected !== null && selected.monthsToDebtFree !== null && selected.monthsToDebtFree <= months) {
    return { status: 'onTrack', date, months, atMinimums: solved.data.reachable && solved.data.extra === 0 };
  }
  if (!solved.data.reachable) return { status: 'unreachable', date, months };
  // Rounded up to a whole dollar, so that paying the amount shown does finish by the month.
  const extraNeeded = Math.ceil(solved.data.extra);
  return { status: 'needs', date, months, extraNeeded, moreThanNow: Math.max(0, Math.ceil(extraNeeded - extra)) };
}

/**
 * The target-date solver, run only when one of its inputs changes: it asks the engine up to a few dozen times (it
 * bisects), and the screen renders far more often than that. A hook of its own so that the React Compiler can keep
 * this memo: written inside usePayoffPlanner, the same useMemo is rejected (react-hooks/preserve-manual-memoization).
 */
function useTargetSolve(
  targetDate: string | null, today: string | null, extra: Money, debts: Debt[], method: PayoffChoice,
  engine: PayoffEngine | undefined, active: boolean, selected: PayoffPlan | null,
): PayoffTargetVM {
  return useMemo(
    () => solveTarget(checkTarget(targetDate, today), extra, debts, method, engine, active, selected),
    [targetDate, today, extra, debts, method, engine, active, selected],
  );
}

export function usePayoffPlanner(lab: Pick<LoanLabVM, 'offers' | 'selectedOfferId'>, options: PayoffPlannerOptions | null): PayoffPlannerVM | null {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const engine = options?.engine;
  const track = options?.track;
  const stored = options?.stored;
  const hidden = options?.streamer === true;
  const today = options ? options.today().month : null;

  // ----- the debts: the same list Loan Lab pays off -----
  const selectedOffer = lab.offers.find((o) => o.id === lab.selectedOfferId) ?? null;
  const offerInput = selectedOffer?.input;
  const offerMonthly = selectedOffer?.result?.monthly;
  const debts = useMemo(
    () => payoffDebts(profile.debts, offerInput && offerMonthly !== undefined ? { input: offerInput, monthly: offerMonthly } : null),
    [profile.debts, offerInput, offerMonthly],
  );
  const owing = useMemo(() => debts.filter((d) => d.balance > PAYOFF_PAID_OFF_EPSILON), [debts]);
  const hasDebts = owing.length > 0;

  // ----- the picks: what the person changed, over what was saved -----
  const [edits, setEdits] = useState<Edits>({});
  const storedMethod = stored?.method;
  const method: PayoffChoice = edits.method ?? (isChoice(storedMethod) ? storedMethod : 'avalanche');
  const extra = clampExtra(edits.extra ?? stored?.extra ?? 0);
  // A saved target counts months from the day it was saved; one that cannot be a target now is dropped.
  const storedMonths = stored?.targetMonths;
  const storedTarget =
    storedMonths !== undefined && Number.isInteger(storedMonths) && storedMonths >= 1 && storedMonths <= PAYOFF_TIMELINE_MAX_MONTHS && today !== null
      ? (addMonths(today, storedMonths)?.month ?? null)
      : null;
  const targetDate: string | null = edits.target !== undefined ? edits.target : storedTarget;
  const setMethod = useCallback((next: PayoffChoice) => {
    if (isChoice(next)) setEdits((e) => ({ ...e, method: next }));
  }, []);
  const setExtra = useCallback((value: Money) => setEdits((e) => ({ ...e, extra: clampExtra(value) })), []);
  const setTargetDate = useCallback((month: string | null) => setEdits((e) => ({ ...e, target: month === '' ? null : month })), []);

  // ----- the engine -----
  const active = ready && !hidden && hasDebts;
  const comparison = useMemo((): Loadable<PayoffComparison> | null => {
    if (!engine || hidden) return null;
    if (!ready) return { status: 'loading' };
    if (!hasDebts) return null;
    const result = runEngine(() => engine.comparePayoff(debts, extra));
    // Whatever the engine returns is shown as it is, unless a number in it is not a number.
    return result.status === 'ready' && hasNonFinite(result.data) ? { status: 'error', error: { kind: 'invalidResponse' } } : result;
  }, [engine, hidden, ready, hasDebts, debts, extra]);

  const plans = comparison?.status === 'ready' ? comparison.data : null;
  const selected: PayoffPlan | null = plans ? plans[method] : null;
  const minimum: PayoffPlan | null = plans ? plans.minimum : null;
  const dateOf = (months: number | null): PayoffDate | null => (months === null || today === null ? null : addMonths(today, months));

  // A plan that never pays off has simulated 100 years of interest: that is not its total, and a difference
  // to it is not a saving, so neither is passed on.
  const minimumEnds = minimum !== null && minimum.monthsToDebtFree !== null;
  const columns: PayoffColumnVM[] = plans
    ? METHODS.map((m) => {
        const plan = plans[m];
        const ends = plan.monthsToDebtFree !== null;
        return {
          method: m,
          isSelected: m === method,
          monthsToDebtFree: plan.monthsToDebtFree,
          debtFreeDate: dateOf(plan.monthsToDebtFree),
          totalInterest: ends ? plan.totalInterest : null,
          interestSaved: ends && minimumEnds ? plan.interestSavedVsMinimum : null,
          monthsSaved: plan.monthsSavedVsMinimum,
        };
      })
    : [];
  const pickedColumn = columns.find((c) => c.isSelected) ?? null;

  const order: PayoffOrderRowVM[] = [];
  if (selected) {
    const byId = new Map(debts.map((d) => [d.id, d]));
    const perDebt = new Map(selected.perDebt.map((d) => [d.id, d]));
    for (const id of selected.order) {
      const d = byId.get(id);
      if (!d) continue;
      order.push({
        id,
        kind: d.kind,
        isNew: id === NEW_LOAN_DEBT_ID,
        apr: d.apr,
        balance: d.balance,
        minIsEstimate: d.minPayment.isEstimate,
        payoffDate: dateOf(perDebt.get(id)?.payoffMonth ?? null),
      });
    }
  }

  const savings =
    pickedColumn && pickedColumn.interestSaved !== null
      ? {
          interest: delta(pickedColumn.interestSaved, PAYOFF_SAME_INTEREST),
          months: pickedColumn.monthsSaved === null ? null : delta(pickedColumn.monthsSaved, 1),
        }
      : null;

  let chart: PayoffChartVM | null = null;
  if (selected && minimum) {
    const ends = [selected.monthsToDebtFree, minimum.monthsToDebtFree];
    const finite = ends.filter((m): m is number => m !== null);
    const horizonMonths = finite.length < ends.length ? Math.max(PAYOFF_CHART_NEVER_MONTHS, ...finite) : Math.max(...finite);
    const cut = (plan: PayoffPlan) => plan.timeline.filter((p) => p.month <= horizonMonths);
    chart = { horizonMonths, selected: cut(selected), minimum: cut(minimum) };
  }

  const fix = useMemo((): PayoffFixVM | null => {
    if (!engine || !active || !selected || selected.monthsToDebtFree !== null) return null;
    const solved = runEngine(() => engine.extraToFinishBy(debts, PAYOFF_NEVER_FIX_MONTHS, method));
    if (solved.status !== 'ready' || hasNonFinite(solved.data)) return null;
    // The engine's largest extra comes back with reachable: false; that limit is never offered as the answer.
    return { months: PAYOFF_NEVER_FIX_MONTHS, years: PAYOFF_NEVER_FIX_MONTHS / 12, extra: solved.data.reachable ? Math.ceil(solved.data.extra) : null };
  }, [engine, active, selected, debts, method]);

  const check = checkTarget(targetDate, today);
  const targetVM = useTargetSolve(targetDate, today, extra, debts, method, engine, active, selected);

  // ----- the picks, kept after the person's own changes (what was only restored is not saved again) -----
  const touched = Object.keys(edits).length > 0;
  const toStore: PayoffStoredState = { method, extra, ...(check.status === 'ok' ? { targetMonths: check.months } : {}) };
  const storeKey = touched ? JSON.stringify(toStore) : null;
  const onStoreRef = useRef(options?.onStore);
  useEffect(() => {
    onStoreRef.current = options?.onStore;
  });
  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    if (storeKey === null || savedRef.current === storeKey) return;
    savedRef.current = storeKey;
    try {
      onStoreRef.current?.(JSON.parse(storeKey) as PayoffStoredState);
    } catch {
      // Keeping the picks is a convenience; a full or blocked browser store must not break the screen.
    }
  }, [storeKey]);

  // ----- events: enums only, never an amount, a date or a debt -----
  const shown = active && selected !== null;
  const opened = useRef(false);
  useEffect(() => {
    if (!shown || !track || opened.current) return;
    opened.current = true;
    track({ name: 'tool_opened', props: { tool: 'payoff' } }, { once: 'tool:payoff' });
  }, [shown, track]);
  // One `payoff_planned` per page load, with the method of the first plan shown; trying the other method later is not a new plan.
  const planned = useRef(false);
  useEffect(() => {
    if (!shown || !track || planned.current) return;
    planned.current = true;
    track({ name: 'payoff_planned', props: { method } }, { once: 'payoff_planned' });
  }, [shown, track, method]);

  if (!options) return null;
  const sliderMax = Math.max(PAYOFF_EXTRA_SLIDER_FLOOR, Math.ceil(extra / PAYOFF_EXTRA_STEP) * PAYOFF_EXTRA_STEP);
  const min = today === null ? null : addMonths(today, 1);
  const max = today === null ? null : addMonths(today, PAYOFF_TIMELINE_MAX_MONTHS);
  return {
    status: ready ? 'ready' : 'loading',
    hidden,
    hasDebts,
    method,
    setMethod,
    extra: linearSliderVM(extra, 0, sliderMax, PAYOFF_EXTRA_STEP),
    extraLimit: PAYOFF_EXTRA_LIMIT,
    setExtra,
    comparison,
    columns,
    selected,
    order,
    debtFreeDate: selected ? dateOf(selected.monthsToDebtFree) : null,
    interestSaved: pickedColumn ? pickedColumn.interestSaved : null,
    monthsSaved: pickedColumn && pickedColumn.interestSaved !== null ? pickedColumn.monthsSaved : null,
    savings,
    isEstimate: owing.some((d) => d.minPayment.isEstimate),
    chart,
    fix,
    targetDate,
    setTargetDate,
    targetBounds: min && max ? { min: min.month, max: max.month } : null,
    target: hidden ? { status: 'none' } : targetVM,
    balanceSheetHref: SCREEN_ROUTES.S8,
  };
}
