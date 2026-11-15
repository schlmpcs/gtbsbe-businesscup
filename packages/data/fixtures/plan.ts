// The planner fixtures (MP2, epic #160): the demo profile's accounts, the demo scenarios, the sample
// statement as Transactions-page lines, and placeholder plan / Monte Carlo results. Import them from
// '@lifeguessr/data/fixtures/plan' (apps/web: '@/fixtures').
//
// Every fixture is validated with its contract's zod schema when this module loads, so a bad edit
// fails loudly in tests and CI instead of producing wrong numbers later.
//
// plan.demo.json is plan() output, regenerated from scenario.demo.json by `pnpm fixtures:plan` (its
// "$comment" says so; the schema drops it). monteCarlo.demo.json is still a PLACEHOLDER: hand-made with
// the right shape and plausible numbers, not engine output, until monteCarlo() (MP5) lands.
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
 * Security at 67 (estimate: 40% of take-home), and Buy a home in 2032: a $350,000 home with 20% ($70,000)
 * down, 30 years at the mortgage default (Freddie Mac PMMS), the ZIP's ACS tax rate and NAIC insurance.
 * The price and year are the demo person's choice, below the ZIP's ACS median ($615,400): on $5,200 a
 * month of take-home, plan() runs the median home's $123,080 down payment in 2029 short at 35 (about
 * $41,500 of cash saved by then); this home in 2032 is paid from cash saved (about $71,500), leaves no
 * shortfall, and works in about 86% of monteCarlo() paths (seed 42). In 2031 it would draw on the
 * retirement account and work in only about half of them.
 */
export const scenarioDemo: Readonly<Scenario> = deepFreeze(ScenarioSchema.parse(scenarioJson));

/** `scenarioDemo` plus Have a kid in 2030 (Dallas County infant childcare, 5 years): the Compare pair (with the kid the plan runs short at 37). */
export const scenarioAlt: Readonly<Scenario> = deepFreeze(ScenarioSchema.parse(scenarioAltJson));

/** plan() of `scenarioDemo` on the demo profile (today's dollars), written by `pnpm fixtures:plan`. */
export const planDemo: Readonly<PlanResult> = deepFreeze(PlanResultSchema.parse(planJson));

/** PLACEHOLDER Monte Carlo result of `scenarioDemo` (1,000 paths, seed 42), until MP5 regenerates it. */
export const monteCarloDemo: Readonly<MonteCarloResult> = deepFreeze(MonteCarloResultSchema.parse(monteCarloJson));

/**
 * statement.sample.csv as Transactions-page lines (oldest first): the 170 masked items of
 * statementItems.sample.json with the sign flipped (money in > 0), on the checking account, sorted with
 * the merchant table of fixtures.test.ts (transfers and money received from people → 'transfer').
 */
export const transactionsDemo: readonly LedgerTransaction[] = deepFreeze(LedgerTransactionSchema.array().parse(transactionsJson));
