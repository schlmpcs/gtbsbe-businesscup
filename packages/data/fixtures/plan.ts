// The planner fixtures (MP2, epic #160): the demo profile's accounts, the demo scenarios, the sample
// statement as Transactions-page lines, and placeholder plan / Monte Carlo results. Import them from
// '@lifeguessr/data/fixtures/plan' (apps/web: '@/fixtures').
//
// Every fixture is validated with its contract's zod schema when this module loads, so a bad edit
// fails loudly in tests and CI instead of producing wrong numbers later.
//
// plan.demo.json and monteCarlo.demo.json are PLACEHOLDERS: hand-made with the right shape and
// plausible numbers (their "$comment" key says so; the schema drops it), not engine output. They are
// regenerated from scenario.demo.json by `pnpm fixtures:plan` once plan() (MP3) and monteCarlo()
// (MP5) land.
import {
  AccountSchema, LedgerTransactionSchema, MonteCarloResultSchema, PlanResultSchema, ScenarioSchema,
  type Account, type LedgerTransaction, type MonteCarloResult, type PlanResult, type Scenario,
} from '@lifeguessr/types';
import { deepFreeze } from './deepFreeze';
import accountsJson from './accounts.demo.json';
import monteCarloJson from './monteCarlo.demo.json';
import planJson from './plan.demo.json';
import scenarioAltJson from './scenario.alt.json';
import scenarioJson from './scenario.demo.json';
import transactionsJson from './transactions.demo.json';

/**
 * The demo profile's balance sheet as accounts: checking + savings (= profile cash $3,800), a 401(k)
 * ($14,500, estimate), the card ($6,400) and the auto loan ($17,800) with the profile's debt ids, plus
 * a car marked `excluded` (left out of net worth and the plan). History holds October and November 2026.
 */
export const accountsDemo: readonly Account[] = deepFreeze(AccountSchema.array().parse(accountsJson));

/**
 * The Baseline scenario of the demo profile (age 32 in 2026, ZIP 75206): Retire at 67 (2061), Social
 * Security at 67 (placeholder estimate: 40% of take-home), and Buy a home in 2033 (age 39): a $375,000
 * starter home (below the ZIP's $615,400 ACS median value, which this household cannot save a down
 * payment for), 20% down ($75,000), 30 years at the current mortgage default (Freddie Mac PMMS 7.11%),
 * the ACS tax rate and NAIC insurance. Monthly savings split 30% cash / 40% investments / 30% retirement.
 */
export const scenarioDemo: Readonly<Scenario> = deepFreeze(ScenarioSchema.parse(scenarioJson));

/**
 * `scenarioDemo` plus Have a kid in 2030 (Dallas County infant childcare, 5 years): the Compare pair. The
 * kid's costs on top of the home do not fit this income, so this one runs short (from age 39).
 */
export const scenarioAlt: Readonly<Scenario> = deepFreeze(ScenarioSchema.parse(scenarioAltJson));

/** PLACEHOLDER plan of `scenarioDemo` (today's dollars), until MP3 regenerates it. */
export const planDemo: Readonly<PlanResult> = deepFreeze(PlanResultSchema.parse(planJson));

/** PLACEHOLDER Monte Carlo result of `scenarioDemo` (1,000 paths, seed 42), until MP5 regenerates it. */
export const monteCarloDemo: Readonly<MonteCarloResult> = deepFreeze(MonteCarloResultSchema.parse(monteCarloJson));

/**
 * statement.sample.csv as Transactions-page lines (oldest first): the 170 masked items of
 * statementItems.sample.json with the sign flipped (money in > 0), on the checking account, sorted with
 * the merchant table of fixtures.test.ts (transfers and money received from people → 'transfer').
 */
export const transactionsDemo: readonly LedgerTransaction[] = deepFreeze(LedgerTransactionSchema.array().parse(transactionsJson));
