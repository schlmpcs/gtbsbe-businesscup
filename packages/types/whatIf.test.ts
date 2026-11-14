import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  FutureComparisonSchema, ScenarioChangeSchema, ScenarioSchema,
  type FutureComparison, type Scenario, type ScenarioChange,
} from './index';

describe('what-if schemas match the contracts', () => {
  it('both directions', () => {
    expectTypeOf<z.infer<typeof ScenarioChangeSchema>>().toExtend<ScenarioChange>();
    expectTypeOf<ScenarioChange>().toExtend<z.input<typeof ScenarioChangeSchema>>();
    expectTypeOf<z.infer<typeof ScenarioSchema>>().toExtend<Scenario>();
    expectTypeOf<Scenario>().toExtend<z.input<typeof ScenarioSchema>>();
    expectTypeOf<z.infer<typeof FutureComparisonSchema>>().toExtend<FutureComparison>();
    expectTypeOf<FutureComparison>().toExtend<z.input<typeof FutureComparisonSchema>>();
  });

  it('rejects percent rates, unknown kinds and bad ZIPs', () => {
    expect(ScenarioChangeSchema.safeParse({ kind: 'loan', loan: { amount: 30_000, apr: 6.9, termMonths: 60 } }).success).toBe(false);
    expect(ScenarioChangeSchema.safeParse({ kind: 'lottery' }).success).toBe(false);
    expect(ScenarioChangeSchema.safeParse({ kind: 'move', zip: 'Austin' }).success).toBe(false);
    expect(ScenarioChangeSchema.safeParse({ kind: 'kid', age: 'infant', inMonths: 12 }).success).toBe(true);
    expect(ScenarioSchema.safeParse({ label: 'x', changes: Array(9).fill({ kind: 'rent', monthly: 1 }) }).success).toBe(false);
  });
});
