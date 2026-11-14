import { describe, expect, it } from 'vitest';
import { formatMoney, formatMonth, formatRate } from './format';

describe('formatMoney', () => {
  it('rounds to whole dollars by default, with thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('$1,235');
    expect(formatMoney(863.279)).toBe('$863');
    expect(formatMoney(0)).toBe('$0');
  });

  it('shows cents on request', () => {
    expect(formatMoney(863.279, { cents: true })).toBe('$863.28');
    expect(formatMoney(5, { cents: true })).toBe('$5.00');
  });

  it('uses a minus sign for negatives and never prints -$0', () => {
    expect(formatMoney(-1200)).toBe('−$1,200');
    expect(formatMoney(-0.2)).toBe('$0');
    expect(formatMoney(-0)).toBe('$0');
  });

  it('adds + for signed deltas', () => {
    expect(formatMoney(12_400, { signed: true })).toBe('+$12,400');
    expect(formatMoney(-50, { signed: true })).toBe('−$50');
  });

  it('formats compact amounts', () => {
    expect(formatMoney(1_234_567, { compact: true })).toBe('$1.2M');
    expect(formatMoney(48_000, { compact: true })).toBe('$48K');
  });

  it('shows a dash for non-finite values', () => {
    expect(formatMoney(Number.NaN)).toBe('—');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatRate', () => {
  it('turns decimal rates into percents', () => {
    expect(formatRate(0.228)).toBe('22.8%');
    expect(formatRate(0.069)).toBe('6.9%');
    expect(formatRate(0.07)).toBe('7%');
    expect(formatRate(0.2236, 2)).toBe('22.36%');
    expect(formatRate(0)).toBe('0%');
  });

  it('handles negatives and non-finite values', () => {
    expect(formatRate(-0.015)).toBe('−1.5%');
    expect(formatRate(Number.NaN)).toBe('—');
  });
});

describe('formatMonth', () => {
  it('names a YYYY-MM month, with an optional day, whatever the local time zone', () => {
    expect(formatMonth('2026-11')).toBe('November');
    expect(formatMonth('2026-01', 1)).toBe('January 1');
    expect(formatMonth('2026-11', 30)).toBe('November 30');
    expect(formatMonth('2028-02', 29)).toBe('February 29');
  });

  it('shows a dash for a malformed month or a day outside it', () => {
    expect(formatMonth('2026-13')).toBe('—');
    expect(formatMonth('Nov 2026')).toBe('—');
    expect(formatMonth('2026-11', 31)).toBe('—');
    expect(formatMonth('2026-02', 29)).toBe('—');
    expect(formatMonth('2026-11', 0)).toBe('—');
  });
});
