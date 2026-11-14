// The wording guardrails of the overpaying check (docs/design/11-overpaying-check.md): it says where a
// cost sits and what a gap is worth. It never accuses, never tells anyone what to do, names no provider.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  it('calls the 10-year figure a projection, based on the person\'s inputs, and says what it is for', () => {
    const line = overpaying.result.effect('$770', '$40,000');
    expect(line).toMatch(/^Projected/);
    expect(line).toMatch(/based on your inputs/i);
    expect(line).toContain('middle of the typical range');
    expect(line).toContain('$770'); // the monthly difference the 10-year figure is for
    expect(line).toContain('$40,000');
    expect(line).not.toMatch(/gap/i); // the gap is a different baseline (the top of the range)
    expect(overpaying.result.effectHint).toMatch(/^Projected/);
    expect(overpaying.result.effectHint).toMatch(/middle of the typical range/);
    expect(overpaying.result.effectHint).toMatch(/based on your inputs/i);
  });

  it('points, in the header of the copy file, at a test file that exists', () => {
    const header = readFileSync(fileURLToPath(new URL('../../copy/overpaying.ts', import.meta.url)), 'utf8');
    const named = [...header.matchAll(/\b([A-Za-z]+\.test\.tsx?)\b/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0);
    for (const file of named) expect(existsSync(fileURLToPath(new URL(`./${file}`, import.meta.url))), file).toBe(true);
  });

  it('says how the range is labelled when it is an estimate or approximate', () => {
    expect(overpaying.result.estimate).toBe('estimate');
    expect(overpaying.coverage.approximate).toBe('approximate, nearest metro');
  });
});
