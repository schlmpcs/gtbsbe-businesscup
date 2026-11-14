import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  DAILY_ENTRY_MAX_AMOUNT, DailyEntrySchema, CalendarDaySchema, type SpendItemSchema,
  type DailyEntry, type SpendItem,
} from './index';

describe('DailyEntry contract', () => {
  it('schemas match the contract types (both directions)', () => {
    expectTypeOf<z.infer<typeof DailyEntrySchema>>().toExtend<DailyEntry>();
    expectTypeOf<DailyEntry>().toExtend<z.input<typeof DailyEntrySchema>>();
    expectTypeOf<z.infer<typeof SpendItemSchema>>().toExtend<SpendItem>();
    expectTypeOf<SpendItem>().toExtend<z.input<typeof SpendItemSchema>>();
  });

  it('accepts a logged purchase, with or without a label', () => {
    expect(DailyEntrySchema.safeParse({ id: 'a1', date: '2026-11-14', category: 'eatingOut', amount: 5.5, label: 'coffee' }).success).toBe(true);
    expect(DailyEntrySchema.safeParse({ id: 'a1', date: '2026-02-28', category: 'other', amount: 18 }).success).toBe(true);
  });

  it('rejects zero, negative and absurd amounts, unknown categories and empty ids or labels', () => {
    const base = { id: 'a1', date: '2026-11-14', category: 'groceries' };
    expect(DailyEntrySchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: DAILY_ENTRY_MAX_AMOUNT + 1 }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: Number.NaN }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: 5, category: 'coffee' }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: 5, label: '' }).success).toBe(false);
    expect(DailyEntrySchema.safeParse({ ...base, amount: 5, id: '' }).success).toBe(false);
  });

  it('dates are real YYYY-MM-DD days', () => {
    expect(CalendarDaySchema.safeParse('2026-11-14').success).toBe(true);
    expect(CalendarDaySchema.safeParse('2028-02-29').success).toBe(true);
    expect(CalendarDaySchema.safeParse('2026-02-29').success).toBe(false);
    expect(CalendarDaySchema.safeParse('2026-11-31').success).toBe(false);
    expect(CalendarDaySchema.safeParse('2026-11').success).toBe(false);
    expect(CalendarDaySchema.safeParse('14/11/2026').success).toBe(false);
  });
});
