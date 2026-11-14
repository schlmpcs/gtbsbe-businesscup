// @vitest-environment jsdom
// The debt payoff planner (M13, issue #89) on fakes of the payoff engine, the event sender and today's date.
// Every expected figure is worked out by hand from the demo profile (card $6,400 at 24.36%, auto $17,800 at 7.4%),
// sample offer 1 ($28,000 at 6.9%), the canned plans in src/test/payoff.ts and "today = November 2026".
import { payoffOrder } from '@lifeguessr/engine';
import { PAYOFF_TIMELINE_MAX_MONTHS, type Debt, type PayoffComparison } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo, loanOffersSample } from '@/fixtures';
import { resetClientState } from '@/test/clientState';
import { useAppStore } from '@/state';
import { hasNonFinite, plannerOptions } from '@/test/payoff';
import { addMonths } from './payoffDates';
import { useLoanLab } from './useLoanLab';
import { PAYOFF_EXTRA_LIMIT, PAYOFF_NEVER_FIX_MONTHS, usePayoffPlanner, type PayoffPlannerOptions, type PayoffStoredState } from './usePayoffPlanner';

beforeEach(resetClientState);

/** Loan Lab and the planner together, as the page composes them. */
function both(options: PayoffPlannerOptions | null, labOptions: Parameters<typeof useLoanLab>[0] = {}) {
  return renderHook(
    (props: { options: PayoffPlannerOptions | null }) => {
      const lab = useLoanLab(labOptions);
      return { lab, planner: usePayoffPlanner(lab, props.options) };
    },
    { initialProps: { options } },
  );
}

async function ready(options: PayoffPlannerOptions | null, labOptions: Parameters<typeof useLoanLab>[0] = {}) {
  const hook = both(options, labOptions);
  await waitFor(() => expect(hook.result.current.lab.status).toBe('ready'));
  return hook;
}

/** The three debts of the demo profile with sample offer 1, as the engine must be asked about them. */
const demoDebtsWithOffer1 = (monthly: number): Debt[] => [
  { id: 'card-1', kind: 'card', balance: 6_400, apr: 0.2436, minPayment: { value: 193.92, isEstimate: true } },
  { id: 'auto-1', kind: 'auto', balance: 17_800, apr: 0.074, minPayment: { value: 412, isEstimate: false } },
  { id: 'new-loan', kind: 'personal', balance: 28_000, apr: 0.069, minPayment: { value: monthly, isEstimate: false } },
];

describe('usePayoffPlanner: wiring', () => {
  it('is null until it is wired, and Loan Lab keeps its own payoff order', async () => {
    const { result } = await ready(null);
    expect(result.current.planner).toBeNull();
    expect(result.current.lab.payoffPlan).not.toBeNull();
  });
});

