import { findArea, getArea } from '@lifeguessr/data/areas';
import { lifeCards } from '@lifeguessr/data/cards';
import { costOfLife, dailyDuelPairs, DUEL_ROUND_COUNT, scoreDuelPick } from '@lifeguessr/engine';
import type { DuelLetter, LifeCard, PublicDuel } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { duel as t } from '@/copy/duel';
import { hintOf, publicDuelCard } from '@/lib/duel/publicDuelCard';
import {
  duelCandidates, duelHint, duelPool, duelScorer, duelSet, findDuelPair, publicDuels, type DuelPair,
} from './duel';

/** Every 'YYYY-MM-DD' from `from` to `to`, inclusive. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

// The catalog fitness range (#110): the engine was only exercised on the 15 sample cards.
const FITNESS_DATES = datesBetween('2026-11-01', '2028-12-31');
const totalOf = (card: LifeCard) => costOfLife(card, getArea(card.zip)).total.mid;

describe('the duel pool', () => {
  it('is the slider’s daily pool: every catalog card that is not in a creator pack', () => {
    const daily = lifeCards.filter((c) => c.pack === undefined);
    expect(duelPool.map((c) => c.id)).toEqual(daily.map((c) => c.id));
    expect(duelPool.length).toBeGreaterThanOrEqual(2 * DUEL_ROUND_COUNT);
    expect(duelPool.some((c) => c.pack !== undefined)).toBe(false);
  });

  it('every catalog ZIP resolves to area data', () => {
    for (const card of lifeCards) expect(findArea(card.zip), `${card.id} ZIP ${card.zip}`).not.toBeNull();
  });

  it('candidates are the pool’s ids with costOfLife total.mid, derived once', () => {
    const candidates = duelCandidates();
    expect(candidates).toEqual(duelPool.map((c) => ({ id: c.id, total: totalOf(c) })));
    expect(duelCandidates()).toBe(candidates);
  });
});

describe('the day’s duel set', () => {
  it('is the engine’s dailyDuelPairs on the pool, with the cards themselves', () => {
    const date = '2026-11-14';
    const ids = dailyDuelPairs(date, duelCandidates());
    const set = duelSet(date);
    expect(set.map((p) => ({ round: p.round, A: p.A.id, B: p.B.id, gap: p.gap }))).toEqual(ids);
    for (const pair of set) {
      expect(pair.A).toBe(duelPool.find((c) => c.id === pair.A.id));
      expect(pair.B).toBe(duelPool.find((c) => c.id === pair.B.id));
    }
  });

  it('is memoized per date and stays correct after older dates fall out of the memo', () => {
    const first = duelSet('2026-11-14');
    expect(duelSet('2026-11-14')).toBe(first);
    for (const date of datesBetween('2027-01-01', '2027-01-10')) duelSet(date);
    expect(duelSet('2026-11-14')).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
  });

  it('refuses a malformed date', () => {
    expect(() => duelSet('2026-13-01')).toThrow();
    expect(() => duelSet('14/11/2026')).toThrow();
  });

  it('findDuelPair answers the round’s pair, or null for a round the day doesn’t have', () => {
    const date = '2026-11-14';
    for (const pair of duelSet(date)) expect(findDuelPair(date, pair.round)).toBe(pair);
    expect(findDuelPair(date, 0)).toBeNull();
    expect(findDuelPair(date, 6)).toBeNull();
    expect(findDuelPair(date, 2.5)).toBeNull();
  });
});

describe('publicDuels: what the browser sees', () => {
  it('five life duels whose cards come from the shared builder', () => {
    const date = '2026-11-14';
    const duels = publicDuels(date);
    expect(duels).toHaveLength(DUEL_ROUND_COUNT);
    duels.forEach((duel, i) => {
      const pair = duelSet(date)[i]!;
      expect(duel).toEqual({
        date,
        round: pair.round,
        kind: 'life',
        cards: [publicDuelCard(pair.A, 'A'), publicDuelCard(pair.B, 'B')],
      } satisfies PublicDuel);
    });
  });

  it('is deterministic: the same date gives the same output, different dates usually differ', () => {
    const dates = datesBetween('2026-11-01', '2026-11-30');
    const once = dates.map((d) => JSON.stringify(publicDuels(d)));
    const again = dates.map((d) => JSON.stringify(publicDuels(d)));
    expect(again).toEqual(once);
    const days = once.map((json) => JSON.stringify(JSON.parse(json).map((d: PublicDuel) => ({ ...d, date: '' }))));
    expect(new Set(days).size).toBe(dates.length);
  });

  describe('never leaks the answer', () => {
    const dates = datesBetween('2026-11-01', '2026-11-30');
    const tiers = ['cheap', 'mid', 'expensive', 'suburb'] as const;
    const totals = lifeCards.map(totalOf);

    it.each(dates)('%s: no card id, ZIP, tier, total or amount', (date) => {
      const json = JSON.stringify(publicDuels(date));
      for (const card of lifeCards) expect(json).not.toMatch(new RegExp(`(?<![\\w-])${card.id}(?![\\w-])`));
      expect(json).not.toMatch(/(?<!\d)\d{5}(?!\d)/);
      for (const tier of tiers) {
        expect(json.toLowerCase()).not.toMatch(new RegExp(`\\b${tier}\\b`));
        expect(json).not.toContain(t.hintFacts[tier]);
      }
      const numbers = (json.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
      for (const total of totals) {
        expect(numbers).not.toContain(total);
        expect(numbers).not.toContain(Math.round(total));
        expect(numbers).not.toContain(Number(total.toFixed(2)));
      }
      const keys = new Set<string>();
      JSON.parse(json, (key, value) => (keys.add(key), value));
      for (const key of ['id', 'zip', 'tier', 'total', 'totals', 'amount', 'breakdown', 'cost', 'gap']) expect(keys).not.toContain(key);
    });
  });
});

describe('duelHint', () => {
  it('is each life’s neighborhood tier in words', () => {
    const pair = duelSet('2026-11-14')[0]!;
    expect(duelHint(pair)).toEqual({ A: hintOf(getArea(pair.A.zip)), B: hintOf(getArea(pair.B.zip)) });
    expect(Object.values(t.hintFacts)).toContain(duelHint(pair).A);
  });
});

describe('duelScorer', () => {
  const date = '2026-11-14';
  const costsOf = (pair: DuelPair) => ({ A: costOfLife(pair.A, getArea(pair.A.zip)), B: costOfLife(pair.B, getArea(pair.B.zip)) });
  const costlierOf = (pair: DuelPair): DuelLetter => (totalOf(pair.A) > totalOf(pair.B) ? 'A' : 'B');
  const other = (l: DuelLetter): DuelLetter => (l === 'A' ? 'B' : 'A');

  it('the costlier pick scores 1,000 with no hint and 900 with one; the other pick scores 0', () => {
    for (const pair of duelSet(date)) {
      const right = costlierOf(pair);
      expect(duelScorer(pair, right)(0)).toMatchObject({ correct: true, points: 1000 });
      expect(duelScorer(pair, right)(1)).toMatchObject({ correct: true, points: 900 });
      expect(duelScorer(pair, other(right))(0)).toMatchObject({ correct: false, points: 0 });
      expect(duelScorer(pair, other(right))(1)).toMatchObject({ correct: false, points: 0 });
    }
  });

  it('is scoreDuelPick’s result with the lesson filled from the copy table, and nothing else', () => {
    const lessons: string[] = Object.values(t.lessons);
    for (const pair of duelSet(date)) {
      for (const choice of ['A', 'B'] as const) {
        for (const hints of [0, 1]) {
          const scored = duelScorer(pair, choice)(hints);
          const engine = scoreDuelPick(costsOf(pair), choice, hints);
          expect(scored).toEqual({
            correct: engine.correct,
            points: engine.points,
            totals: engine.totals,
            breakdown: engine.breakdown,
            decidedBy: engine.decidedBy,
            lesson: t.lessons[engine.lesson],
          });
          expect(lessons).toContain(scored.lesson);
          expect(scored).not.toHaveProperty('resultId');
          expect(scored).not.toHaveProperty('crowd');
        }
      }
    }
  });

  it('is pure: the same hint count gives an equal result, and calls don’t affect each other', () => {
    const pair = duelSet(date)[2]!;
    const score = duelScorer(pair, 'A');
    const first = score(0);
    score(1);
    expect(score(0)).toEqual(first);
    expect(score(0)).not.toBe(first);
  });

  it('refuses a hint count that is not a whole number ≥ 0 (the store counts what it recorded)', () => {
    const score = duelScorer(duelSet(date)[0]!, 'A');
    for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => score(bad)).toThrow(RangeError);
  });

  it('throws rather than pick a winner when both lives cost the same', () => {
    const pair = duelSet(date)[0]!;
    expect(() => duelScorer({ ...pair, B: pair.A }, 'A')).toThrow(/same/);
  });
});

describe('catalog fitness, every date 2026-11-01 … 2028-12-31', () => {
  const faceOf = (card: LifeCard) => {
    const { household, metro, facts } = publicDuelCard(card, 'A');
    return JSON.stringify({ household, metro, facts });
  };
  const total = new Map(duelPool.map((c) => [c.id, totalOf(c)]));

  it('builds five rounds every day, without throwing', () => {
    for (const date of FITNESS_DATES) expect(duelSet(date), date).toHaveLength(DUEL_ROUND_COUNT);
  });

  it('round gaps never increase from round 1 to round 5', () => {
    for (const date of FITNESS_DATES) {
      const gaps = duelSet(date).map((p) => p.gap);
      for (let k = 1; k < gaps.length; k++) expect(gaps[k], `${date} round ${k + 1}`).toBeLessThanOrEqual(gaps[k - 1]!);
    }
  });

  it('no life plays twice in a day', () => {
    const repeats = FITNESS_DATES.filter((date) => {
      const ids = duelSet(date).flatMap((p) => [p.A.id, p.B.id]);
      return new Set(ids).size !== ids.length;
    });
    expect(repeats).toEqual([]);
  });

  it('no round pairs two lives that look identical on the card face but cost different amounts', () => {
    const coinFlips: string[] = [];
    for (const date of FITNESS_DATES) {
      for (const pair of duelSet(date)) {
        if (faceOf(pair.A) === faceOf(pair.B) && total.get(pair.A.id) !== total.get(pair.B.id)) {
          coinFlips.push(`${date} round ${pair.round}: ${pair.A.id} vs ${pair.B.id}`);
        }
      }
    }
    expect(coinFlips).toEqual([]);
  });

  it('every round’s totals differ by at least the engine’s minimum gap (a pick always has one right answer)', () => {
    for (const date of FITNESS_DATES) {
      for (const pair of duelSet(date)) expect(total.get(pair.A.id), `${date} round ${pair.round}`).not.toBe(total.get(pair.B.id));
    }
  });
});
