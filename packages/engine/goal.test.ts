import { expect, it } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { COST_CATEGORIES, GoalSchema, type CostCategory, type Profile } from '@lifeguessr/types';
import { extraSavingToReach, goalReachMonth, goalStatus, movesTowardGoal } from './goal';
import { applyPatch, forecast } from './forecast';
import { rankMoves } from './moves';
const real = { todaysDollars: true };
function measured(): Profile {
  const p = cloneProfileDemo();
  for (const field of [
    'age',
    'cash',
    'retirement',
    'retirementShare',
    'takeHomePay',
  ] as const)
    p[field].isEstimate = false;
  for (const value of Object.values(p.spending)) value.isEstimate = false;
  for (const debt of p.debts) debt.minPayment.isEstimate = false;
  return p;
}
it('zero bands only yield onTrack or behind, including an exact target', () => {
  const p = measured(),
    mid = forecast(p, 10, real).in10y.mid;
  expect(goalStatus(p, { target: mid, years: 10 }).verdict).toBe('onTrack');
  expect(goalStatus(p, { target: mid + 1, years: 10 }).verdict).toBe('behind');
  expect(goalStatus(p, { target: mid - 1, years: 10 }).verdict).toBe('onTrack');
});
it('uses the input uncertainty band and forces real dollars', () => {
  const p = cloneProfileDemo(),
    f = forecast(p, 10, real).in10y;
  expect(
    goalStatus(p, { target: f.mid, years: 10 }, { todaysDollars: false })
      .verdict,
  ).toBe('withinRange');
  expect(goalStatus(p, { target: f.low - 1, years: 10 }).verdict).toBe(
    'onTrack',
  );
  expect(goalStatus(p, { target: f.high + 1, years: 10 }).verdict).toBe(
    'behind',
  );
});
it('solves saving to within one dollar at the horizon, monotonically and within the pay cap', () => {
  const p = measured(),
    mid = forecast(p, 10, real).in10y.mid;
  const goal = { target: mid + 10000, years: 10 };
  const saving = extraSavingToReach(p, goal);
  expect(saving.reachable).toBe(true);
  const result = forecast(p, 10, { ...real, extraMonthly: saving.extraMonthly })
    .in10y.mid;
  expect(result).toBeGreaterThanOrEqual(goal.target);
  expect(result - goal.target).toBeLessThanOrEqual(1);
  expect(
    extraSavingToReach(p, { ...goal, target: goal.target + 10000 })
      .extraMonthly,
  ).toBeGreaterThan(saving.extraMonthly);
  expect(extraSavingToReach(p, { ...goal, target: mid - 1 })).toEqual({
    extraMonthly: 0,
    reachable: true,
  });
  expect(extraSavingToReach(p, { ...goal, target: 1e12 })).toEqual({
    extraMonthly: p.takeHomePay.value,
    reachable: false,
  });
});
it('reforecasts combined interacting patches at the chosen horizon', () => {
  const p = measured(),
    goal = { target: 1e7, years: 5 },
    moves = rankMoves(p),
    result = movesTowardGoal(p, goal, moves);
  const changed = moves.reduce(
    (profile, move) => applyPatch(profile, move.patch),
    p,
  );
  expect(result.combined.effect).toBeCloseTo(
    forecast(changed, 5, real).points[60]!.mid -
      forecast(p, 5, real).points[60]!.mid,
  );
  const met = movesTowardGoal(p, { target: 1, years: 10 }, moves);
  expect(met.perMove.every((m) => m.shareOfGap === null)).toBe(true);
  expect(met.combined.shareOfGap).toBeNull();
});
it('handles negative net worth and the minimum/maximum horizon', () => {
  const p = measured();
  p.cash.value = 0;
  p.retirement.value = 0;
  p.takeHomePay.value = 0;
  for (const years of [1, 30]) {
    const result = goalStatus(p, { target: 100000, years });
    expect(result.projected.month).toBe(years * 12);
    expect(result.progress).toBeLessThan(0);
    expect(extraSavingToReach(p, result.goal)).toEqual({
      extraMonthly: 0,
      reachable: false,
    });
  }
});
it('rejects malformed goal contracts and saving options', () => {
  for (const goal of [
    { target: 0, years: 10 },
    { target: Infinity, years: 10 },
    { target: 1, years: 1.5 },
    { target: 1, years: 31 },
  ])
    expect(GoalSchema.safeParse(goal).success).toBe(false);
  expect(() => forecast(measured(), 10, { extraMonthly: -1 })).toThrow(
    RangeError,
  );
});

it('goalReachMonth: the first month the plan reaches the target, with and without a purchase', () => {
  // No growth: net worth = 5,000 + 1,000·m. $10,000 is reached in month 5; after a $2,500 cash
  // purchase, 2,500 + 1,000·m ≥ 10,000 needs m = 7.5, so month 8 (3 months later).
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? 4000 : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  const p: Profile = {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: 5000, isEstimate: false },
    spending,
    cash: { value: 5000, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: [],
    doneMoveIds: [],
  };
  const rates = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };
  const goal = { target: 10_000, years: 1 };
  expect(goalReachMonth(p, goal, { rates })).toBe(5);
  const car = { label: 'Car', amount: 2500, recurring: false as const, payWith: 'cash' as const, startMonth: 0 };
  expect(goalReachMonth(p, goal, { rates, extra: [car] })).toBe(8);
  // 1 + 10 slack years = 132 months: 5,000 + 1,000·132 = 137,000 < 200,000.
  expect(goalReachMonth(p, { target: 200_000, years: 1 }, { rates })).toBeNull();
});