describe('usePayoffPlanner: the debts and the comparison', () => {
  it('asks the engine about the profile debts plus the selected offer, with the planner\'s own extra of $0', async () => {
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options);
    const monthly = result.current.lab.offers[0]!.result!.monthly;
    expect(comparePayoff).toHaveBeenLastCalledWith(demoDebtsWithOffer1(monthly), 0);
    const p = result.current.planner!;
    expect(p.hasDebts).toBe(true);
    expect(p.comparison?.status).toBe('ready');
    expect(p.method).toBe('avalanche');
    expect(p.extra.value).toBe(0);
  });

  it('shows the engine\'s plans as they are: the comparison, the picked plan, its interest', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    const p = result.current.planner!;
    if (p.comparison?.status !== 'ready') throw new Error('not ready');
    const c: PayoffComparison = p.comparison.data;
    expect(c.extra).toBe(0);
    expect(p.selected).toBe(c.avalanche);
    expect(p.selected!.totalInterest).toBe(5_000);
    expect(p.columns.map((x) => x.method)).toEqual(['avalanche', 'snowball', 'minimum']);
    expect(p.columns.map((x) => x.totalInterest)).toEqual([5_000, 5_400, 6_200]);
    expect(p.columns.map((x) => x.isSelected)).toEqual([true, false, false]);
  });

  it('dates the debt-free day as today (November 2026) plus the plan\'s months, across the new year', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    const p = result.current.planner!;
    // 40, 41 and 46 months after 2026-11: 2026-11 + 36 = 2029-11, so +4, +5 and +10.
    expect(p.columns.map((x) => x.debtFreeDate)).toEqual([
      { month: '2030-03', year: 2030 },
      { month: '2030-04', year: 2030 },
      { month: '2030-09', year: 2030 },
    ]);
    expect(p.debtFreeDate).toEqual({ month: '2030-03', year: 2030 });
  });

  it('reads today from the injected date: December 2026 + 2 months is February 2027', async () => {
    const { options } = plannerOptions({ today: () => ({ month: '2026-12' }), engineOptions: { avalanche: { monthsToDebtFree: 2 } } });
    const { result } = await ready(options);
    expect(result.current.planner!.debtFreeDate).toEqual({ month: '2027-02', year: 2027 });
  });

  it('reports the saving against minimums with its sign: avalanche saves $1,200 and 6 months', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.interestSaved).toBe(1_200);
    expect(p.monthsSaved).toBe(6);
    expect(p.savings).toEqual({ interest: { kind: 'saves', amount: 1_200 }, months: { kind: 'saves', amount: 6 } });
  });

  it('says "costs" for a plan worse than minimums, never a negative saving (snowball, -165 months)', async () => {
    const { options } = plannerOptions({
      engineOptions: { snowball: { interestSavedVsMinimum: -300, monthsSavedVsMinimum: -165 } },
    });
    const { result } = await ready(options);
    act(() => result.current.planner!.setMethod('snowball'));
    const p = result.current.planner!;
    expect(p.interestSaved).toBe(-300);
    expect(p.monthsSaved).toBe(-165);
    expect(p.savings).toEqual({ interest: { kind: 'costs', amount: 300 }, months: { kind: 'costs', amount: 165 } });
    const column = p.columns.find((x) => x.method === 'snowball')!;
    expect([column.interestSaved, column.monthsSaved]).toEqual([-300, -165]);
  });

  it('treats under 50 cents and no months as "same"', async () => {
    const { options } = plannerOptions({ engineOptions: { avalanche: { interestSavedVsMinimum: 0.4, monthsSavedVsMinimum: 0 } } });
    const { result } = await ready(options);
    expect(result.current.planner!.savings).toEqual({ interest: { kind: 'same', amount: 0.4 }, months: { kind: 'same', amount: 0 } });
  });

  it('has no months saving when one of the two never pays off (null), and still says the interest', async () => {
    const { options } = plannerOptions({ engineOptions: { avalanche: { monthsSavedVsMinimum: null } } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.monthsSaved).toBeNull();
    expect(p.savings!.months).toBeNull();
    expect(p.savings!.interest.kind).toBe('saves');
  });
});

describe('usePayoffPlanner: the method and the order', () => {
  it('switches the picked plan and its order with the method (offer 3: the two methods order differently)', async () => {
    const { options } = plannerOptions({
      // Offer 3 is $28,000 at 8.99%. By APR: card 24.36%, new loan 8.99%, auto 7.4%. By balance: card, auto, new loan.
      engineOptions: { avalanche: { order: ['card-1', 'new-loan', 'auto-1'] }, snowball: { order: ['card-1', 'auto-1', 'new-loan'] } },
    });
    const { result } = await ready(options);
    act(() => result.current.lab.selectOffer(result.current.lab.offers[2]!.id));
    expect(result.current.planner!.order.map((r) => r.id)).toEqual(['card-1', 'new-loan', 'auto-1']);
    act(() => result.current.planner!.setMethod('snowball'));
    expect(result.current.planner!.method).toBe('snowball');
    expect(result.current.planner!.selected!.method).toBe('snowball');
    expect(result.current.planner!.order.map((r) => r.id)).toEqual(['card-1', 'auto-1', 'new-loan']);
    expect(result.current.planner!.columns.map((c) => c.isSelected)).toEqual([false, true, false]);
  });

  it('ignores a method that is not a pick (minimums only is the baseline, not a choice)', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.planner!.setMethod('minimum' as never));
    expect(result.current.planner!.method).toBe('avalanche');
  });

  it('lists each debt with its kind, rate, balance, whether it is the new loan, and its payoff date', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.order).toEqual([
      // payoffMonth 12, 30, 40 after 2026-11: 2027-11, 2029-05 (2026-11 + 30 = 2029-05), 2030-03.
      { id: 'card-1', kind: 'card', isNew: false, apr: 0.2436, balance: 6_400, minIsEstimate: true, payoffDate: { month: '2027-11', year: 2027 } },
      { id: 'auto-1', kind: 'auto', isNew: false, apr: 0.074, balance: 17_800, minIsEstimate: false, payoffDate: { month: '2029-05', year: 2029 } },
      { id: 'new-loan', kind: 'personal', isNew: true, apr: 0.069, balance: 28_000, minIsEstimate: false, payoffDate: { month: '2030-03', year: 2030 } },
    ]);
  });

  it('has no payoff date for a debt the engine does not clear (null month)', async () => {
    const { options } = plannerOptions({
      engineOptions: {
        avalanche: {
          monthsToDebtFree: null,
          perDebt: [
            { id: 'card-1', payoffMonth: null, interest: 9_000 },
            { id: 'auto-1', payoffMonth: 30, interest: 1_500 },
            { id: 'new-loan', payoffMonth: 40, interest: 2_500 },
          ],
        },
      },
    });
    const { result } = await ready(options);
    expect(result.current.planner!.order[0]!.payoffDate).toBeNull();
  });

  it('is the same debts and order as Loan Lab\'s own payoff order (avalanche, extra $0): parity on the real payoffOrder', async () => {
    // An engine whose avalanche and snowball plans come from the engine's existing payoffOrder (T3), the function
    // behind Loan Lab's order card today.
    const asPlan = (debts: Debt[], extra: number, method: 'avalanche' | 'snowball') => {
      const r = payoffOrder(debts, extra, method);
      return { method, order: r.order, monthsToDebtFree: r.payoffMonth, totalInterest: r.totalInterest, totalPaid: 0, perDebt: [], timeline: [{ month: 0, balance: 0 }], interestSavedVsMinimum: 0, monthsSavedVsMinimum: 0 };
    };
    const { options } = plannerOptions();
    const real = {
      comparePayoff: (debts: Debt[], extra: number) => ({
        extra,
        avalanche: asPlan(debts, extra, 'avalanche'),
        snowball: asPlan(debts, extra, 'snowball'),
        minimum: { ...asPlan(debts, 0, 'avalanche'), method: 'minimum' as const },
      }),
      extraToFinishBy: () => ({ extra: 0, reachable: true }),
    };
    const { result } = await ready({ ...options, engine: real });
    const steps = result.current.lab.payoffPlan!.steps;
    const p = result.current.planner!;
    expect(p.order.map((r) => ({ id: r.id, kind: r.kind, isNew: r.isNew, apr: r.apr, balance: r.balance }))).toEqual(
      steps.map((s) => ({ id: s.id, kind: s.kind, isNew: s.isNew, apr: s.apr, balance: s.balance })),
    );
    expect(p.selected!.monthsToDebtFree).toBe(result.current.lab.payoffPlan!.payoffMonth);
    expect(p.selected!.totalInterest).toBe(result.current.lab.payoffPlan!.totalInterest);
  });
});

