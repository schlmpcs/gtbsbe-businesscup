import { describe, expect, it } from 'vitest';
import { clamp, cleanFloat, decimalsOf, formatPlainNumber, parseTypedNumber, snapToStep } from './numbers';

describe('parseTypedNumber', () => {
  it('reads what people type into money and percent boxes', () => {
    expect(parseTypedNumber('1234')).toBe(1234);
    expect(parseTypedNumber('1,234.50')).toBe(1234.5);
    expect(parseTypedNumber(' $1,200 ')).toBe(1200);
    expect(parseTypedNumber('22.8%')).toBe(22.8);
    expect(parseTypedNumber('.5')).toBe(0.5);
    expect(parseTypedNumber('7.')).toBe(7);
    expect(parseTypedNumber('-40')).toBe(-40);
    expect(parseTypedNumber('−40')).toBe(-40);
  });

  it('returns null for an empty box and undefined for text that is not a number yet', () => {
    expect(parseTypedNumber('')).toBeNull();
    expect(parseTypedNumber('   ')).toBeNull();
    expect(parseTypedNumber('-')).toBeUndefined();
    expect(parseTypedNumber('1.2.3')).toBeUndefined();
    expect(parseTypedNumber('abc')).toBeUndefined();
    expect(parseTypedNumber('1e5')).toBeUndefined();
  });
});

describe('step helpers', () => {
  it('counts step decimals', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(50)).toBe(0);
    expect(decimalsOf(0.01)).toBe(2);
    expect(decimalsOf(0.005)).toBe(3);
    expect(decimalsOf(1e-7)).toBe(7);
  });

  it('snaps to the step grid without float noise', () => {
    expect(snapToStep(0.30000000000000004, 0.1, 0)).toBe(0.3);
    expect(snapToStep(1234, 50, 0)).toBe(1250);
    expect(snapToStep(1224, 50, 0)).toBe(1200);
    expect(snapToStep(7, 5, 2)).toBe(7);
    expect(snapToStep(0.2436, 0.005, 0)).toBe(0.245);
  });

  it('clamps and cleans floats', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(cleanFloat(24.36 / 100)).toBe(0.2436);
    expect(cleanFloat(0.1 + 0.2)).toBe(0.3);
  });

  it('formats plain numbers grouped at rest and ungrouped while editing', () => {
    expect(formatPlainNumber(1234.5, 2, true)).toBe('1,234.5');
    expect(formatPlainNumber(1234.5, 2, false)).toBe('1234.5');
    expect(formatPlainNumber(24.360000000000003, 2, false)).toBe('24.36');
  });
});
