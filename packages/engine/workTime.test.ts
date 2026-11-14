// Price in work hours. Demo pay: $5,200/month take-home over 40 h × 52 / 12 = 173.33 h → $30/h.
import { describe, expect, it } from 'vitest';
import { profileDemo } from '@lifeguessr/data/fixtures';
import { workHoursPerWeek } from './assumptions';
import { roundWorkAmount, workTime } from './workTime';

const pay = { value: 5_200, isEstimate: false };

describe('workTime', () => {
  it('defaults to a 40-hour week and 52/12 weeks per month', () => {
    expect(workHoursPerWeek.value).toBe(40);
    const w = workTime(30, pay)!;
    expect(w.hourlyPay).toBeCloseTo(30, 9);
    expect(w.hours).toBeCloseTo(1, 9);
    expect(w.minutes).toBeCloseTo(60, 9);
    expect(w.days).toBeCloseTo(1 / 8, 9);
    expect(w.weeks).toBeCloseTo(1 / 40, 9);
    expect(w.hoursPerWeek).toBe(40);
  });

  it('phrases small amounts in whole minutes', () => {
    expect(workTime(7, pay)!.best).toEqual({ unit: 'minutes', amount: 14 });
    expect(workTime(0.2, pay)!.best).toEqual({ unit: 'minutes', amount: 0 }); // 0.4 min
  });

  it('moves up a unit when rounding reaches the next one (no "60 min", no "8 hours")', () => {
    expect(workTime(29.75, pay)!.best).toEqual({ unit: 'hours', amount: 1 }); // 59.5 min
    expect(workTime(239, pay)!.best).toEqual({ unit: 'days', amount: 1 }); // 7.97 h
    expect(workTime(1_190, pay)!.best).toEqual({ unit: 'weeks', amount: 1 }); // 4.96 days
  });

  it('uses hours, days and weeks in half steps below 10', () => {
    expect(workTime(45, pay)!.best).toEqual({ unit: 'hours', amount: 1.5 });
    expect(workTime(720, pay)!.best).toEqual({ unit: 'days', amount: 3 }); // 24 h
    expect(workTime(1_000, pay)!.best).toEqual({ unit: 'days', amount: 4 }); // 4.17 days
    expect(workTime(3_000, pay)!.best).toEqual({ unit: 'weeks', amount: 2.5 }); // 100 h
  });

  it('rounds to whole weeks from 10 up', () => {
    expect(workTime(40_000, pay)!.best).toEqual({ unit: 'weeks', amount: 33 }); // 33.3 weeks
    expect(roundWorkAmount(9.74)).toBe(9.5);
    expect(roundWorkAmount(9.76)).toBe(10);
    expect(roundWorkAmount(12.5)).toBe(13);
  });

  it('a shorter week makes each hour worth more and a day shorter', () => {
    const w = workTime(30, pay, { hoursPerWeek: 20 })!;
    expect(w.hourlyPay).toBeCloseTo(60, 9);
    expect(w.hours).toBeCloseTo(0.5, 9);
    expect(w.days).toBeCloseTo(0.5 / 4, 9);
  });

  it('zero costs zero time', () => {
    const w = workTime(0, pay)!;
    expect(w.hours).toBe(0);
    expect(w.best).toEqual({ unit: 'minutes', amount: 0 });
  });

  it('is null without positive pay or hours, or for a negative or non-finite amount', () => {
    expect(workTime(100, { value: 0, isEstimate: false })).toBeNull();
    expect(workTime(100, { value: -2_000, isEstimate: false })).toBeNull();
    expect(workTime(100, { value: Number.NaN, isEstimate: false })).toBeNull();
    expect(workTime(-1, pay)).toBeNull();
    expect(workTime(Number.POSITIVE_INFINITY, pay)).toBeNull();
    expect(workTime(100, pay, { hoursPerWeek: 0 })).toBeNull();
  });

  it('carries the take-home estimate flag', () => {
    expect(workTime(100, pay)!.isEstimate).toBe(false);
    expect(workTime(100, { value: 5_200, isEstimate: true })!.isEstimate).toBe(true);
    expect(workTime(100, profileDemo.takeHomePay)!.isEstimate).toBe(profileDemo.takeHomePay.isEstimate);
  });
});
