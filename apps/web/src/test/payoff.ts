// Test helpers for the debt payoff planner (M13): tests only; nothing in the app imports this file.
//
// The planner takes the payoff engine, the event sender and today's date from outside, so its tests run on
// fakes. `fakeEngine` answers with plans written out by hand below. They are shaped examples chosen so the
// arithmetic is easy to check (40, 41 and 46 months; $5,000, $5,400 and $6,200 of interest), NOT output of the
// real engine: for the demo debts plus sample offer 1 the real engine gives 43 months and $9,684 at extra $0.
// The tests check what the view-model does with an answer (which debts it sends, how it reads the answer),
// never an engine number. Binding the real engine is a few lines in features/loan/model/wiring.ts.
import type { Debt, Money, PayoffComparison, PayoffPlan, Profile } from '@lifeguessr/types';
import { vi } from 'vitest';
import type { PayoffChoice, PayoffSuggestionVM } from '@/features/loan/model/types';
import type { PayoffEngine, PayoffPlannerOptions } from '@/features/loan/model/usePayoffPlanner';

/**
 * The demo profile's debts and sample offer 1 as the planner sees them: card $6,400, auto $17,800, new loan $28,000
 * (no down payment or fees), $52,200 in all. Each plan below pays $52,200 of principal plus its interest.
 */
export const DEMO_TOTAL_BALANCE = 52_200;

type PlanOver = Partial<PayoffPlan>;

/** Avalanche on the demo debts with offer 1: 40 months, $5,000 interest ($1,200 and 6 months better than minimums). */
export function avalanchePlan(over: PlanOver = {}): PayoffPlan {
  return {
    method: 'avalanche',
    order: ['card-1', 'auto-1', 'new-loan'], // 24.36%, 7.4%, 6.9%
    monthsToDebtFree: 40,
    totalInterest: 5_000,
    totalPaid: DEMO_TOTAL_BALANCE + 5_000,
    perDebt: [
      { id: 'card-1', payoffMonth: 12, interest: 1_000 },
      { id: 'auto-1', payoffMonth: 30, interest: 1_500 },
      { id: 'new-loan', payoffMonth: 40, interest: 2_500 },
    ],
    timeline: [
      { month: 0, balance: DEMO_TOTAL_BALANCE },
      { month: 12, balance: 30_000 },
      { month: 30, balance: 10_000 },
      { month: 40, balance: 0 },
    ],
    interestSavedVsMinimum: 1_200,
    monthsSavedVsMinimum: 6,
    ...over,
  };
}

/** Snowball: 41 months, $5,400 interest ($800 and 5 months better than minimums). */
export function snowballPlan(over: PlanOver = {}): PayoffPlan {
  return {
    method: 'snowball',
    order: ['card-1', 'auto-1', 'new-loan'], // $6,400, $17,800, $28,000
    monthsToDebtFree: 41,
    totalInterest: 5_400,
    totalPaid: DEMO_TOTAL_BALANCE + 5_400,
    perDebt: [
      { id: 'card-1', payoffMonth: 12, interest: 1_100 },
      { id: 'auto-1', payoffMonth: 31, interest: 1_600 },
      { id: 'new-loan', payoffMonth: 41, interest: 2_700 },
    ],
    timeline: [
      { month: 0, balance: DEMO_TOTAL_BALANCE },
      { month: 12, balance: 31_000 },
      { month: 31, balance: 10_500 },
      { month: 41, balance: 0 },
    ],
    interestSavedVsMinimum: 800,
    monthsSavedVsMinimum: 5,
    ...over,
  };
}

/** Minimums only: 46 months, $6,200 interest, saving nothing against itself. */
export function minimumPlan(over: PlanOver = {}): PayoffPlan {
  return {
    method: 'minimum',
    order: ['card-1', 'auto-1', 'new-loan'],
    monthsToDebtFree: 46,
    totalInterest: 6_200,
    totalPaid: DEMO_TOTAL_BALANCE + 6_200,
    perDebt: [
      { id: 'card-1', payoffMonth: 14, interest: 1_300 },
      { id: 'auto-1', payoffMonth: 35, interest: 1_900 },
      { id: 'new-loan', payoffMonth: 46, interest: 3_000 },
    ],
    timeline: [
      { month: 0, balance: DEMO_TOTAL_BALANCE },
      { month: 14, balance: 33_000 },
      { month: 35, balance: 12_000 },
      { month: 46, balance: 0 },
    ],
    interestSavedVsMinimum: 0,
    monthsSavedVsMinimum: 0,
    ...over,
  };
}

export type FakeEngineOptions = {
  /** What the avalanche plan is, whatever the extra. */
  avalanche?: PlanOver;
  /** What the avalanche plan is for a given extra (over `avalanche`): lets a test shape "finishes in time from $X". */
  avalancheByExtra?: (extra: Money) => PlanOver;
  snowball?: PlanOver;
  minimum?: PlanOver;
  /** What extraToFinishBy answers. */
  solve?: { extra: Money; reachable: boolean };
  /**
   * What suggestedPayoffExtra answers. By default a suggestion of $0 (a month with nothing left), so the tests that
   * are about something else start at $0 as they always did; the tests of the suggestion set it.
   */
  suggest?: PayoffSuggestionVM;
  /** Make suggestedPayoffExtra throw this. */
  suggestThrows?: unknown;
  /** Make comparePayoff throw this. */
  throws?: unknown;
};

/** A payoff engine that answers with the canned plans above (whatever it is asked) and records what it was asked. */
export function fakeEngine(opts: FakeEngineOptions = {}) {
  const comparePayoff = vi.fn((_debts: Debt[], extra: Money): PayoffComparison => {
    if (opts.throws !== undefined) throw opts.throws;
    return {
      extra,
      avalanche: avalanchePlan({ ...opts.avalanche, ...opts.avalancheByExtra?.(extra) }),
      snowball: snowballPlan(opts.snowball),
      minimum: minimumPlan(opts.minimum),
    };
  });
  const extraToFinishBy = vi.fn((_debts: Debt[], _months: number, _method: PayoffChoice) => opts.solve ?? { extra: 0, reachable: true });
  const suggestedPayoffExtra = vi.fn((_p: Profile, _debts: Debt[], _opts: { step: Money }): PayoffSuggestionVM => {
    if (opts.suggestThrows !== undefined) throw opts.suggestThrows;
    return opts.suggest ?? { extra: 0, surplus: 0, share: 0.5 };
  });
  const engine: PayoffEngine = { comparePayoff, extraToFinishBy, suggestedPayoffExtra };
  return { engine, comparePayoff, extraToFinishBy, suggestedPayoffExtra };
}

/** Planner options on fakes: a recording event sender, today = November 2026, no stored inputs. */
export function plannerOptions(over: Partial<PayoffPlannerOptions> & { engineOptions?: FakeEngineOptions } = {}) {
  const { engineOptions, ...rest } = over;
  const fake = fakeEngine(engineOptions);
  const track = vi.fn();
  const options: PayoffPlannerOptions = { engine: fake.engine, track, today: () => ({ month: '2026-11' }), ...rest };
  return { options, track, ...fake };
}

export { hasNonFinite } from '@/features/loan/model/finite';
