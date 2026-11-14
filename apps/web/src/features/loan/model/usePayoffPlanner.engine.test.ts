// @vitest-environment jsdom
// The debt payoff planner on the REAL payoff engine (comparePayoff, extraToFinishBy, suggestedPayoffExtra; M12, #144), with
// Loan Lab's own hook beside it. The planner opens at the engine's suggested extra, as it ships; the tests about plans
// "at $0" set the extra to $0 first, which is a pick like any other.
// usePayoffPlanner.test.ts checks what the view-model does with an answer on a fake engine; this file checks that the
// answers the real engine gives come through right: equal to the engine's own numbers and to the payoff order card
// Loan Lab has always shown. Today is November 2026 (injected).
import { comparePayoff, extraToFinishBy, suggestedPayoffExtra } from '@lifeguessr/engine';
import type { Debt } from '@lifeguessr/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { useAppStore } from '@/state';
import { resetClientState } from '@/test/clientState';
import { hasNonFinite } from './finite';
import { useLoanLab } from './useLoanLab';
import { usePayoffPlanner, type PayoffPlannerOptions } from './usePayoffPlanner';

beforeEach(resetClientState);

const options = (): PayoffPlannerOptions => ({
  engine: { comparePayoff, extraToFinishBy, suggestedPayoffExtra },
  track: vi.fn(),
  today: () => ({ month: '2026-11' }),
});

async function ready(labOptions: Parameters<typeof useLoanLab>[0] = {}) {
  const opts = options();
  const hook = renderHook(() => {
    const lab = useLoanLab(labOptions);
    return { lab, planner: usePayoffPlanner(lab, opts) };
  });
  await waitFor(() => expect(hook.result.current.lab.status).toBe('ready'));
  return hook;
}

/** `ready`, then the extra set to $0: the minimum payments alone, with every freed payment rolled into the next debt. */
async function readyAtZero(labOptions: Parameters<typeof useLoanLab>[0] = {}) {
  const hook = await ready(labOptions);
  act(() => hook.result.current.planner!.setExtra(0));
  return hook;
}

/** The demo profile's two debts and sample offer 1 ($28,000 at 6.9%, no down payment or fees) as a third, with its monthly payment. */
const demoDebtsWithOffer1 = (monthly: number): Debt[] => [
  { id: 'card-1', kind: 'card', balance: 6_400, apr: 0.2436, minPayment: { value: 193.92, isEstimate: true } },
  { id: 'auto-1', kind: 'auto', balance: 17_800, apr: 0.074, minPayment: { value: 412, isEstimate: false } },
  { id: 'new-loan', kind: 'personal', balance: 28_000, apr: 0.069, minPayment: { value: monthly, isEstimate: false } },
];

