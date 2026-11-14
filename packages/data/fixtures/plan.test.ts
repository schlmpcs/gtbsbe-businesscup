// MP2: every planner fixture parses with its contract's zod schema (the JSON as committed, so a
// failure names the file rather than failing the module load in ./plan).
import {
  AccountSchema, LedgerTransactionSchema, MonteCarloResultSchema, PlanResultSchema, ScenarioSchema,
} from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import accountsJson from './accounts.demo.json';
import monteCarloJson from './monteCarlo.demo.json';
import planJson from './plan.demo.json';
import scenarioAltJson from './scenario.alt.json';
import scenarioJson from './scenario.demo.json';
import transactionsJson from './transactions.demo.json';
import { accountsDemo, monteCarloDemo, planDemo, scenarioAlt, scenarioDemo, transactionsDemo } from './plan';

const cases: [string, z.ZodType, unknown][] = [
  ['accounts.demo.json', AccountSchema.array(), accountsJson],
  ['scenario.demo.json', ScenarioSchema, scenarioJson],
  ['scenario.alt.json', ScenarioSchema, scenarioAltJson],
  ['plan.demo.json', PlanResultSchema, planJson],
  ['monteCarlo.demo.json', MonteCarloResultSchema, monteCarloJson],
  ['transactions.demo.json', LedgerTransactionSchema.array(), transactionsJson],
];

describe('planner fixtures', () => {
  it.each(cases)('%s parses with its schema', (_name, schema, json) => {
    const result = schema.safeParse(json);
    expect(result.success, JSON.stringify(result.error?.issues.slice(0, 3))).toBe(true);
  });

  it('are exported parsed and frozen from @lifeguessr/data/fixtures/plan', () => {
    for (const f of [accountsDemo, scenarioDemo, scenarioAlt, planDemo, monteCarloDemo, transactionsDemo]) {
      expect(Object.isFrozen(f)).toBe(true);
    }
  });
});
