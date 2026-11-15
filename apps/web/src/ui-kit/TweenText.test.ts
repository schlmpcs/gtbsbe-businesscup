import { describe, expect, it } from 'vitest';
import { tweenText } from './TweenText';

describe('tweenText: eases the numbers of one formatted string into the next', () => {
  it('interpolates every number, with the target’s decimals', () => {
    // 35.7 + (61.3 − 35.7) × 0.5 = 48.5
    expect(tweenText('$35.7K less at retirement', '$61.3K less at retirement', 0.5)).toBe('$48.5K less at retirement');
    // 100 + (0 − 100) × 0.25 = 75
    expect(tweenText('100%', '0%', 0.25)).toBe('75%');
    // 1,000 + (3,000 − 1,000) × 0.5 = 2,000, grouped like the target
    expect(tweenText('$1,000 at 67', '$3,000 at 67', 0.5)).toBe('$2,000 at 67');
  });

  it('starts at `from` and ends exactly on `to`', () => {
    expect(tweenText('$35.7K', '$61.3K', 0)).toBe('$35.7K');
    expect(tweenText('$35.7K', '$61.3K', 1)).toBe('$61.3K');
  });

  it('jumps straight to `to` when the words around the numbers differ (e.g. K → M)', () => {
    expect(tweenText('$967.1K', '$1.02M', 0.5)).toBe('$1.02M');
    expect(tweenText('Measuring…', '83%', 0.5)).toBe('83%');
    expect(tweenText('$5K more', '$5K less', 0.5)).toBe('$5K less');
  });
});