describe('the planner on the real engine: demo debts plus offer 1', () => {
  it('opens at the real suggestion, $25 (half of the $75.80 left once the new loan is paid, in $25 steps), and the real comparePayoff at it', async () => {
    const { result } = await ready();
    const monthly = result.current.lab.offers[0]!.result!.monthly;
    expect(monthly).toBeCloseTo(863.28, 2); // ENGINEERING.md known value
    const debts = demoDebtsWithOffer1(monthly);
    const p = result.current.planner!;
    expect(p.suggestion).toEqual(suggestedPayoffExtra(cloneProfileDemo(), debts, { step: 25 }));
    expect(p.suggestion!.surplus).toBeCloseTo(939.08 - 863.28, 2);
    expect(p.extra.value).toBe(25);
    expect(p.extraIsSuggested).toBe(true);
    expect(p.comparison).toEqual({ status: 'ready', data: comparePayoff(debts, 25) });
  });

  it('opens with methods that visibly differ from minimums only, and says why avalanche and snowball match on these debts', async () => {
    const { result } = await ready();
    const p = result.current.planner!;
    // 42 months and about $9,170 against minimums only's 43 months and $9,684 (packages/engine/loan/payoff.test.ts).
    expect(p.columns.map((c) => c.monthsToDebtFree)).toEqual([42, 42, 43]);
    expect(p.columns[0]!.totalInterest!).toBeLessThan(p.columns[2]!.totalInterest! - 500);
    expect(p.savings!.interest.kind).toBe('saves');
    expect(p.savings!.months).toEqual({ kind: 'saves', amount: 1 });
    // Card (24.36%, $6,400), car loan (7.4%, $17,800), new loan (6.9%, $28,000): by rate and by balance alike.
    expect(p.selected!.order).toEqual(['card-1', 'auto-1', 'new-loan']);
    expect(p.tie).toBe('sameOrder');
  });

  it("avalanche at extra $0 is what Loan Lab's own payoff order card shows: 43 months, $9,684.10 of interest, the same order", async () => {
    const { result } = await readyAtZero();
    const own = result.current.lab.payoffPlan!; // the card the planner replaces (engine payoffOrder, avalanche, extra 0)
    const p = result.current.planner!;
    expect(p.order.map((r) => ({ id: r.id, kind: r.kind, isNew: r.isNew, apr: r.apr, balance: r.balance }))).toEqual(
      own.steps.map((s) => ({ id: s.id, kind: s.kind, isNew: s.isNew, apr: s.apr, balance: s.balance })),
    );
    expect(own.payoffMonth).toBe(43);
    expect(p.selected!.monthsToDebtFree).toBe(43);
    expect(p.selected!.totalInterest).toBeCloseTo(9_684.1, 2);
    expect(p.selected!.totalInterest).toBeCloseTo(own.totalInterest, 6);
    expect(p.debtFreeDate).toEqual({ month: '2030-06', year: 2030 }); // 43 months after November 2026
  });

  it('has all three methods equal at extra $0: the minimums already roll each freed payment into the next debt', async () => {
    const { result } = await readyAtZero();
    const [a, s, m] = result.current.planner!.columns;
    expect([a!.method, s!.method, m!.method]).toEqual(['avalanche', 'snowball', 'minimum']);
    expect(new Set([a!.monthsToDebtFree, s!.monthsToDebtFree, m!.monthsToDebtFree]).size).toBe(1);
    expect(new Set([a!.totalInterest, s!.totalInterest, m!.totalInterest]).size).toBe(1);
    expect([a!.interestSaved, s!.interestSaved]).toEqual([0, 0]);
    expect(result.current.planner!.savings).toEqual({ interest: { kind: 'same', amount: 0 }, months: { kind: 'same', amount: 0 } });
    // and the screen says why, instead of leaving three identical columns unexplained
    expect(result.current.planner!.tie).toBe('noExtra');
    expect(result.current.planner!.extraIsSuggested).toBe(false);
  });

  it('follows the extra and the method: $150 extra, snowball, is the real snowball plan for $150', async () => {
    const { result } = await ready();
    const monthly = result.current.lab.offers[0]!.result!.monthly;
    act(() => result.current.planner!.setExtra(150));
    act(() => result.current.planner!.setMethod('snowball'));
    const expected = comparePayoff(demoDebtsWithOffer1(monthly), 150);
    const p = result.current.planner!;
    expect(p.selected).toEqual(expected.snowball);
    expect(p.monthsSaved).toBe(expected.snowball.monthsSavedVsMinimum);
    expect(p.monthsSaved!).toBeGreaterThan(0); // paying $150 a month more finishes sooner than the minimums
    expect(p.interestSaved!).toBeGreaterThan(0);
    expect(hasNonFinite(p)).toBe(false);
  });

  it('has no NaN or Infinity anywhere in its answer, at the suggestion, at $0 and at a very large extra', async () => {
    const { result } = await ready();
    expect(hasNonFinite(result.current.planner)).toBe(false);
    act(() => result.current.planner!.setExtra(0));
    expect(hasNonFinite(result.current.planner)).toBe(false);
    act(() => result.current.planner!.setExtra(1e12)); // clamped to the box's limit
    expect(hasNonFinite(result.current.planner)).toBe(false);
    expect(result.current.planner!.selected!.monthsToDebtFree).toBe(1); // $100,000 a month clears $52,200 in the first month
  });
});

