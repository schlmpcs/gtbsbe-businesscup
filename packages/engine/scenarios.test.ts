// Scenarios, Compare and moves on the plan (MP6, #166): the issue's tests. Expected numbers are worked
// out in the comments.
import { describe, expect, it } from 'vitest';
import type { CostCategory, PlanEventOf, PlanResult, Profile, Scenario } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import type { MoveCandidate } from './moves';
import { plan } from './plan';
import { baselineScenario, compareScenarios, duplicateScenario, planMoveEffects } from './scenarios';

/** Demo profile at the accounts' latest month, ZIP 75206 (as in plan.test.ts). */
const demo: Profile = { ...structuredClone(profileDemo), asOf: '2026-11' };
const area = areaByZip('75206');

/** The plan with event ids (and the account rows named after them, `<eventId>:home`) renamed. */
function renameIds(r: PlanResult, ids: ReadonlyMap<string, string>): PlanResult {
  const rename = (id: string) => {
    const [head, ...rest] = id.split(':');
    const to = ids.get(head!);
    return to === undefined ? id : [to, ...rest].join(':');
  };
  return {
    ...r,
    years: r.years.map((y) => ({
      ...y,
      events: y.events.map(rename),
      accounts: y.accounts.map((row) => ({ ...row, accountId: rename(row.accountId) })),
    })),
  };
}

describe('duplicateScenario', () => {
  it('duplicate → identical plan(); editing B does not change A', () => {
    const a = structuredClone(scenarioDemo) as Scenario; // Retire, Social Security, Buy a home (a `<id>:home` row)
    const b = duplicateScenario(a, 'Plan B', [a.id]);
    expect(b.id).not.toBe(a.id);
    expect(b.name).toBe('Plan B');
    const ids = new Map(a.events.map((e, i) => [e.id, b.events[i]!.id]));
    for (const [from, to] of ids) expect(to).not.toBe(from);
    expect(new Set(ids.values()).size).toBe(a.events.length);

    const planA = plan(demo, accountsDemo, a, area);
    expect(plan(demo, accountsDemo, b, area)).toEqual(renameIds(planA, ids));

    // Edits to B reach into every nested object: A and its plan stay as they were.
    const before = structuredClone(a);
    b.assumptions.retireAge = 60;
    b.assumptions.withdrawalOrder.reverse();
    b.assumptions.savingsSplit[0]!.share = 0.5;
    b.events[0]!.year += 1;
    (b.events.find((e) => e.type === 'buyHome') as PlanEventOf<'buyHome'>).insuranceMonthly.value = 1;
    b.events.push({ id: 'ev-windfall', type: 'windfall', year: 2030, enabled: true, amount: 5000 });
    expect(a).toEqual(before);
    expect(plan(demo, accountsDemo, a, area)).toEqual(planA);
  });
});

describe('compareScenarios', () => {
  it('compare of identical scenarios → all diffs 0, firstYearBAhead null', () => {
    // Baseline for the demo person (32 in 2026, born 1994): Retire at 67 = 2061. Plan B is its
    // duplicate, so every year and KPI is the same number and nobody leads in the year A retires.
    const s = baselineScenario(demo, area, '2026-11');
    const planA = plan(demo, accountsDemo, s, area);
    const planB = plan(demo, accountsDemo, duplicateScenario(s, 'Plan B', [s.id]), area);
    const c = compareScenarios(planA, planB);

    expect(c.years.map((y) => y.year)).toEqual(planA.years.map((y) => y.year));
    for (const y of c.years) expect(y.diff).toBe(0);
    expect(c.kpis.map((k) => k.key)).toEqual(['netWorthEndOfYear', 'netWorthAtRetirement', 'retireAge', 'netWorthAtEnd', 'shortfallAge']);
    for (const k of c.kpis) expect(k.diff === 0 || (k.a === null && k.b === null && k.diff === null)).toBe(true);
    expect(c.firstYearBAhead).toBeNull();
    expect(c.sentence).toEqual({ leader: null, amount: 0, year: 2061, age: 67, since: null });
  });
});

