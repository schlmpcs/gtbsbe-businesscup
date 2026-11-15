// The purchase → plan event mapping behind "Add to my plan" on /afford.
import { expenseFinancingBreakdown } from '@lifeguessr/engine';
import type { PlanEventOf } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { planEventFromPurchase } from './planEvent';

describe('planEventFromPurchase', () => {
  it('a one-time cash or card purchase is a one-time Expense', () => {
    expect(planEventFromPurchase({ label: 'Couch', amount: 2400, recurring: false, payWith: 'cash' })).toEqual({
      type: 'expense', name: 'Couch', amount: 2400, cadence: 'once',
    });
    expect(planEventFromPurchase({ label: 'Phone', amount: 999, recurring: false, payWith: 'card' })).toMatchObject({ cadence: 'once', amount: 999 });
  });

  it('a monthly purchase is a monthly Expense; a yearly one is spread over 12 months', () => {
    expect(planEventFromPurchase({ label: 'Gym', amount: 60, recurring: 'monthly', payWith: 'card' })).toEqual({
      type: 'expense', name: 'Gym', amount: 60, cadence: 'monthly',
    });
    expect(planEventFromPurchase({ label: 'Trip', amount: 1200, recurring: 'yearly', payWith: 'cash' })).toMatchObject({ amount: 100, cadence: 'monthly' });
  });

  it('a loan becomes a financed Expense that finances what the loan math finances (fees rolled in)', () => {
    const draft = planEventFromPurchase({
      label: 'Car', amount: 28_000, recurring: false,
      payWith: { loan: { amount: 28_000, apr: 0.0549, termMonths: 60, downPayment: 3000, fees: 495 } },
    });
    expect(draft).toEqual({
      type: 'expense', name: 'Car', amount: 28_495, cadence: 'once',
      financing: { downPayment: 3000, apr: 0.0549, termMonths: 60 },
    });
    const event = { ...draft, id: 'e', year: 2026, enabled: true } as PlanEventOf<'expense'>;
    // 28,000 − 3,000 + 495, as loan() computes its principal.
    expect(expenseFinancingBreakdown(event)!.financed).toBe(25_495);
  });
});
