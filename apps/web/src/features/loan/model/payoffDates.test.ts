// Calendar months for the payoff planner: today comes in as 'YYYY-MM', the dates come out as month + year.
import { describe, expect, it } from 'vitest';
import { PAYOFF_MAX_MONTHS, addMonths, monthsBetween } from './payoffDates';

describe('addMonths', () => {
  it('adds within the year', () => {
    expect(addMonths('2026-11', 0)).toEqual({ month: '2026-11', year: 2026 });
    expect(addMonths('2026-03', 5)).toEqual({ month: '2026-08', year: 2026 });
  });

  it('rolls over the year: November 2026 + 2 months is January 2027', () => {
    expect(addMonths('2026-11', 1)).toEqual({ month: '2026-12', year: 2026 });
    expect(addMonths('2026-11', 2)).toEqual({ month: '2027-01', year: 2027 });
    expect(addMonths('2026-11', 3)).toEqual({ month: '2027-02', year: 2027 });
  });

  it('rolls over several years: 2026-11 + 38 months = 2030-01', () => {
    // 2026-11 + 36 months = 2029-11; two more = 2030-01.
    expect(addMonths('2026-11', 38)).toEqual({ month: '2030-01', year: 2030 });
    expect(addMonths('2026-12', 12)).toEqual({ month: '2027-12', year: 2027 });
    expect(addMonths('2026-12', 1)).toEqual({ month: '2027-01', year: 2027 });
  });

  it('reaches the end of the 1,200-month simulation: 2026-11 + 1,200 = 2126-11', () => {
    expect(PAYOFF_MAX_MONTHS).toBe(1200);
    expect(addMonths('2026-11', 1200)).toEqual({ month: '2126-11', year: 2126 });
  });

  it('answers null for a month that is not YYYY-MM, or a count that is not a whole number of months', () => {
    expect(addMonths('2026-13', 1)).toBeNull();
    expect(addMonths('2026-00', 1)).toBeNull();
    expect(addMonths('26-11', 1)).toBeNull();
    expect(addMonths('', 1)).toBeNull();
    expect(addMonths('2026-11', 1.5)).toBeNull();
    expect(addMonths('2026-11', Number.NaN)).toBeNull();
    expect(addMonths('2026-11', Number.POSITIVE_INFINITY)).toBeNull();
    expect(addMonths('2026-11', -1)).toBeNull();
  });
});

describe('monthsBetween', () => {
  it('counts calendar months from the first to the second', () => {
    expect(monthsBetween('2026-11', '2026-11')).toBe(0);
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
    expect(monthsBetween('2026-11', '2029-12')).toBe(37); // 3 years + 1 month
    expect(monthsBetween('2026-11', '2026-10')).toBe(-1);
    expect(monthsBetween('2026-11', '2025-11')).toBe(-12);
  });

  it('answers null when either side is not YYYY-MM', () => {
    expect(monthsBetween('2026-11', 'soon')).toBeNull();
    expect(monthsBetween('2026-11', '2029-12-01')).toBeNull();
    expect(monthsBetween('nope', '2029-12')).toBeNull();
  });
});
