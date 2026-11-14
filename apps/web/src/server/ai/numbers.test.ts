import { describe, expect, it } from 'vitest';
import { allowedForms, extractNumbers, tokenMatches, unsupportedNumbers } from './numbers';

describe('extractNumbers', () => {
  it('reads dollars, separators, decimals, K/M suffixes and percents', () => {
    const tokens = extractNumbers('Pay $1,234.50 now, save $48K, reach $1.2M, at 6.9% APR or 22 percent.');
    expect(tokens.map((t) => [t.value, t.percent])).toEqual([
      [1234.5, false], [48_000, false], [1_200_000, false], [6.9, true], [22, true],
    ]);
    expect(tokens[0].halfUnit).toBeCloseTo(0.005); // cents
    expect(tokens[1].halfUnit).toBe(500);
    expect(tokens[2].halfUnit).toBe(50_000);
  });

  it('does not read "12 months" as 12 million', () => {
    expect(extractNumbers('over 12 months').map((t) => t.value)).toEqual([12]);
  });

  it('reads number words but not "one"', () => {
    expect(extractNumbers('one of your debts, paid in three years with twenty dollars').map((t) => t.value))
      .toEqual([3, 20]);
  });
});

describe('tokenMatches', () => {
  const [t48k] = extractNumbers('$48K');
  const [t48214] = extractNumbers('$48,214');
  const [t48000] = extractNumbers('$48,000');
  const [t50000] = extractNumbers('$50,000');

  it('accepts display rounding of the target', () => {
    expect(tokenMatches(t48k, 48_213.77)).toBe(true);
    expect(tokenMatches(t48214, 48_213.77)).toBe(true);
    expect(tokenMatches(t48000, 48_213.77)).toBe(true); // within 1%
  });

  it('rejects a different number', () => {
    expect(tokenMatches(t50000, 48_213.77)).toBe(false);
    expect(tokenMatches(t48214, 4_821.38)).toBe(false);
  });

  it('ignores the sign', () => {
    expect(tokenMatches(t48214, -48_213.77)).toBe(true);
  });
});

describe('unsupportedNumbers', () => {
  it('passes numbers from the input, including rates shown as percents', () => {
    const allowed = allowedForms([48_213.77, 0.228, 10]);
    expect(unsupportedNumbers('Adds $48,214 in 10 years and drops 22.8% APR debt.', allowed)).toEqual([]);
  });

  it('flags invented numbers', () => {
    const allowed = allowedForms([48_213.77, 10]);
    expect(unsupportedNumbers('Adds $48,214 in 10 years, about $400 a month.', allowed)).toEqual(['400']);
    expect(unsupportedNumbers('Adds $48,214 in five years.', allowed)).toEqual(['five']);
  });
});
