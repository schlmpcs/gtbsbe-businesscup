// The duel game: daily pairing, pick score, what decided it, blind spot. Expected numbers are
// worked out by hand: 1000 points × (1 − 0.1 × hints), floor 50%.
import { describe, expect, it } from 'vitest';
import { areaByZip } from '@lifeguessr/data/fixtures';
import { cardsSample } from '@lifeguessr/data/fixtures/cards';
import type { CostBreakdown, CostCategory, Source } from '@lifeguessr/types';
import { clueCost, clueFloor, duelMinGap, guessMaxPoints } from './assumptions';
import { costOfLife } from './cost';
import {
  DUEL_ROUND_COUNT, dailyDuelPairs, duelBlindSpot, duelCategoryLines, duelDifference, duelGap, duelMultiplier, duelRoundPoints,
  scoreDuelPick, type DuelCandidate,
} from './duel';

const SRC: Source = { name: 'Test source', year: 2025 };
const OTHER: Source = { name: 'Other source', year: 2024 };
const cost = (items: [CostCategory, number, Source?, boolean?][]): CostBreakdown => {
  const mid = items.reduce((s, [, a]) => s + a, 0);
  return {
    total: { low: mid, mid, high: mid },
    items: items.map(([category, amount, source = SRC, isEstimate = false]) => ({ category, amount, source, isEstimate })),
  };
};

const SAMPLES: DuelCandidate[] = cardsSample.map((c) => ({ id: c.id, total: costOfLife(c, areaByZip(c.zip)).total.mid }));
// Ten lives from $1,000 to $10,000 a month: 45 pairs.
const TEN: DuelCandidate[] = Array.from({ length: 10 }, (_, i) => ({ id: `life-${i}`, total: 1_000 * (i + 1) }));

describe('dailyDuelPairs', () => {
  it('is deterministic: the same date gives the same five pairs, whatever the input order', () => {
    const a = dailyDuelPairs('2026-11-14', TEN);
    expect(dailyDuelPairs('2026-11-14', TEN)).toEqual(a);
    expect(dailyDuelPairs('2026-11-14', [...TEN].reverse())).toEqual(a);
    expect(a).toHaveLength(DUEL_ROUND_COUNT);
    expect(a.map((p) => p.round)).toEqual([1, 2, 3, 4, 5]);
  });

  it('changes with the date', () => {
    const days = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'];
    const sets = new Set(days.map((d) => JSON.stringify(dailyDuelPairs(d, TEN))));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('goes from easy to close: the gap never grows from round 1 to round 5', () => {
    for (const date of ['2026-01-01', '2026-06-30', '2026-11-14', '2027-02-28']) {
      for (const lives of [TEN, SAMPLES]) {
        const gaps = dailyDuelPairs(date, lives).map((p) => p.gap);
        for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1]!);
        expect(gaps[0]).toBeGreaterThan(gaps[4]!);
      }
    }
  });

  it('round 1 comes from the widest fifth of all pairs and round 5 from the closest fifth', () => {
    const all = TEN.flatMap((a, i) => TEN.slice(i + 1).map((b) => duelGap(a.total, b.total))).sort((x, y) => y - x);
    const pairs = dailyDuelPairs('2026-11-14', TEN);
    expect(pairs[0]!.gap).toBeGreaterThanOrEqual(all[8]!); // 45 pairs → 9 per band
    expect(pairs[4]!.gap).toBeLessThanOrEqual(all[36]!);
  });

  it('pairs two different lives, never the same pair twice, and gives each pair its real gap', () => {
    const pairs = dailyDuelPairs('2026-11-14', SAMPLES);
    const keys = pairs.map((p) => [p.A, p.B].sort().join('|'));
    expect(new Set(keys).size).toBe(pairs.length);
    for (const p of pairs) {
      expect(p.A).not.toBe(p.B);
      const ta = SAMPLES.find((s) => s.id === p.A)!.total;
      const tb = SAMPLES.find((s) => s.id === p.B)!.total;
      expect(p.gap).toBeCloseTo(duelGap(ta, tb), 12);
    }
  });

  it('prefers lives not shown yet that day (10 lives → 10 different lives)', () => {
    for (const date of ['2026-11-14', '2026-12-25']) {
      const ids = dailyDuelPairs(date, TEN).flatMap((p) => [p.A, p.B]);
      expect(new Set(ids).size).toBeGreaterThanOrEqual(8);
    }
  });

  it('puts the costlier life on either side across days', () => {
    const sides = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      for (const p of dailyDuelPairs(`2026-03-${String(d).padStart(2, '0')}`, TEN)) {
        sides.add(TEN.find((t) => t.id === p.A)!.total > TEN.find((t) => t.id === p.B)!.total ? 'A' : 'B');
      }
    }
    expect(sides).toEqual(new Set(['A', 'B']));
  });

  it(`never pairs lives closer than duelMinGap (${duelMinGap.value})`, () => {
    const close: DuelCandidate[] = [
      ...TEN, { id: 'twin-a', total: 5_000 }, { id: 'twin-b', total: 5_050 },
    ];
    for (let d = 1; d <= 28; d++) {
      for (const p of dailyDuelPairs(`2026-02-${String(d).padStart(2, '0')}`, close)) {
        expect(p.gap).toBeGreaterThanOrEqual(duelMinGap.value);
      }
    }
  });

  it('refuses a bad date and too few lives', () => {
    expect(() => dailyDuelPairs('14/11/2026', TEN)).toThrow(/YYYY-MM-DD/);
    expect(() => dailyDuelPairs('2026-11-14', TEN.slice(0, 3))).toThrow(/pairs/);
    expect(() => dailyDuelPairs('2026-11-14', TEN, 6)).toThrow(/rounds/);
  });
});