describe('usePayoffPlanner: the offer and the profile', () => {
  it('recomputes for another offer: offer 2 finances $28,000 - $3,000 + $495 = $25,495', async () => {
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.lab.selectOffer(result.current.lab.offers[1]!.id));
    const monthly2 = result.current.lab.offers[1]!.result!.monthly;
    const debts = comparePayoff.mock.lastCall![0];
    expect(debts.at(-1)).toEqual({ id: 'new-loan', kind: 'personal', balance: 25_495, apr: 0.0549, minPayment: { value: monthly2, isEstimate: false } });
    expect(loanOffersSample[1]!.downPayment).toBe(3_000);
  });

  it('drops the new loan when every offer is removed: only the profile debts are left', async () => {
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options);
    for (const o of [...result.current.lab.offers]) act(() => result.current.lab.removeOffer(o.id));
    expect(result.current.lab.selectedOfferId).toBeNull();
    expect(comparePayoff.mock.lastCall![0].map((d: Debt) => d.id)).toEqual(['card-1', 'auto-1']);
    expect(result.current.planner!.hasDebts).toBe(true);
  });

  it('has no debts when the profile has none and there is no offer: nothing to compare, no chart, no events', async () => {
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts: [] } });
    const { options, track, comparePayoff } = plannerOptions();
    const { result } = await ready(options, { initialOffers: [] });
    const p = result.current.planner!;
    expect(p.hasDebts).toBe(false);
    expect(p.comparison).toBeNull();
    expect(p.selected).toBeNull();
    expect(p.chart).toBeNull();
    expect(p.order).toEqual([]);
    expect(p.fix).toBeNull();
    expect(comparePayoff).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('treats debts with nothing owed as no debts', async () => {
    const demo = cloneProfileDemo();
    useAppStore.setState({ profile: { ...demo, debts: demo.debts.map((d) => ({ ...d, balance: 0 })) } });
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options, { initialOffers: [] });
    expect(result.current.planner!.hasDebts).toBe(false);
    expect(comparePayoff).not.toHaveBeenCalled();
  });

  // The engine counts a balance of a millionth of a dollar or less as paid off, so the planner does too: no
  // "debt-free this month" plan, no empty order list, no events for a debt that is not owed.
  it.each([
    [1e-7, false],
    [1e-6, false],
    [2e-6, true],
  ])('a balance of %s dollars is owed: %s', async (balance, owed) => {
    const demo = cloneProfileDemo();
    useAppStore.setState({ profile: { ...demo, debts: [{ ...demo.debts[1]!, balance }] } });
    const { options, comparePayoff, track } = plannerOptions();
    const { result } = await ready(options, { initialOffers: [] });
    expect(result.current.planner!.hasDebts).toBe(owed);
    expect(comparePayoff).toHaveBeenCalledTimes(owed ? 1 : 0);
    expect(track).toHaveBeenCalledTimes(owed ? 2 : 0);
  });

  it('inherits "estimate" from a defaulted minimum, and drops it when no such debt has a balance', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.isEstimate).toBe(true); // the demo card's $193.92 minimum is a default
    const demo = cloneProfileDemo();
    act(() => useAppStore.setState({ profile: { ...demo, debts: demo.debts.filter((d) => d.id === 'auto-1') } }));
    expect(result.current.planner!.isEstimate).toBe(false); // auto's minimum is the person's own; the new loan's is computed
    act(() => useAppStore.setState({ profile: demo }));
    expect(result.current.planner!.isEstimate).toBe(true);
  });
});

