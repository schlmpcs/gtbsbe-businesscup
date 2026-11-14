// The wording guardrails of the debt payoff planner (docs/design/12-debt-payoff.md): it describes what each method
// does and never which to use, names no lender, says nothing about consolidating or refinancing, never shames,
// and calls its dates projections under assumptions.
import { describe, expect, it } from 'vitest';
import { loan } from '@/copy';

/** Every string in the copy object; functions are called with a few argument shapes to reach their branches. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    for (const args of [['A', 'B', 'C'], [1, 1, 1], [2, 0, 0], [0, 0, 0]]) {
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
  /\blender/i, /\bbank\b/i, /\bcredit union/i, /\bconsolidat/i, /\brefinanc/i, /\brefi\b/i, /\bbalance transfer/i, // no provider, no product advice
  /\bshould\b/i, /\brecommend/i, /\bbest\b/i, /\bsmart/i, /\bmust\b/i, /\bneed to\b/i, /\bwe suggest/i, // never which to use
  /\bbad\b/i, /\bworst\b/i, /\birresponsible/i, /\btrap/i, /\bfailing\b/i, /\btrouble/i, /\bbehind\b/i, /\bashamed/i, /\bshame/i, // never shames
  /\bguarantee/i, // a date is a projection
];

describe('payoff planner copy', () => {
  const strings = allStrings(loan.planner);

  it('has plenty to check', () => {
    expect(strings.length).toBeGreaterThan(40);
  });

  it('names no lender, offers no consolidation or refinancing, and never tells anyone which method to use or shames', () => {
    for (const s of strings) for (const word of BANNED) expect(s, `${word} in "${s}"`).not.toMatch(word);
  });

  it('says it is an educational simulation, not financial advice, and a projection from the person\'s inputs', () => {
    expect(loan.planner.intro).toMatch(/educational simulation, not financial advice/);
    expect(loan.planner.intro).toMatch(/^.*Projected from your inputs/);
  });

  it('puts the dates under assumptions, as a projection and not a promise', () => {
    expect(loan.planner.assumptions).toMatch(/^Under our assumptions/);
    expect(loan.planner.assumptions).toMatch(/A projection, not a promise/);
  });

  it('describes each method by what it optimizes, in neutral words', () => {
    expect(loan.planner.method.describes.avalanche).toBe('Highest rate first. Pays the least interest.');
    expect(loan.planner.method.describes.snowball).toBe('Smallest balance first. Closes accounts sooner.');
    expect(loan.planner.method.describes.minimum).toMatch(/baseline/);
  });

  it('does not name a cause for a plan that does not finish: it may be a payment under the interest, or just too slow', () => {
    expect(loan.planner.never.body).not.toMatch(/interest|enough|cover the/i);
    expect(loan.planner.never.body).toMatch(/100 years/);
  });

  it('calls the extra it finds a total, and says the difference to what is set when there is one', () => {
    expect(loan.planner.never.fix('$122', 10)).toBe('A total extra of $122 a month would clear it within 10 years.');
    expect(loan.planner.target.needs('March 2030', '$122')).toBe('To be debt-free by March 2030: a total extra of $122 a month.');
    expect(loan.planner.target.needsMore('$72')).toBe('That is $72 more than you have set.');
  });

  it('leads the savings sentence with its own colon, so the screen puts no punctuation of its own', () => {
    expect(loan.planner.savings.title('Avalanche')).toBe('Avalanche against minimums only:');
  });

  it('has a sentence for a plan that costs more than minimums only, that does not read as a saving', () => {
    expect(loan.planner.savings.interestCosts('$300')).toBe('$300 more interest');
    expect(loan.planner.savings.monthsCosts(165)).toBe('165 months later');
    expect(loan.planner.savings.interestCosts('$300')).not.toMatch(/saves|less|sooner/);
  });
});
