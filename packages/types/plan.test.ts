// MP2: the planner schemas match their contracts (checked by `pnpm typecheck`, like schemas.test.ts).
// The fixtures are parsed against these schemas in packages/data/fixtures/plan.test.ts.
import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type {
  ACCOUNT_GROUPS, ASSET_GROUPS, LIABILITY_GROUPS, PLAN_EVENT_TYPES,
  AccountGroupSchema, AccountSchema, BudgetIncomeRowSchema, BudgetRowSchema, CashFlowSummarySchema, LedgerTransactionSchema,
  MonteCarloResultSchema, MonteCarloSettingsSchema, PlanAssumptionsSchema, PlanEventSchema, PlanResultSchema, PlanYearSchema,
  ScenarioSchema,
  Account, AccountGroup, AssetGroup, BudgetIncomeRow, BudgetRow, CashFlowSummary, LedgerTransaction, LiabilityGroup,
  MonteCarloResult, MonteCarloSettings, PlanAssumptions, PlanEvent, PlanEventType, PlanResult, PlanYear, Scenario,
} from './index';

describe('planner schemas match the contracts', () => {
  it('parsed output is assignable to the contract, the contract is accepted as input, and value lists cover each union', () => {
    expectTypeOf<z.infer<typeof AccountSchema>>().toExtend<Account>();
    expectTypeOf<Account>().toExtend<z.input<typeof AccountSchema>>();
    expectTypeOf<z.infer<typeof PlanEventSchema>>().toExtend<PlanEvent>();
    expectTypeOf<PlanEvent>().toExtend<z.input<typeof PlanEventSchema>>();
    expectTypeOf<z.infer<typeof PlanAssumptionsSchema>>().toExtend<PlanAssumptions>();
    expectTypeOf<PlanAssumptions>().toExtend<z.input<typeof PlanAssumptionsSchema>>();
    expectTypeOf<z.infer<typeof ScenarioSchema>>().toExtend<Scenario>();
    expectTypeOf<Scenario>().toExtend<z.input<typeof ScenarioSchema>>();
    expectTypeOf<z.infer<typeof PlanYearSchema>>().toExtend<PlanYear>();
    expectTypeOf<PlanYear>().toExtend<z.input<typeof PlanYearSchema>>();
    expectTypeOf<z.infer<typeof PlanResultSchema>>().toExtend<PlanResult>();
    expectTypeOf<PlanResult>().toExtend<z.input<typeof PlanResultSchema>>();
    expectTypeOf<z.infer<typeof MonteCarloSettingsSchema>>().toExtend<MonteCarloSettings>();
    expectTypeOf<MonteCarloSettings>().toExtend<z.input<typeof MonteCarloSettingsSchema>>();
    expectTypeOf<z.infer<typeof MonteCarloResultSchema>>().toExtend<MonteCarloResult>();
    expectTypeOf<MonteCarloResult>().toExtend<z.input<typeof MonteCarloResultSchema>>();
    expectTypeOf<z.infer<typeof BudgetRowSchema>>().toExtend<BudgetRow>();
    expectTypeOf<BudgetRow>().toExtend<z.input<typeof BudgetRowSchema>>();
    expectTypeOf<z.infer<typeof BudgetIncomeRowSchema>>().toExtend<BudgetIncomeRow>();
    expectTypeOf<BudgetIncomeRow>().toExtend<z.input<typeof BudgetIncomeRowSchema>>();
    expectTypeOf<z.infer<typeof CashFlowSummarySchema>>().toExtend<CashFlowSummary>();
    expectTypeOf<CashFlowSummary>().toExtend<z.input<typeof CashFlowSummarySchema>>();
    expectTypeOf<z.infer<typeof LedgerTransactionSchema>>().toExtend<LedgerTransaction>();
    expectTypeOf<LedgerTransaction>().toExtend<z.input<typeof LedgerTransactionSchema>>();

    expectTypeOf<AccountGroup>().toEqualTypeOf<(typeof ACCOUNT_GROUPS)[number]>();
    expectTypeOf<AccountGroup>().toEqualTypeOf<z.infer<typeof AccountGroupSchema>>();
    expectTypeOf<AssetGroup>().toEqualTypeOf<(typeof ASSET_GROUPS)[number]>();
    expectTypeOf<LiabilityGroup>().toEqualTypeOf<(typeof LIABILITY_GROUPS)[number]>();
    expectTypeOf<PlanEventType>().toEqualTypeOf<(typeof PLAN_EVENT_TYPES)[number]>();
    expectTypeOf<PlanEvent['type']>().toEqualTypeOf<PlanEventType>();
  });
});