describe('usePayoffPlanner: the extra payment', () => {
  it('asks the engine again with the new extra', async () => {
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(150));
    expect(result.current.planner!.extra.value).toBe(150);
    expect(comparePayoff.mock.lastCall![1]).toBe(150);
  });

  it('keeps the extra a number from $0 up to the limit: a negative, NaN or empty is $0, a huge one is the limit', async () => {
    const { options, comparePayoff } = plannerOptions();
    const { result } = await ready(options);
    const set = (v: number) => act(() => result.current.planner!.setExtra(v));
    set(-5);
    expect(result.current.planner!.extra.value).toBe(0);
    set(Number.NaN);
    expect(result.current.planner!.extra.value).toBe(0);
    set(Number.POSITIVE_INFINITY);
    expect(result.current.planner!.extra.value).toBe(0);
    set(1e12);
    expect(result.current.planner!.extra.value).toBe(PAYOFF_EXTRA_LIMIT);
    expect(result.current.planner!.extraLimit).toBe(PAYOFF_EXTRA_LIMIT);
    expect(comparePayoff.mock.lastCall![1]).toBe(PAYOFF_EXTRA_LIMIT);
  });

  it('gives the slider a $1,000 track in $25 steps, longer when the typed extra is longer', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.extra).toMatchObject({ value: 0, min: 0, max: 1_000, step: 25, position: 0 });
    act(() => result.current.planner!.setExtra(500));
    expect(result.current.planner!.extra).toMatchObject({ max: 1_000, position: 0.5 });
    act(() => result.current.planner!.setExtra(1_270)); // up to the next $25 step: 1,275
    expect(result.current.planner!.extra).toMatchObject({ value: 1_270, max: 1_275 });
  });

  it('does not touch the extra payment of the selected offer', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(300));
    expect(result.current.lab.extra!.value).toBe(0);
  });
});

