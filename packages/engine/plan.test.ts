/// <reference types="node" />
// plan() (MP3, #163): the issue's tests. Expected numbers are worked out in the comments. The golden
// case is a vitest snapshot (__snapshots__/plan.test.ts.snap); `pnpm fixtures:plan` runs it with
// PLAN_FIXTURE_WRITE=1 to write the same result as packages/data/fixtures/plan.demo.json.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, CostCategory, PlanAssumptions, PlanEvent, PlanResult, Profile, Scenario } from '@lifeguessr/types';
import { COST_CATEGORIES, PlanResultSchema } from '@lifeguessr/types';
import { areaByZip, profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo, scenarioDemo } from '@lifeguessr/data/fixtures/plan';
import { profileToAccounts } from './accounts';
import { forecast } from './forecast';
import { plan } from './plan';

const assumptions = (o: Partial<PlanAssumptions> = {}): PlanAssumptions => ({
  retireAge: 67, endAge: 90, inflation: 0.03, display: 'future', expenses: { mode: 'budget' }, growth: {},
  withdrawalOrder: ['cash', 'investments', 'retirement'], savingsSplit: [], ...o,
});
const scenario = (a: Partial<PlanAssumptions> = {}, events: PlanEvent[] = []): Scenario =>
  ({ id: 's', name: 'Test', assumptions: assumptions(a), events });

/** A 30-year-old in January 2026 with only an `other` spending line. */
function person(o: { pay: number; other: number; share?: number }): Profile {
  const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? o.other : 0, isEstimate: false }])) as
    Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false }, takeHomePay: { value: o.pay, isEstimate: false }, spending,
    cash: { value: 0, isEstimate: false }, retirement: { value: 0, isEstimate: false },
    retirementShare: { value: o.share ?? 0, isEstimate: false }, debts: [], doneMoveIds: [], asOf: '2026-01',
  };
}
const account = (id: string, group: Account['group'], balance: number): Account =>
  ({ id, group, name: id, balance: { value: balance, isEstimate: false }, history: [] });
const row = (r: PlanResult, y: number, id: string) => r.years[y]!.accounts.find((a) => a.accountId === id)!;

/** Every number rounded to cents (the fixture's precision). */
const cents = (v: unknown): unknown =>
  typeof v === 'number' ? Math.round(v * 100) / 100 + 0
    : Array.isArray(v) ? v.map(cents)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cents(x)])) : v;

