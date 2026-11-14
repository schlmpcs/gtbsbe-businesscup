import { z } from 'zod';
import type { Money, Source } from './index';
import { SourceSchema } from './schemas';
export type BenchmarkLine = 'rent' | 'carInsurance' | 'groceries' | 'childcare';
export type Benchmark = {
  line: BenchmarkLine; yours: Money; typical: {low: Money; mid: Money; high: Money};
  source: Source; isEstimate: boolean; position: 'below' | 'inRange' | 'above';
  gapPerMonth: Money; gapPerYear: Money; effect10y: Money;
};
export type OverpayingResult = {coverage: 'exact' | 'metro' | 'none'; metro?: string; lines: Benchmark[];
  skipped: {line: BenchmarkLine; reason: 'noData' | 'notEntered'}[]};
export const BenchmarkLineSchema = z.enum(['rent','carInsurance','groceries','childcare']);
const money = z.number().finite().nonnegative();
export const BenchmarkSchema = z.object({
  line: BenchmarkLineSchema, yours: money, typical: z.object({low: money, mid: money, high: money})
    .refine(v=>v.low<=v.mid && v.mid<=v.high), source: SourceSchema, isEstimate: z.boolean(),
  position: z.enum(['below','inRange','above']), gapPerMonth: money, gapPerYear: money, effect10y: z.number().finite(),
});
export const OverpayingResultSchema = z.object({ coverage: z.enum(['exact','metro','none']), metro: z.string().optional(),
  lines: z.array(BenchmarkSchema), skipped: z.array(z.object({line: BenchmarkLineSchema,reason:z.enum(['noData','notEntered'])})) });