describe('usePayoffPlanner: a plan that never pays off', () => {
  const never = { avalanche: { monthsToDebtFree: null, monthsSavedVsMinimum: null, perDebt: [], timeline: [{ month: 0, balance: 52_200 }, { month: 120, balance: 80_000 }] } };

  it('shows no date and no months, and asks the engine what extra would clear it within 10 years', async () => {
    const { options, extraToFinishBy } = plannerOptions({ engineOptions: { ...never, solve: { extra: 312.4, reachable: true } } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(PAYOFF_NEVER_FIX_MONTHS).toBe(120);
    expect(p.debtFreeDate).toBeNull();
    expect(p.columns[0]!.monthsToDebtFree).toBeNull();
    expect(p.columns[0]!.debtFreeDate).toBeNull();
    expect(extraToFinishBy).toHaveBeenLastCalledWith(expect.any(Array), 120, 'avalanche');
    // 312.40 rounded up to a whole dollar, so that paying it does finish within the ten years.
    expect(p.fix).toEqual({ months: 120, years: 10, extra: 313 });
    expect(hasNonFinite(p)).toBe(false);
  });

  it('gives no interest and no saving for a plan that never ends: a total over the 100-year cap is not a total', async () => {
    const { options } = plannerOptions({ engineOptions: { ...never, avalanche: { ...never.avalanche, totalInterest: 4e13, interestSavedVsMinimum: -4e13 } } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.columns.map((c) => c.totalInterest)).toEqual([null, 5_400, 6_200]);
    expect(p.columns.map((c) => c.interestSaved)).toEqual([null, 800, 0]);
    expect(p.interestSaved).toBeNull();
    expect(p.monthsSaved).toBeNull();
    expect(p.savings).toBeNull();
  });

  it('claims no saving against minimums when only minimums never pay off, but still dates the picked plan', async () => {
    const { options } = plannerOptions({ engineOptions: { minimum: { monthsToDebtFree: null, totalInterest: 9e13 }, avalanche: { interestSavedVsMinimum: 9e13, monthsSavedVsMinimum: null } } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.columns.map((c) => c.totalInterest)).toEqual([5_000, 5_400, null]);
    expect(p.interestSaved).toBeNull();
    expect(p.savings).toBeNull();
    expect(p.debtFreeDate).toEqual({ month: '2030-03', year: 2030 });
    expect(p.fix).toBeNull(); // the picked plan does pay off
  });

  it('says no extra could when even the engine\'s largest extra does not help (never shows its limit as an answer)', async () => {
    const { options } = plannerOptions({ engineOptions: { ...never, solve: { extra: 1_000_000, reachable: false } } });
    const { result } = await ready(options);
    expect(result.current.planner!.fix).toEqual({ months: 120, years: 10, extra: null });
  });

  it('has no fix while the plan does pay off', async () => {
    const { options, extraToFinishBy } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.fix).toBeNull();
    expect(extraToFinishBy).not.toHaveBeenCalled();
  });

  it('holds the balance chart to a 10-year window when no plan ever ends', async () => {
    const { options } = plannerOptions({
      engineOptions: { avalanche: { monthsToDebtFree: null, timeline: [{ month: 0, balance: 100 }, { month: 120, balance: 400 }, { month: 121, balance: 410 }, { month: 1_200, balance: 9e13 }] }, minimum: { monthsToDebtFree: null, timeline: [{ month: 0, balance: 100 }, { month: 130, balance: 500 }] } },
    });
    const { result } = await ready(options);
    const chart = result.current.planner!.chart!;
    expect(chart.horizonMonths).toBe(120);
    expect(chart.selected.map((p) => p.month)).toEqual([0, 120]);
    expect(chart.minimum.map((p) => p.month)).toEqual([0]);
  });
});

describe('usePayoffPlanner: the balance chart', () => {
  it('draws the picked plan against minimums only, up to the later of the two debt-free months (46)', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    const chart = result.current.planner!.chart!;
    expect(chart.horizonMonths).toBe(46);
    expect(chart.selected).toEqual([{ month: 0, balance: 52_200 }, { month: 12, balance: 30_000 }, { month: 30, balance: 10_000 }, { month: 40, balance: 0 }]);
    expect(chart.minimum.at(-1)).toEqual({ month: 46, balance: 0 });
  });

  it('does not draw a plan that has a balance which is not a finite number', async () => {
    const { options } = plannerOptions({ engineOptions: { avalanche: { timeline: [{ month: 0, balance: 100 }, { month: 1, balance: Number.NaN }, { month: 2, balance: 0 }] } } });
    const { result } = await ready(options);
    // The whole answer is refused (see "no Infinity or NaN"), so there is nothing to draw.
    expect(result.current.planner!.comparison?.status).toBe('error');
    expect(result.current.planner!.chart).toBeNull();
  });
});

describe('usePayoffPlanner: the target date', () => {
  it('needs the extra the engine finds for the month: December 2029 is 37 months from November 2026', async () => {
    const { options, extraToFinishBy } = plannerOptions({ engineOptions: { solve: { extra: 212.2, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(extraToFinishBy).toHaveBeenLastCalledWith(expect.any(Array), 37, 'avalanche');
    expect(result.current.planner!.targetDate).toBe('2029-12');
    // The solver's 212.2 rounded up to $213; with no extra set, all of it is more than now.
    expect(result.current.planner!.target).toEqual({ status: 'needs', date: { month: '2029-12', year: 2029 }, months: 37, extraNeeded: 213, moreThanNow: 213 });
  });

  it('says how much more than the extra already set: $213 in all with $50 set is $163 more', async () => {
    const { options } = plannerOptions({ engineOptions: { solve: { extra: 212.2, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(50));
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(result.current.planner!.target).toMatchObject({ status: 'needs', extraNeeded: 213, moreThanNow: 163 });
  });

  // The solver answers within $1 above the least extra that works. So at an extra a little under its answer the
  // picked plan can already finish in time; what is on screen (the plan) and the sentence must agree.
  describe('on track follows the picked plan, not the solver\'s $1 tolerance', () => {
    const finishesFrom = (least: number, months: number, late: number) => (extra: number) => ({ monthsToDebtFree: extra >= least ? months : late });

    it('2029-12 (37 months): at $142.50 the plan finishes in month 37, so on track, though the solver says $144', async () => {
      const { options } = plannerOptions({ engineOptions: { solve: { extra: 143.4, reachable: true }, avalancheByExtra: finishesFrom(142.5, 37, 38) } });
      const { result } = await ready(options);
      act(() => result.current.planner!.setExtra(142.5));
      act(() => result.current.planner!.setTargetDate('2029-12'));
      expect(result.current.planner!.selected!.monthsToDebtFree).toBe(37);
      expect(result.current.planner!.target).toEqual({ status: 'onTrack', date: { month: '2029-12', year: 2029 }, months: 37, atMinimums: false });
    });

    it('2028-11 (24 months): at $884.76 the plan finishes in month 24, so on track, though the solver says $886', async () => {
      const { options } = plannerOptions({ engineOptions: { solve: { extra: 885.8, reachable: true }, avalancheByExtra: finishesFrom(884.76, 24, 25) } });
      const { result } = await ready(options);
      act(() => result.current.planner!.setExtra(884.76));
      act(() => result.current.planner!.setTargetDate('2028-11'));
      expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 24, atMinimums: false });
    });

    it('a dollar short of finishing in time is not on track: at $141 the plan takes 38 months, so $144 in all, $3 more', async () => {
      const { options } = plannerOptions({ engineOptions: { solve: { extra: 143.4, reachable: true }, avalancheByExtra: finishesFrom(142.5, 37, 38) } });
      const { result } = await ready(options);
      act(() => result.current.planner!.setExtra(141));
      act(() => result.current.planner!.setTargetDate('2029-12'));
      expect(result.current.planner!.selected!.monthsToDebtFree).toBe(38);
      expect(result.current.planner!.target).toMatchObject({ status: 'needs', months: 37, extraNeeded: 144, moreThanNow: 3 });
    });

    it('a plan that never pays off at the extra set is not on track: it needs the solver\'s amount', async () => {
      const { options } = plannerOptions({
        engineOptions: { solve: { extra: 312.4, reachable: true }, avalanche: { monthsToDebtFree: null, monthsSavedVsMinimum: null } },
      });
      const { result } = await ready(options);
      act(() => result.current.planner!.setTargetDate('2029-12'));
      expect(result.current.planner!.target).toMatchObject({ status: 'needs', extraNeeded: 313, moreThanNow: 313 });
    });
  });

  it('solves for the picked method', async () => {
    const { options, extraToFinishBy } = plannerOptions({ engineOptions: { solve: { extra: 100, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setMethod('snowball'));
    act(() => result.current.planner!.setTargetDate('2028-11')); // 24 months
    expect(extraToFinishBy).toHaveBeenLastCalledWith(expect.any(Array), 24, 'snowball');
  });

  it('is on track when the extra already set gets there (the plan finishes by the month)', async () => {
    const { options } = plannerOptions({
      engineOptions: { solve: { extra: 212.2, reachable: true }, avalancheByExtra: (extra) => ({ monthsToDebtFree: extra >= 212.2 ? 37 : 40 }) },
    });
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(250));
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 37, atMinimums: false });
  });

  it('is on track at the minimums when the solver needs no extra at all (2031-01 is 50 months, the plan takes 40)', async () => {
    const { options } = plannerOptions({ engineOptions: { solve: { extra: 0, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2031-01'));
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 50, atMinimums: true });
  });

  it('is unreachable when no extra the engine tries gets there, and never carries its limit as an amount', async () => {
    const { options } = plannerOptions({ engineOptions: { solve: { extra: 1_000_000, reachable: false } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2026-12'));
    const target = result.current.planner!.target;
    expect(target).toEqual({ status: 'unreachable', date: { month: '2026-12', year: 2026 }, months: 1 });
  });

  it('refuses a month that is not after this one, without asking the engine', async () => {
    const { options, extraToFinishBy } = plannerOptions();
    const { result } = await ready(options);
    for (const month of ['2026-11', '2026-10', '2020-01']) {
      act(() => result.current.planner!.setTargetDate(month));
      expect(result.current.planner!.target).toEqual({ status: 'past' });
    }
    expect(extraToFinishBy).not.toHaveBeenCalled();
  });

  it('refuses a month past the longest plan the engine simulates, and takes the last month that fits', async () => {
    const { options, extraToFinishBy } = plannerOptions({ engineOptions: { solve: { extra: 5, reachable: true } } });
    const { result } = await ready(options);
    // The limit is the contract's: the engine's longest timeline, counted from November 2026 (today).
    const last = addMonths('2026-11', PAYOFF_TIMELINE_MAX_MONTHS)!.month;
    const beyond = addMonths('2026-11', PAYOFF_TIMELINE_MAX_MONTHS + 1)!.month;
    act(() => result.current.planner!.setTargetDate(beyond));
    expect(result.current.planner!.target).toEqual({ status: 'tooFar', years: PAYOFF_TIMELINE_MAX_MONTHS / 12 });
    expect(extraToFinishBy).not.toHaveBeenCalled();
    act(() => result.current.planner!.setTargetDate(last));
    // The plan (40 months) finishes long before the last month the solver is asked about.
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: PAYOFF_TIMELINE_MAX_MONTHS });
    expect(extraToFinishBy).toHaveBeenLastCalledWith(expect.any(Array), PAYOFF_TIMELINE_MAX_MONTHS, 'avalanche');
    expect(result.current.planner!.targetBounds).toEqual({ min: '2026-12', max: last });
  });

  it('says "invalid" for text that is not a month, and "none" once it is cleared', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.target).toEqual({ status: 'none' });
    act(() => result.current.planner!.setTargetDate('soon'));
    expect(result.current.planner!.target).toEqual({ status: 'invalid' });
    act(() => result.current.planner!.setTargetDate(''));
    expect(result.current.planner!.target).toEqual({ status: 'none' });
    expect(result.current.planner!.targetDate).toBeNull();
    act(() => result.current.planner!.setTargetDate('2029-12'));
    act(() => result.current.planner!.setTargetDate(null));
    expect(result.current.planner!.target).toEqual({ status: 'none' });
  });

  it('shows an error, not a number, when the solver fails', async () => {
    const { options, extraToFinishBy } = plannerOptions();
    extraToFinishBy.mockImplementation(() => {
      throw new RangeError('Invalid termMonths');
    });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(result.current.planner!.target).toEqual({ status: 'error', error: { kind: 'unknown', message: 'Invalid termMonths' } });
  });

  it('treats an answer that is not a finite number as an error', async () => {
    const { options } = plannerOptions({ engineOptions: { solve: { extra: Number.POSITIVE_INFINITY, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(result.current.planner!.target.status).toBe('error');
    expect(hasNonFinite(result.current.planner!)).toBe(false);
  });
});

describe('usePayoffPlanner: no Infinity or NaN', () => {
  it('turns an engine that throws into an error state', async () => {
    const { options } = plannerOptions({ engineOptions: { throws: new RangeError('Duplicate debt id: card-1') } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.comparison).toEqual({ status: 'error', error: { kind: 'unknown', message: 'Duplicate debt id: card-1' } });
    expect(p.selected).toBeNull();
    expect(p.columns).toEqual([]);
    expect(p.order).toEqual([]);
    expect(p.chart).toBeNull();
    expect(p.savings).toBeNull();
  });

  it('turns an engine answer with a NaN or Infinity anywhere into an error state', async () => {
    for (const bad of [
      { avalanche: { totalInterest: Number.NaN } },
      { snowball: { interestSavedVsMinimum: Number.POSITIVE_INFINITY } },
      { minimum: { monthsToDebtFree: Number.POSITIVE_INFINITY } },
      { avalanche: { perDebt: [{ id: 'card-1', payoffMonth: Number.NaN, interest: 1 }] } },
    ]) {
      resetClientState();
      const { options } = plannerOptions({ engineOptions: bad });
      const { result } = await ready(options);
      expect(result.current.planner!.comparison).toEqual({ status: 'error', error: { kind: 'invalidResponse' } });
      expect(hasNonFinite(result.current.planner!)).toBe(false);
    }
  });

  it('keeps every number in a normal VM finite, with a never-paying plan and a target in the mix', async () => {
    const { options } = plannerOptions({ engineOptions: { avalanche: { monthsToDebtFree: null, monthsSavedVsMinimum: null }, solve: { extra: 80, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(hasNonFinite(result.current.planner!)).toBe(false);
  });
});

describe('usePayoffPlanner: events', () => {
  it('sends tool_opened (payoff) and payoff_planned with the method, once, when the first plan shows', async () => {
    const { options, track } = plannerOptions();
    const { result } = await ready(options);
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      { name: 'tool_opened', props: { tool: 'payoff' } },
      { name: 'payoff_planned', props: { method: 'avalanche' } },
    ]);
    // Moving the extra, the target or re-rendering sends nothing more.
    act(() => result.current.planner!.setExtra(200));
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('asks the sender for once-per-session semantics on both events', async () => {
    const { options, track } = plannerOptions();
    await ready(options);
    expect(track.mock.calls[0]![1]).toEqual({ once: 'tool:payoff' });
    expect(track.mock.calls[1]![1]).toEqual({ once: 'payoff_planned' });
  });

  // The issue: "payoff_planned {method} when a plan is first computed with at least one debt". One event, with
  // the method of that first plan; trying the other method afterwards is not a new plan.
  it('sends payoff_planned once, for the first plan: switching the method later sends nothing', async () => {
    const { options, track } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.planner!.setMethod('snowball'));
    act(() => result.current.planner!.setMethod('avalanche'));
    act(() => result.current.planner!.setMethod('snowball'));
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      { name: 'tool_opened', props: { tool: 'payoff' } },
      { name: 'payoff_planned', props: { method: 'avalanche' } },
    ]);
  });

  it('names the saved method when the first plan is the saved one', async () => {
    const { options, track } = plannerOptions({ stored: { method: 'snowball', extra: 0 } });
    await ready(options);
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      { name: 'tool_opened', props: { tool: 'payoff' } },
      { name: 'payoff_planned', props: { method: 'snowball' } },
    ]);
  });

  it('carries the method only: no amount, date, id or count', async () => {
    const { options, track } = plannerOptions();
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(777));
    act(() => result.current.planner!.setTargetDate('2029-12'));
    const planned = track.mock.calls.map((c) => c[0]).find((e) => e.name === 'payoff_planned')!;
    expect(Object.keys(planned.props)).toEqual(['method']);
    const sent = JSON.stringify(track.mock.calls);
    for (const personal of ['777', '2029', '6400', '17800', '28000', '52200', '24.36', 'card-1', 'new-loan']) expect(sent).not.toContain(personal);
  });

  it('sends nothing when there are no debts or the engine failed', async () => {
    const failing = plannerOptions({ engineOptions: { throws: new RangeError('x') } });
    await ready(failing.options);
    expect(failing.track).not.toHaveBeenCalled();
  });
});

describe('usePayoffPlanner: saved inputs', () => {
  it('starts from the stored method, extra and target (24 months from November 2026 is November 2028)', async () => {
    const { options, comparePayoff } = plannerOptions({ stored: { method: 'snowball', extra: 250, targetMonths: 24 } });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.method).toBe('snowball');
    expect(p.extra.value).toBe(250);
    expect(p.targetDate).toBe('2028-11');
    expect(comparePayoff.mock.lastCall![1]).toBe(250);
  });

  it('reads a stored value it cannot use as "not set" (a negative extra, a month count out of range)', async () => {
    const { options } = plannerOptions({ stored: { method: 'avalanche', extra: -40, targetMonths: 5_000 } });
    const { result } = await ready(options);
    expect(result.current.planner!.extra.value).toBe(0);
    expect(result.current.planner!.target.status).not.toBe('needs');
  });

  it('saves nothing until the person changes something', async () => {
    const onStore = vi.fn<(state: PayoffStoredState) => void>();
    const { options } = plannerOptions({ onStore });
    await ready(options);
    expect(onStore.mock.calls).toHaveLength(0);
  });

  it('saves the method, the extra and the target as months from today after each change', async () => {
    const onStore = vi.fn<(state: PayoffStoredState) => void>();
    const { options } = plannerOptions({ onStore, engineOptions: { solve: { extra: 100, reachable: true } } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setMethod('snowball'));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'snowball', extra: 0 });
    act(() => result.current.planner!.setExtra(125));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'snowball', extra: 125 });
    act(() => result.current.planner!.setTargetDate('2029-12'));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'snowball', extra: 125, targetMonths: 37 });
  });

  it('does not save a target it cannot use (past, too far, not a month), and drops a saved one', async () => {
    const onStore = vi.fn<(state: PayoffStoredState) => void>();
    const { options } = plannerOptions({ onStore, stored: { method: 'avalanche', extra: 0, targetMonths: 12 } });
    const { result } = await ready(options);
    act(() => result.current.planner!.setTargetDate('2026-01'));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'avalanche', extra: 0 });
    act(() => result.current.planner!.setTargetDate(addMonths('2026-11', PAYOFF_TIMELINE_MAX_MONTHS + 2)!.month));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'avalanche', extra: 0 });
    act(() => result.current.planner!.setTargetDate('soon'));
    expect(onStore).toHaveBeenLastCalledWith({ method: 'avalanche', extra: 0 });
  });

  it('stays on screen when the storage throws (a full or blocked browser store)', async () => {
    const { options } = plannerOptions({
      onStore: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const { result } = await ready(options);
    act(() => result.current.planner!.setExtra(50));
    expect(result.current.planner!.extra.value).toBe(50);
  });
});

describe('usePayoffPlanner: streamer mode', () => {
  it('computes and shows nothing personal, and sends no events', async () => {
    const { options, comparePayoff, extraToFinishBy, track } = plannerOptions({ streamer: true });
    const { result } = await ready(options);
    const p = result.current.planner!;
    expect(p.hidden).toBe(true);
    expect(comparePayoff).not.toHaveBeenCalled();
    expect(extraToFinishBy).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(p.selected).toBeNull();
    expect(p.columns).toEqual([]);
    expect(p.order).toEqual([]);
    expect(p.chart).toBeNull();
    expect(p.savings).toBeNull();
    expect(p.fix).toBeNull();
    expect(p.target).toEqual({ status: 'none' });
    expect(p.debtFreeDate).toBeNull();
  });

  it('is shown again when streamer mode is switched off', async () => {
    const { options } = plannerOptions({ streamer: true });
    const hook = await ready(options);
    hook.rerender({ options: { ...options, streamer: false } });
    expect(hook.result.current.planner!.hidden).toBe(false);
    expect(hook.result.current.planner!.selected).not.toBeNull();
  });
});

describe('usePayoffPlanner: where debts are edited', () => {
  it('points at the balance sheet (S8)', async () => {
    const { options } = plannerOptions();
    const { result } = await ready(options);
    expect(result.current.planner!.balanceSheetHref).toBe('/me/balance');
  });
});