describe('plan', () => {
  it('no events, demo profile: year 1 net worth equals forecast() month 12 within $1', () => {
    // asOf January: the first calendar year ends at month 12. Same inflation (3%), the profile's
    // retirementShare (empty savingsSplit), nominal dollars: the same simulate() run as forecast().
    const p: Profile = { ...structuredClone(profileDemo), asOf: '2026-01' };
    const r = plan(p, profileToAccounts(p), scenario());
    expect(Math.abs(r.years[0]!.netWorth - forecast(p).points[12]!.mid)).toBeLessThan(1);
  });

  it('zero income, $10k cash, $2k/month: cash runs out in month 5, then the shortfall grows', () => {
    // No inflation, no cash yield: cash 10000 − 2000 m is 0 at the end of May (month 5); June–December
    // (7 months) are unfunded: shortfall 14000 at the end of 2026, + 24000 → 38000 at the end of 2027.
    const r = plan(person({ pay: 0, other: 2000 }), [account('cash-1', 'cash', 10_000)],
      scenario({ inflation: 0, growth: { cash: 0 } }));
    expect(r.years[0]!.shortfall).toBe(14_000);
    expect(r.years[0]!.netWorth).toBe(-14_000);
    expect(r.years[1]!.shortfall).toBe(38_000);
    expect(row(r, 0, 'cash-1')).toEqual({ accountId: 'cash-1', start: 10_000, growth: 0, deposits: 0, withdrawals: 10_000, end: 0 });
    expect(r.kpis.shortfallAge).toBe(30);
    expect(r.kpis.netWorthAtEnd).toBeLessThan(0);
  });

  it('withdrawal order: with cash = 0, investments drain before retirement; reversing reverses it', () => {
    // $2k/month, no growth: 24000 a year. Investments 30000, retirement 30000.
    // Investments first: 2026 takes 24000 from investments (6000 left); 2027 takes 6000 + 18000 from
    // retirement (12000 left).
    const accounts = [account('inv', 'investments', 30_000), account('ret', 'retirement', 30_000)];
    const a = { inflation: 0, growth: { investments: 0, retirement: 0 } };
    const r = plan(person({ pay: 0, other: 2000 }), accounts, scenario({ ...a, withdrawalOrder: ['cash', 'investments', 'retirement'] }));
    expect(row(r, 0, 'inv').end).toBe(6000);
    expect(row(r, 0, 'ret').end).toBe(30_000);
    expect(row(r, 1, 'inv').end).toBe(0);
    expect(row(r, 1, 'ret').end).toBe(12_000);
    expect(r.years[0]!.cashFlow.withdrawals).toBe(24_000);
    const rev = plan(person({ pay: 0, other: 2000 }), accounts, scenario({ ...a, withdrawalOrder: ['cash', 'retirement', 'investments'] }));
    expect(row(rev, 0, 'ret').end).toBe(6000);
    expect(row(rev, 0, 'inv').end).toBe(30_000);
    expect(row(rev, 1, 'ret').end).toBe(0);
    expect(row(rev, 1, 'inv').end).toBe(12_000);
  });

  it('savings split 50/50 cash/investments: deposits match within $1', () => {
    // Surplus 5000 − 3000 = 2000 a month, no inflation or growth: 12000 a year into each.
    const r = plan(person({ pay: 5000, other: 3000 }), [account('cash-1', 'cash', 0), account('inv', 'investments', 0)],
      scenario({ inflation: 0, growth: { cash: 0, investments: 0 },
        savingsSplit: [{ group: 'cash', share: 0.5 }, { group: 'investments', share: 0.5 }] }));
    expect(Math.abs(row(r, 0, 'cash-1').deposits - 12_000)).toBeLessThan(1);
    expect(Math.abs(row(r, 0, 'inv').deposits - 12_000)).toBeLessThan(1);
    expect(Math.abs(row(r, 3, 'inv').end - 48_000)).toBeLessThan(1);
  });

  it("today's vs future dollars: future = today × (1 + i)^t at every year", () => {
    // asOf January: year y ends at month 12(y + 1), so t = y + 1 (the forecast's month/12 deflator).
    const i = 0.03;
    const p: Profile = { ...structuredClone(profileDemo), asOf: '2026-01' };
    const fut = plan(p, accountsDemo, { ...scenarioDemo, assumptions: { ...scenarioDemo.assumptions, inflation: i, display: 'future' } });
    const tod = plan(p, accountsDemo, { ...scenarioDemo, assumptions: { ...scenarioDemo.assumptions, inflation: i, display: 'today' } });
    expect(tod.display).toBe('today');
    for (const [y, f] of fut.years.entries()) {
      const k = (1 + i) ** (y + 1);
      const t = tod.years[y]!;
      expect(f.netWorth).toBeCloseTo(t.netWorth * k, 4);
      expect(f.assets).toBeCloseTo(t.assets * k, 4);
      expect(f.cashFlow.net).toBeCloseTo(t.cashFlow.net * k, 4);
    }
  });

  it('retire at 67: income stops at 67; Social Security from its year adds income', () => {
    // Born 1996 (30 in 2026); retire and Social Security ($2,080/month) in 2063 (age 67). No inflation:
    // 2062 earns 5000 × 12 = 60000; 2063 earns 2080 × 12 = 24960. Social Security is listed first and
    // still applies after Retire.
    const events: PlanEvent[] = [
      { id: 'ss', type: 'socialSecurity', year: 2063, enabled: true, monthly: { value: 2080, isEstimate: true } },
      { id: 'retire', type: 'retire', year: 2063, enabled: true },
    ];
    const r = plan(person({ pay: 5000, other: 3000 }), [], scenario({ inflation: 0, retireAge: 65 }, events));
    const year = (y: number) => r.years.find((py) => py.year === y)!;
    expect(year(2062).age).toBe(66);
    expect(year(2062).cashFlow.income[0]).toEqual({ key: 'takeHomePay', amount: 60_000 });
    expect(year(2063).cashFlow.income[0]).toEqual({ key: 'takeHomePay', amount: 24_960 });
    expect(year(2063).events).toEqual(['ss', 'retire']);
    expect(r.kpis.retireAge).toBe(67); // the event's age, not assumptions.retireAge
    expect(r.kpis.netWorthAtRetirement).toBe(year(2063).netWorth);
  });

  it('retire at 72 with Social Security at 67: work pay and the benefit together until 72, then the benefit', () => {
    // Born 1996; Social Security $2,080/month from 2063 (age 67), Retire in 2068 (age 72). No inflation:
    // 2062 earns 5,000 × 12 = 60,000; 2066 (age 70) earns (5,000 + 2,080) × 12 = 84,960; 2068 earns
    // 2,080 × 12 = 24,960, and so does every year after (the benefit outlives Retire).
    const events: PlanEvent[] = [
      { id: 'retire', type: 'retire', year: 2068, enabled: true },
      { id: 'ss', type: 'socialSecurity', year: 2063, enabled: true, monthly: { value: 2080, isEstimate: true } },
    ];
    const r = plan(person({ pay: 5000, other: 3000 }), [], scenario({ inflation: 0, retireAge: 72 }, events));
    const income = (age: number) => r.years.find((py) => py.age === age)!.cashFlow.income[0];
    expect(income(66)).toEqual({ key: 'takeHomePay', amount: 60_000 });
    expect(income(70)).toEqual({ key: 'takeHomePay', amount: 84_960 });
    expect(income(72)).toEqual({ key: 'takeHomePay', amount: 24_960 });
    expect(income(90)).toEqual({ key: 'takeHomePay', amount: 24_960 });
    expect(r.kpis.retireAge).toBe(72);
  });

  it('demo: retiring later never lowers income before the new retirement age, and ends richer', () => {
    // Demo inputs as in the golden test, Retire at 62 / 67 / 72 / 76 (Social Security stays at 67).
    const birthYear = 2026 - Math.round(profileDemo.age.value);
    const run = (retireAge: number) => {
      const s = structuredClone(scenarioDemo);
      s.assumptions.retireAge = retireAge;
      for (const e of s.events) if (e.type === 'retire') e.year = birthYear + retireAge;
      return plan({ ...structuredClone(profileDemo), asOf: '2026-11' }, accountsDemo, s, areaByZip('75206'));
    };
    const takeHome = (r: PlanResult, age: number) =>
      r.years.find((py) => py.age === age)!.cashFlow.income.find((x) => x.key === 'takeHomePay')!.amount;
    const runs = [62, 67, 72, 76].map((age) => ({ age, r: run(age) }));
    for (let k = 1; k < runs.length; k++) {
      const earlier = runs[k - 1]!, later = runs[k]!;
      expect(later.r.kpis.netWorthAtEnd).toBeGreaterThan(earlier.r.kpis.netWorthAtEnd);
      for (const py of later.r.years) {
        if (py.age >= later.age) break;
        expect(takeHome(later.r, py.age)).toBeGreaterThanOrEqual(takeHome(earlier.r, py.age) - 0.01);
      }
    }
    // Still working at 70 when retiring at 72: work pay plus the benefit, above the benefit alone.
    expect(takeHome(runs[2]!.r, 70)).toBeGreaterThan(takeHome(runs[1]!.r, 70) * 3);
    expect(takeHome(runs[2]!.r, 80)).toBeCloseTo(takeHome(runs[1]!.r, 80), 6);
  });

  it('golden snapshot: scenario.demo.json', () => {
    // Demo profile at asOf 2026-11 (the accounts' latest month), accountsDemo, ZIP 75206.
    const r = plan({ ...structuredClone(profileDemo), asOf: '2026-11' }, accountsDemo, scenarioDemo, areaByZip('75206'));
    expect(PlanResultSchema.safeParse(r).success).toBe(true);
    const golden = cents(r) as PlanResult;
    if (process.env.PLAN_FIXTURE_WRITE === '1') {
      // `pnpm fixtures:plan`: the same result, written as packages/data/fixtures/plan.demo.json.
      writeFileSync(new URL('../data/fixtures/plan.demo.json', import.meta.url),
        `${JSON.stringify({ $comment: GOLDEN_COMMENT, ...golden }, null, 2)}\n`);
      return;
    }
    expect(golden).toMatchSnapshot();
  });

  it.skipIf(process.env.CI_SLOW === '1')('performance: a 25-year-old to 90 in < 10 ms', () => {
    const p: Profile = { ...structuredClone(profileDemo), age: { value: 25, isEstimate: false }, asOf: '2026-11' };
    const s = scenarioDemo;
    for (let k = 0; k < 10; k++) plan(p, accountsDemo, s); // warm-up (JIT)
    // Median of per-run times: one GC pause or a busy CI core does not decide the result.
    const times: number[] = [];
    for (let k = 0; k < 31; k++) {
      const t0 = performance.now();
      plan(p, accountsDemo, s);
      times.push(performance.now() - t0);
    }
    times.sort((x, y) => x - y);
    expect(times[15]).toBeLessThan(10);
  });
});

const GOLDEN_COMMENT =
  'Generated by `pnpm fixtures:plan`: plan() of scenario.demo.json for the demo profile at asOf 2026-11, ' +
  'accounts.demo.json and ZIP 75206 (today\'s dollars, cents). Do not edit by hand.';
