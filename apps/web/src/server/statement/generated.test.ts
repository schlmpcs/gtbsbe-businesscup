// The generated statements (packages/data/statementGen.ts, onboarding's "Generate a life like
// yours") must read like real ones: through the same browser reader and the keyword categorizer
// (no API key in tests), each category should land near what the generator planned.
import { generateStatement, type StatementSpec } from '@lifeguessr/data/statementGen';
import { describe, expect, it } from 'vitest';
import { readStatementCsv, toStatementItems } from '@/lib/statement/read';
import { categorizeStatement } from './categorize';

const specs: StatementSpec[] = [
  { zip: '78744', household: 'family', pay: 'steady', style: 'typical', seed: 1, asOf: '2026-11-14' },
  { zip: '10013', household: 'solo', pay: 'comfortable', style: 'spender', seed: 3, asOf: '2026-11-14' },
  { zip: '30315', household: 'singleParent', pay: 'lean', style: 'saver', seed: 9, asOf: '2026-11-14' },
];

describe('generated statements through the real pipeline', () => {
  for (const spec of specs) {
    it(`${spec.zip} ${spec.household} ${spec.pay} ${spec.style}: categories land near the plan`, async () => {
      const g = generateStatement(spec);
      const read = readStatementCsv(g.csv);
      expect(read.transactions.length).toBe(g.lines);
      const res = await categorizeStatement(toStatementItems(read.transactions), null);
      expect(res.categorizedBy).toBe('rules');
      const full = res.months.filter((m) => m.month < spec.asOf.slice(0, 7));
      expect(full).toHaveLength(3);
      const avg = (pick: (t: Record<string, number>) => number) => full.reduce((s, m) => s + pick(m.totals), 0) / full.length;
      const p = g.plan.monthly;
      expect(avg((t) => t.rentUtilities)).toBeGreaterThan(p.rentUtilities * 0.85);
      expect(avg((t) => t.rentUtilities)).toBeLessThan(p.rentUtilities * 1.15);
      expect(avg((t) => t.groceries)).toBeGreaterThan(p.groceries * 0.6);
      expect(avg((t) => t.groceries)).toBeLessThan(p.groceries * 1.4);
      expect(avg((t) => t.childcare)).toBeCloseTo(p.childcare, 0);
      expect(avg((t) => t.subscriptions)).toBeCloseTo(p.subscriptions, 0);
      expect(avg((t) => t.debtPayments)).toBeCloseTo(p.debtPayments, 0);
      const pay = full.reduce((s, m) => s + (m.detectedPay ?? 0), 0) / full.length;
      expect(pay).toBeGreaterThan(p.takeHome * 0.9);
      expect(pay).toBeLessThan(p.takeHome * 1.25); // a three-paycheck month lifts the average
    });
  }
});