describe('planMoveEffects', () => {
  /** A 66-year-old in January 2026 with only an `other` spending line, nothing saved yet. */
  const person: Profile = {
    age: { value: 66, isEstimate: false },
    takeHomePay: { value: 3000, isEstimate: false },
    spending: Object.fromEntries(COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? 1000 : 0, isEstimate: false }])) as
      Record<CostCategory, { value: number; isEstimate: boolean }>,
    cash: { value: 0, isEstimate: false },
    retirement: { value: 0, isEstimate: false },
    retirementShare: { value: 0, isEstimate: false },
    debts: [],
    doneMoveIds: [],
    asOf: '2026-01',
  };
  // Retires at 67 (2027) and the plan ends then; savings all to cash, as baselineScenario sets for a
  // retirementShare of 0. No inflation: pay is flat and today's dollars = nominal (deflator 1).
  const scenario: Scenario = {
    id: 's', name: 'Test', events: [],
    assumptions: {
      retireAge: 67, endAge: 67, inflation: 0, display: 'today', expenses: { mode: 'budget' },
      growth: { cash: 0, retirement: 1.01 ** 12 - 1 }, // retirement: 1% a month
      withdrawalOrder: ['cash', 'investments', 'retirement'], savingsSplit: [{ group: 'cash', share: 1 }],
    },
  };
  const moves: MoveCandidate[] = [
    { id: 'refinance', kind: 'refinance', level: 2, patch: {} },
    { id: 'cutCategory:other', kind: 'cutCategory', level: 1, category: 'other', patch: { spending: { other: 900 } } },
    { id: 'hsa', kind: 'hsa', level: 2, patch: {} },
    { id: 'retirementMatch', kind: 'retirementMatch', level: 2, patch: { retirementShare: 1 } },
  ];

  it('"raise retirement share" increases effectAtRetirement; order stable', () => {
    // Surplus S = 3000 − 1000 = 2000 a month over 24 months (Jan 2026 – Dec 2027, the retirement year).
    // Each month the balance grows first, then the month's savings are added: after n months a group
    // fed s a month at monthly rate m holds s × ((1 + m)^n − 1) / m (s × n at m = 0).
    // - retirementMatch (retirementShare 0 → 1; the split becomes retirement 1): S to retirement at 1%
    //   instead of cash at 0%: 2000 × ((1.01^24 − 1) / 0.01 − 24) = 2000 × (26.97346485 − 24) = 5946.93.
    // - cutCategory:other (1000 → 900): 100 more a month to cash at 0%: 100 × 24 = 2400.
    // - hsa, refinance: empty patches, 0; the tie keeps the kind order (hsa before refinance).
    // The plan ends in the retirement year, so effectAtEnd = effectAtRetirement.
    const r = planMoveEffects(person, [], scenario, moves);
    expect(r.map((e) => e.moveId)).toEqual(['retirementMatch', 'cutCategory:other', 'hsa', 'refinance']);
    expect(r[0]!.effectAtRetirement).toBeCloseTo(5946.93, 2);
    expect(r[0]!.effectAtEnd).toBeCloseTo(5946.93, 2);
    expect(r[1]!.effectAtRetirement).toBeCloseTo(2400, 6);
    expect(r[2]!.effectAtRetirement).toBe(0);
    expect(r[3]!.effectAtRetirement).toBe(0);
    for (const e of r) expect(e.successRateDelta).toBeUndefined();

    // Same answer whatever order the moves come in, and on every call.
    expect(planMoveEffects(person, [], scenario, [...moves].reverse())).toEqual(r);
    expect(planMoveEffects(person, [], scenario, moves)).toEqual(r);
  });

  it.todo('successRateDelta with the same seed is 0 for a no-op move (needs monteCarlo, MP5)');
});