describe('the target date on the real engine', () => {
  it('2029-12 is 37 months away; the extra it shows, fed back to the engine, finishes by then', async () => {
    const { result } = await readyAtZero();
    const monthly = result.current.lab.offers[0]!.result!.monthly;
    act(() => result.current.planner!.setTargetDate('2029-12'));
    const t = result.current.planner!.target;
    if (t.status !== 'needs') throw new Error(`expected needs, got ${t.status}`);
    expect(t.months).toBe(37);
    expect(t.moreThanNow).toBe(t.extraNeeded); // no extra set yet
    const debts = demoDebtsWithOffer1(monthly);
    expect(comparePayoff(debts, t.extraNeeded).avalanche.monthsToDebtFree!).toBeLessThanOrEqual(37);
    // and the solver's own answer is not a loose one: a clearly smaller extra does not finish in time
    expect(comparePayoff(debts, t.extraNeeded - 5).avalanche.monthsToDebtFree!).toBeGreaterThan(37);
    // typing that amount makes it on track
    act(() => result.current.planner!.setExtra(t.extraNeeded));
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 37, atMinimums: false });
  });

  it('on track is what the plan on screen says, at every extra: the solver\'s $1 tolerance never contradicts it', async () => {
    const { result } = await ready();
    const monthly = result.current.lab.offers[0]!.result!.monthly;
    const debts = demoDebtsWithOffer1(monthly);
    // 2029-12 (37 months) and 2028-11 (24 months), across the range around the least extra that works; 142.5 and
    // 884.76 are the amounts where the solver's answer was $1 above what the plan needs.
    for (const [month, months, extras] of [
      ['2029-12', 37, [0, 100, 140, 141, 142, 142.5, 143, 143.5, 144, 150, 300]],
      ['2028-11', 24, [800, 880, 884, 884.76, 885, 885.5, 886, 887, 900]],
    ] as const) {
      act(() => result.current.planner!.setTargetDate(month));
      for (const extra of extras) {
        act(() => result.current.planner!.setExtra(extra));
        const p = result.current.planner!;
        const finishes = p.selected!.monthsToDebtFree !== null && p.selected!.monthsToDebtFree <= months;
        expect(p.target.status === 'onTrack', `${month} at $${extra}`).toBe(finishes);
        if (p.target.status === 'needs') {
          // what it asks for really finishes by the month, and is more than what is set
          expect(comparePayoff(debts, p.target.extraNeeded).avalanche.monthsToDebtFree!, `${month} at $${extra}`).toBeLessThanOrEqual(months);
          expect(p.target.extraNeeded).toBeGreaterThan(extra);
        }
      }
    }
  });

  it('is on track at the minimums for a month long after the plan ends', async () => {
    const { result } = await ready();
    act(() => result.current.planner!.setTargetDate('2031-01')); // 50 months; the plan takes 43
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 50, atMinimums: true });
  });
});

describe('"your minimum payments finish by" is about the Minimums-only plan, on the real engine', () => {
  // The demo's two debts with the car loan listed first and no offer. With no extra, avalanche pays the card first
  // (24.36%) and ends in 52 months; the Minimums-only plan pays in the order listed, car loan first, and ends in 53.
  // Those two month counts are the review's, read off two separate comparePayoff calls, not off the planner.
  const auto: Debt = { id: 'auto-1', kind: 'auto', balance: 17_800, apr: 0.074, minPayment: { value: 412, isEstimate: false } };
  const card: Debt = { id: 'card-1', kind: 'card', balance: 6_400, apr: 0.2436, minPayment: { value: 193.92, isEstimate: true } };

  async function plannerOnAutoThenCard() {
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts: [auto, card] } });
    return readyAtZero({ initialOffers: [] });
  }

  it('starts from a real case: avalanche at $0 beats the Minimums-only plan by a month', () => {
    const real = comparePayoff([auto, card], 0);
    expect(real.avalanche.monthsToDebtFree).toBe(52);
    expect(real.minimum.monthsToDebtFree).toBe(53);
  });

  it('a target of month 52: on track by avalanche, but not "at the minimums", since the Minimums-only column ends in month 53', async () => {
    const { result } = await plannerOnAutoThenCard();
    act(() => result.current.planner!.setTargetDate('2031-03')); // 52 months after November 2026
    const p = result.current.planner!;
    expect(p.columns.map((c) => [c.method, c.monthsToDebtFree])).toEqual([['avalanche', 52], ['snowball', 52], ['minimum', 53]]);
    expect(p.target).toMatchObject({ status: 'onTrack', months: 52, atMinimums: false });
  });

  it('a target of month 53: the Minimums-only plan finishes in time, so it is on track at the minimums', async () => {
    const { result } = await plannerOnAutoThenCard();
    act(() => result.current.planner!.setTargetDate('2031-04')); // 53 months after November 2026
    expect(result.current.planner!.target).toMatchObject({ status: 'onTrack', months: 53, atMinimums: true });
  });
});

