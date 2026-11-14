import { describe, expect, it } from 'vitest';
import {
  billsBetween, billsInMonth, daysInMonth, dueBeforePayday, dueDateIn, dueSoon, monthWeeks, nextBill, nextOccurrence, nextPayday,
  occursInMonth, shiftMonth, sumOf, validDueDay, weekday, type BillDef,
} from './calendar';

const bill = (over: Partial<BillDef> & Pick<BillDef, 'id' | 'dueDay'>): BillDef => ({
  kind: 'subscription',
  label: over.id,
  amount: 10,
  amountIsEstimate: false,
  cadence: 'monthly',
  dueDayIsEstimate: false,
  ...over,
});

const rent = bill({ id: 'rent', kind: 'rent', label: 'Rent', amount: 1950, dueDay: 1, dueDayIsEstimate: true });
const card = bill({ id: 'debt:card', kind: 'debt', label: 'Card', amount: 193.92, amountIsEstimate: true, dueDay: 20 });
const netflix = bill({ id: 'sub:netflix', label: 'Netflix', amount: 17.99, dueDay: 7 });
const endOfMonth = bill({ id: 'sub:gym', label: 'Gym', amount: 30, dueDay: 31 });
const prime = bill({ id: 'sub:prime', label: 'Prime', amount: 139, cadence: 'yearly', anchorMonth: '2026-08', dueDay: 15 });
const quarterly = bill({ id: 'sub:q', label: 'Quarterly', amount: 45, cadence: 'quarterly', anchorMonth: '2026-11', dueDay: 3 });
const all = [rent, card, netflix, endOfMonth, prime, quarterly];