describe('scoreDuelPick', () => {
  // A: rent $1,500 + car $600 = $2,100. B: rent $1,200 + childcare $1,140 + car $300 = $2,640.
  const A = cost([['rentUtilities', 1_500], ['car', 400], ['car', 200, OTHER]]);
  const B = cost([['rentUtilities', 1_200], ['childcare', 1_140], ['car', 300]]);

  it('uses the game tuning the hand-checked numbers assume', () => {
    expect(guessMaxPoints.value).toBe(1000);
    expect(clueCost.value).toBe(0.1);
    expect(clueFloor.value).toBe(0.5);
  });

  it('a right pick scores 1000, minus 10% per hint, floor 50%; a wrong pick scores 0', () => {
    expect(scoreDuelPick({ A, B }, 'B', 0)).toMatchObject({ correct: true, costlier: 'B', points: 1000, multiplier: 1, maxPoints: 1000 });
    expect(scoreDuelPick({ A, B }, 'B', 1)).toMatchObject({ correct: true, points: 900, multiplier: 0.9 });
    expect(scoreDuelPick({ A, B }, 'B', 3).points).toBe(700);
    expect(scoreDuelPick({ A, B }, 'B', 9).points).toBe(500);
    expect(scoreDuelPick({ A, B }, 'A', 0)).toMatchObject({ correct: false, points: 0 });
    expect([0, 1, 2, 5, 6].map(duelRoundPoints)).toEqual([1000, 900, 800, 500, 500]);
    expect(duelMultiplier(-2)).toBe(1);
    expect(duelMultiplier(Number.NaN)).toBe(1);
  });

  it('returns the monthly totals and the per-category breakdown with every source', () => {
    const r = scoreDuelPick({ A, B }, 'A', 0);
    expect(r.totals).toEqual({ A: 2_100, B: 2_640 });
    expect(r.breakdown.A).toEqual([
      { category: 'rentUtilities', amount: 1_500, sources: [SRC], isEstimate: false },
      { category: 'car', amount: 600, sources: [SRC, OTHER], isEstimate: false },
    ]);
    expect(r.breakdown.B.map((l) => l.category)).toEqual(['rentUtilities', 'childcare', 'car']);
  });

  it('decidedBy = the category with the biggest gap toward the costlier life', () => {
    // Toward B: rent −300, childcare +1,140, car −300 → childcare.
    expect(scoreDuelPick({ A, B }, 'A', 0).decidedBy).toEqual({ category: 'childcare', A: 0, B: 1_140 });
    // Flip sides: still childcare, now toward A.
    expect(scoreDuelPick({ A: B, B: A }, 'A', 0).decidedBy).toEqual({ category: 'childcare', A: 1_140, B: 0 });
    // Rent decides when the costlier life's extra is mostly rent.
    const rich = cost([['rentUtilities', 3_000], ['eatingOut', 500]]);
    const poor = cost([['rentUtilities', 1_000], ['eatingOut', 700]]);
    expect(scoreDuelPick({ A: poor, B: rich }, 'B', 0).decidedBy).toEqual({ category: 'rentUtilities', A: 1_000, B: 3_000 });
  });

  it('picks the lesson: childcare that tops the same home’s rent gets its own', () => {
    expect(scoreDuelPick({ A, B }, 'B', 0).lesson).toBe('childcare');
    const daycare = cost([['rentUtilities', 1_200], ['childcare', 1_500]]);
    expect(scoreDuelPick({ A, B: daycare }, 'B', 0).lesson).toBe('childcareOverRent');
    const car = cost([['rentUtilities', 1_500], ['car', 1_400]]);
    expect(scoreDuelPick({ A, B: car }, 'B', 0).lesson).toBe('car');
  });

  it('equal totals: either pick is right', () => {
    const same = cost([['rentUtilities', 2_100]]);
    expect(scoreDuelPick({ A, B: same }, 'A', 0)).toMatchObject({ correct: true, costlier: null, points: 1000 });
    expect(scoreDuelPick({ A, B: same }, 'B', 0).correct).toBe(true);
  });

  it('works on real fixture cards (costOfLife)', () => {
    const [c1, , , , , c6] = cardsSample;
    const r = scoreDuelPick({ A: costOfLife(c1!, areaByZip(c1!.zip)), B: costOfLife(c6!, areaByZip(c6!.zip)) }, 'B', 0);
    expect(r.correct).toBe(true);
    expect(r.decidedBy.B).toBeGreaterThan(r.decidedBy.A);
    expect(r.breakdown.B.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(r.totals.B, 6);
  });
});

describe('duel helpers', () => {
  it('duelDifference: the costlier side and by how much a month', () => {
    expect(duelDifference({ A: 2_100, B: 3_640 })).toEqual({ costlier: 'B', amount: 1_540 });
    expect(duelDifference({ A: 5_000, B: 4_000 })).toEqual({ costlier: 'A', amount: 1_000 });
    expect(duelDifference({ A: 10, B: 10 })).toEqual({ costlier: null, amount: 0 });
  });

  it('duelCategoryLines: adds up lines per category, flags estimates, largest first', () => {
    const lines = duelCategoryLines(cost([['groceries', 300], ['eatingOut', 400, SRC, true], ['groceries', 200]]));
    expect(lines).toEqual([
      { category: 'groceries', amount: 500, sources: [SRC], isEstimate: false },
      { category: 'eatingOut', amount: 400, sources: [SRC], isEstimate: true },
    ]);
  });

  it('duelBlindSpot: the category behind the most misses, earliest on a tie, null with none', () => {
    expect(duelBlindSpot([])).toBeNull();
    expect(duelBlindSpot(['car'])).toBe('car');
    expect(duelBlindSpot(['rentUtilities', 'childcare', 'childcare'])).toBe('childcare');
    expect(duelBlindSpot(['car', 'childcare'])).toBe('car');
  });
});
