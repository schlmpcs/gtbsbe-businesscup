// The wording guardrails of the overpaying check (docs/design/11-overpaying-check.md): it says where a
// cost sits and what a gap is worth. It never accuses, never tells anyone what to do, names no provider.
import { describe, expect, it } from 'vitest';
import { overpaying } from '@/copy';

/** Every string in the copy object; functions are called with a few argument shapes to reach their branches. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    for (const args of [['A', 'B', 'C', 'D'], [1, 1, 1, 1], [2, 0, 0, 0], [0, 0, 0, 0]]) {
      try {
        allStrings(fn(...args), out);
      } catch {
        // a function that does not take these arguments
      }
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) allStrings(v, out);
  return out;
}

const BANNED = [
  /overpay/i, /ripped off/i, /too much/i, /\bshame/i, // accusations
  /\bswitch/i, /\bnegotiat/i, /\brenegotiat/i, /\bmove\b/i, /\bmoving\b/i, /\bcancel/i, /\bshould\b/i, /\brecommend/i, // instructions
  /cheaper/i, /cheapest/i, /\bsave\b/i, /\bsaving/i, // nudges
  /\blender/i, /\binsurer/i, /\blandlord/i, /\bprovider/i, // no provider named or implied
];

describe('overpaying copy', () => {
  const strings = allStrings(overpaying);

  it('has plenty to check', () => {
    expect(strings.length).toBeGreaterThan(50);
  });

  it('never accuses, instructs, nudges or names a provider', () => {
    for (const s of strings) for (const word of BANNED) expect(s, `${word} in "${s}"`).not.toMatch(word);
  });

  it('calls the 10-year figure a projection, based on the person\'s inputs', () => {
    expect(overpaying.result.effect('$1')).toMatch(/^Projected/);
    expect(overpaying.result.effectHint).toMatch(/Projected.*Based on your inputs/);
  });

  it('says how the range is labelled when it is an estimate or approximate', () => {
    expect(overpaying.result.estimate).toBe('estimate');
    expect(overpaying.coverage.approximate).toBe('approximate, nearest metro');
  });
});