describe('days and months', () => {
  it('knows month lengths, leap years included', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('moves a due day the month does not have to its last day (31 in February → 28th or 29th)', () => {
    expect(dueDateIn(31, 2027, 2)).toEqual({ year: 2027, month: 2, day: 28 });
    expect(dueDateIn(31, 2028, 2)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(dueDateIn(30, 2026, 2)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(dueDateIn(31, 2026, 4)).toEqual({ year: 2026, month: 4, day: 30 });
    expect(dueDateIn(31, 2026, 5)).toEqual({ year: 2026, month: 5, day: 31 });
    expect(dueDateIn(15, 2026, 2)).toEqual({ year: 2026, month: 2, day: 15 });
  });

  it('validates due days', () => {
    expect(validDueDay(1)).toBe(1);
    expect(validDueDay(31)).toBe(31);
    for (const bad of [0, 32, 1.5, Number.NaN, '5', null, undefined]) expect(validDueDay(bad)).toBeNull();
  });

  it('shifts months across years', () => {
    expect(shiftMonth(2026, 11, 2)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });

  it('lays a month out in Sunday-first weeks', () => {
    // 1 November 2026 is a Sunday; 30 days → 5 weeks.
    expect(weekday({ year: 2026, month: 11, day: 1 })).toBe(0);
    const nov = monthWeeks(2026, 11);
    expect(nov).toHaveLength(5);
    expect(nov[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(nov[4]).toEqual([29, 30, null, null, null, null, null]);
    // February 2026 starts on a Sunday and has exactly 4 weeks.
    expect(monthWeeks(2026, 2)).toHaveLength(4);
    // A month starting on Saturday with 31 days needs 6 weeks (August 2026).
    const aug = monthWeeks(2026, 8);
    expect(aug).toHaveLength(6);
    expect(aug[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(aug.every((w) => w.length === 7)).toBe(true);
  });
});

describe('which bills fall in a month', () => {
  it('places monthly bills every month, quarterly and yearly ones only in their months', () => {
    expect(occursInMonth(netflix, 2027, 3)).toBe(true);
    expect(occursInMonth(prime, 2026, 8)).toBe(true);
    expect(occursInMonth(prime, 2027, 8)).toBe(true);
    expect(occursInMonth(prime, 2025, 8)).toBe(true);
    expect(occursInMonth(prime, 2026, 9)).toBe(false);
    expect(occursInMonth(quarterly, 2026, 11)).toBe(true);
    expect(occursInMonth(quarterly, 2027, 2)).toBe(true);
    expect(occursInMonth(quarterly, 2026, 8)).toBe(true);
    expect(occursInMonth(quarterly, 2026, 12)).toBe(false);
    // No usable anchor: never placed rather than guessed.
    expect(occursInMonth({ ...prime, anchorMonth: undefined }, 2026, 8)).toBe(false);
  });

  it('lists the month by date, with totals', () => {
    const nov = billsInMonth(all, 2026, 11);
    expect(nov.map((o) => [o.bill.id, o.date.day])).toEqual([
      ['rent', 1],
      ['sub:q', 3],
      ['sub:netflix', 7],
      ['debt:card', 20],
      ['sub:gym', 30], // November has no 31st
    ]);
    expect(sumOf(nov)).toBeCloseTo(1950 + 45 + 17.99 + 193.92 + 30, 6);
    const feb = billsInMonth(all, 2027, 2);
    expect(feb.find((o) => o.bill.id === 'sub:gym')!.date.day).toBe(28);
    expect(feb.map((o) => o.bill.id)).toContain('sub:q');
    expect(billsInMonth(all, 2027, 8).map((o) => o.bill.id)).toContain('sub:prime');
  });

  it('sorts bills on the same day by label', () => {
    const a = bill({ id: 'b', label: 'Zeta', dueDay: 5 });
    const b = bill({ id: 'a', label: 'Alpha', dueDay: 5 });
    expect(billsInMonth([a, b], 2026, 11).map((o) => o.bill.label)).toEqual(['Alpha', 'Zeta']);
  });
});

describe('due soon, next bill and payday', () => {
  it('"next 7 days" is today and the six days after, across a month end', () => {
    const today = { year: 2026, month: 11, day: 27 };
    const soon = dueSoon(all, today);
    // 27 Nov to 3 Dec: gym on the 30th, rent on 1 Dec. The quarterly bill (3 Dec) is not due in December.
    expect(soon.map((o) => [o.bill.id, o.date.month, o.date.day])).toEqual([
      ['sub:gym', 11, 30],
      ['rent', 12, 1],
    ]);
    // A bill due today counts; one due on day 7 does not.
    expect(dueSoon([netflix], { year: 2026, month: 11, day: 7 })).toHaveLength(1);
    expect(dueSoon([netflix], { year: 2026, month: 10, day: 31 })).toHaveLength(0);
    expect(dueSoon([netflix], { year: 2026, month: 11, day: 1 })).toHaveLength(1);
  });

  it('finds the next bill, also in the next month', () => {
    expect(nextBill(all, { year: 2026, month: 11, day: 14 })!.bill.id).toBe('debt:card');
    expect(nextBill(all, { year: 2026, month: 11, day: 30 })!.bill.id).toBe('sub:gym');
    expect(nextBill([prime], { year: 2026, month: 9, day: 1 })!.date).toEqual({ year: 2027, month: 8, day: 15 });
    expect(nextBill([], { year: 2026, month: 9, day: 1 })).toBeNull();
  });

  it('finds the next occurrence of one bill', () => {
    expect(nextOccurrence(netflix, { year: 2026, month: 11, day: 8 })).toEqual({ year: 2026, month: 12, day: 7 });
    expect(nextOccurrence(endOfMonth, { year: 2027, month: 2, day: 1 })).toEqual({ year: 2027, month: 2, day: 28 });
    expect(nextOccurrence({ ...prime, anchorMonth: 'nope' }, { year: 2026, month: 11, day: 1 })).toBeNull();
  });

  it('the next payday is after today, clamped to short months', () => {
    expect(nextPayday({ year: 2026, month: 11, day: 14 }, [1, 15])).toEqual({ year: 2026, month: 11, day: 15 });
    // Today is payday: that pay is in, the next one counts.
    expect(nextPayday({ year: 2026, month: 11, day: 15 }, [1, 15])).toEqual({ year: 2026, month: 12, day: 1 });
    expect(nextPayday({ year: 2027, month: 2, day: 10 }, [31])).toEqual({ year: 2027, month: 2, day: 28 });
    expect(nextPayday({ year: 2027, month: 2, day: 28 }, [31])).toEqual({ year: 2027, month: 3, day: 31 });
    expect(nextPayday({ year: 2026, month: 12, day: 20 }, [15])).toEqual({ year: 2027, month: 1, day: 15 });
    expect(nextPayday({ year: 2026, month: 12, day: 20 }, [])).toBeNull();
  });

  it('totals what is due before payday: from today, not counting payday itself', () => {
    const r = dueBeforePayday(all, { year: 2026, month: 11, day: 16 }, [1, 15])!;
    expect(r.payday).toEqual({ year: 2026, month: 12, day: 1 });
    // Card on the 20th and the gym on the 30th; rent on 1 Dec is paid from that pay.
    expect(r.bills.map((o) => o.bill.id)).toEqual(['debt:card', 'sub:gym']);
    expect(r.total).toBeCloseTo(223.92, 6);
    expect(r.totalIsEstimate).toBe(true); // the card minimum is an estimate
    const none = dueBeforePayday([netflix], { year: 2026, month: 11, day: 8 }, [10])!;
    expect(none.bills).toEqual([]);
    expect(none.total).toBe(0);
    expect(none.totalIsEstimate).toBe(false);
  });

  it('billsBetween is empty for an empty or reversed range', () => {
    const d = { year: 2026, month: 11, day: 7 };
    expect(billsBetween(all, d, d)).toEqual([]);
    expect(billsBetween(all, d, { year: 2026, month: 11, day: 1 })).toEqual([]);
  });
});
