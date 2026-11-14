import { z } from 'zod';
import type { Money } from './index';

export const PayoffMethodSchema = z.enum(['avalanche', 'snowball', 'minimum']);
export type PayoffMethod = z.infer<typeof PayoffMethodSchema>;
export type PayoffPlan = {
  method: PayoffMethod; order: string[]; monthsToDebtFree: number | null;
  totalInterest: Money; totalPaid: Money;
  perDebt: { id: string; payoffMonth: number | null; interest: Money }[];
  timeline: { month: number; balance: Money }[];
  interestSavedVsMinimum: Money; monthsSavedVsMinimum: number | null;
};
export type PayoffComparison = { extra: Money; avalanche: PayoffPlan; snowball: PayoffPlan; minimum: PayoffPlan };
const money = z.number().finite().nonnegative();
const month = z.number().int().min(0).max(1200);
export const PayoffPlanSchema = z.object({
  method: PayoffMethodSchema, order: z.array(z.string().min(1).max(200)),
  monthsToDebtFree: month.nullable(), totalInterest: money, totalPaid: money,
  perDebt: z.array(z.object({ id: z.string().min(1).max(200), payoffMonth: month.nullable(), interest: money })),
  timeline: z.array(z.object({ month, balance: money })),
  interestSavedVsMinimum: z.number().finite(), monthsSavedVsMinimum: z.number().int().nullable(),
});
export const PayoffComparisonSchema = z.object({ extra: money, avalanche: PayoffPlanSchema, snowball: PayoffPlanSchema, minimum: PayoffPlanSchema });