describe('a plan that never pays off, on the real engine', () => {
  // $6,400 at 24% a year is $128 of interest in the first month, and the person's own minimum is $100.
  const card: Debt = { id: 'card-1', kind: 'card', balance: 6_400, apr: 0.24, minPayment: { value: 100, isEstimate: false } };

  it('says it never pays off, shows no total and no Infinity, and the extra it names does clear it within 10 years', async () => {
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts: [card] } });
    const { result } = await readyAtZero({ initialOffers: [] }); // at the minimum alone
    const p = result.current.planner!;
    expect(p.columns.map((c) => c.monthsToDebtFree)).toEqual([null, null, null]);
    expect(p.columns.map((c) => c.totalInterest)).toEqual([null, null, null]);
    expect(p.debtFreeDate).toBeNull();
    expect(p.savings).toBeNull();
    expect(p.chart!.horizonMonths).toBe(120);
    expect(hasNonFinite(p)).toBe(false);
    expect(p.fix!.extra).not.toBeNull();
    expect(comparePayoff([card], p.fix!.extra!).avalanche.monthsToDebtFree!).toBeLessThanOrEqual(120);
  });

  it('gives a target month an amount that works, with no NaN', async () => {
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts: [card] } });
    const { result } = await readyAtZero({ initialOffers: [] });
    act(() => result.current.planner!.setTargetDate('2027-11')); // 12 months
    const t = result.current.planner!.target;
    if (t.status !== 'needs') throw new Error(`expected needs, got ${t.status}`);
    expect(comparePayoff([card], t.extraNeeded).avalanche.monthsToDebtFree!).toBeLessThanOrEqual(12);
    expect(hasNonFinite(result.current.planner)).toBe(false);
  });
});

describe('snowball slower than minimums, on the real engine', () => {
  // Found by searching random debt sets: with no extra, snowball clears these three 165 months after the minimums do.
  const debts: Debt[] = [
    { id: 'd1', kind: 'personal', balance: 18_400, apr: 0.104, minPayment: { value: 245, isEstimate: false } },
    { id: 'd2', kind: 'personal', balance: 10_200, apr: 0.286, minPayment: { value: 233, isEstimate: false } },
    { id: 'd3', kind: 'personal', balance: 5_200, apr: 0.238, minPayment: { value: 99, isEstimate: false } },
  ];

  it('says it takes longer and costs more, never a saving', async () => {
    const real = comparePayoff(debts, 0).snowball;
    expect(real.monthsSavedVsMinimum!).toBeLessThan(0); // the case this test is about; the engine's own sign
    useAppStore.setState({ profile: { ...cloneProfileDemo(), debts } });
    const { result } = await readyAtZero({ initialOffers: [] });
    act(() => result.current.planner!.setMethod('snowball'));
    const p = result.current.planner!;
    expect(p.monthsSaved).toBe(real.monthsSavedVsMinimum);
    expect(p.savings!.months).toEqual({ kind: 'costs', amount: -real.monthsSavedVsMinimum! });
    expect(p.savings!.interest.kind).toBe(real.interestSavedVsMinimum < 0 ? 'costs' : 'saves');
    expect(hasNonFinite(p)).toBe(false);
  });
});
