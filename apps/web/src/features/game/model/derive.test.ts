import { costOfLife } from '@lifeguessr/engine';
import type { LifeCard, Source } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { areaByZip, cardsSample } from '@/fixtures';
import { GUESS_MAX, GUESS_MIN } from './constants';
import { aggregateCategories, buildDay, buildReveal, cardFacts, clueCostOf, clueFacts, clueMultiplier, revealScale } from './derive';
import type { CostItemVM } from './types';

const SRC_A: Source = { name: 'A', year: 2025 };
const SRC_B: Source = { name: 'B', year: 2024, url: 'https://example.org/b' };

describe('clue facts', () => {
  const car = { price: 32_000, downPayment: 4_000, apr: 0.069, termMonths: 60 };

  it('garage: a financed car, a car paid in cash, or no car', () => {
    expect(clueFacts('garage', { car })).toEqual([{ kind: 'car', price: 32_000, financed: true, termMonths: 60, apr: 0.069 }]);
    expect(clueFacts('garage', { car: { ...car, downPayment: 32_000 } })[0]).toMatchObject({ financed: false });
    expect(clueFacts('garage', {})).toEqual([{ kind: 'noCar' }]);
  });

  it('kids room, kitchen, entry and mailbox', () => {
    expect(clueFacts('kidsRoom', { kids: ['infant', 'schoolAge'] })).toEqual([{ kind: 'kids', ages: ['infant', 'schoolAge'] }]);
    expect(clueFacts('kidsRoom', { kids: [] })).toEqual([{ kind: 'kids', ages: [] }]);
    expect(clueFacts('kitchen', { eatingOutPerWeek: 0 })).toEqual([{ kind: 'eatingOut', perWeek: 0 }]);
    expect(clueFacts('entry', { adults: 2, kids: ['toddler'] })).toEqual([{ kind: 'household', adults: 2, kids: 1 }]);
    expect(clueFacts('entry', { adults: 1 })).toEqual([{ kind: 'household', adults: 1, kids: 0 }]);
    expect(clueFacts('mailbox', { zip: '75216', tier: 'cheap' })).toEqual([{ kind: 'zip', zip: '75216', tier: 'cheap' }]);
    expect(clueFacts('mailbox', { zip: '75216' })).toEqual([{ kind: 'zip', zip: '75216', tier: null }]);
  });

  it('skips facts a clue did not carry (except the garage, where none means no car)', () => {
    expect(clueFacts('kidsRoom', {})).toEqual([]);
    expect(clueFacts('kitchen', {})).toEqual([]);
    expect(clueFacts('entry', {})).toEqual([]);
    expect(clueFacts('mailbox', {})).toEqual([]);
  });

  it('a revealed card lists every fact in clue order', () => {
    for (const card of cardsSample) {
      const facts = cardFacts(card);
      expect(facts.map((f) => f.kind)).toEqual([card.car ? 'car' : 'noCar', 'kids', 'eatingOut', 'household', 'zip']);
      expect(facts.at(-1)).toEqual({ kind: 'zip', zip: card.zip, tier: null });
    }
  });
});

describe('clue cost', () => {
  it('is the multiplier step, clean of float noise, and 0 at the floor', () => {
    expect(clueCostOf(clueMultiplier(0), clueMultiplier(1))).toBe(0.1);
    expect(clueCostOf(clueMultiplier(2), clueMultiplier(3))).toBe(0.1);
    expect(clueCostOf(clueMultiplier(5), clueMultiplier(6))).toBe(0);
    expect(clueCostOf(0.5, 0.6)).toBe(0);
  });
});

describe('aggregateCategories', () => {
  const item = (category: CostItemVM['category'], amount: number, source: Source, isEstimate = false): CostItemVM => ({
    category, amount, share: 0, source, isEstimate,
  });

  it('adds lines per category, keeps distinct sources, flags any estimate, sorts largest first', () => {
    const rows = aggregateCategories(
      [item('rentUtilities', 1500, SRC_A), item('car', 400, SRC_A), item('car', 200, SRC_B, true), item('car', 150, SRC_A)],
      2250,
    );
    expect(rows.map((r) => r.category)).toEqual(['rentUtilities', 'car']);
    expect(rows[1]).toEqual({ category: 'car', amount: 750, share: 750 / 2250, isEstimate: true, sources: [SRC_A, SRC_B] });
    expect(rows[0]).toMatchObject({ amount: 1500, isEstimate: false, sources: [SRC_A] });
  });

  it('a zero mid gives zero shares', () => {
    expect(aggregateCategories([item('other', 10, SRC_A)], 0)[0]!.share).toBe(0);
  });

  it('on every fixture card the categories add up to the lines and are unique', () => {
    for (const card of cardsSample) {
      const cost = costOfLife(card as LifeCard, areaByZip(card.zip));
      const reveal = buildReveal(
        { resultId: 'r', cost, card: card as LifeCard, cluesOpened: [], result: { points: 0, basePoints: 0, multiplier: 1, inRange: false, logError: 1 } },
        2000, 'fixtures', false,
      );
      const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
      expect(sum(reveal.categories)).toBeCloseTo(sum(reveal.items), 6);
      expect(new Set(reveal.categories.map((c) => c.category)).size).toBe(reveal.categories.length);
      expect(reveal.surprise?.category).toBe(reveal.categories[0]!.category);
      expect(reveal.maxPoints).toBe(1000);
      expect(reveal.missBy).toBeCloseTo(Math.abs(2000 - cost.total.mid), 9);
    }
  });
});

describe('revealScale', () => {
  it('spans the guess slider and orders the positions on a log track', () => {
    const s = revealScale(2000, { low: 3000, mid: 4000, high: 5000 });
    expect(s.min).toBe(GUESS_MIN);
    expect(s.max).toBe(GUESS_MAX);
    expect(s.guess).toBeLessThan(s.low);
    expect(s.low).toBeLessThan(s.mid);
    expect(s.mid).toBeLessThan(s.high);
    expect(s.guess).toBeCloseTo(Math.log(2) / Math.log(15), 9);
  });

  it('widens when the range is outside the slider', () => {
    const s = revealScale(15_000, { low: 16_000, mid: 18_000, high: 20_000 });
    expect(s.max).toBe(20_000);
    expect(s.high).toBe(1);
    expect(s.guess).toBeLessThan(s.low);
  });
});

describe('buildDay', () => {
  it('adds up the points of guessed homes and marks the current one', () => {
    const cards = cardsSample.slice(0, 3).map((c) => ({ id: c.id }) as never);
    const reveal = (points: number) => ({ result: { points } }) as never;
    const day = buildDay(cards, { [cardsSample[0]!.id]: reveal(840), [cardsSample[1]!.id]: reveal(310) }, 2);
    expect(day.maxPerHome).toBe(1000);
    expect(day.totalPoints).toBe(1150);
    expect(day.homes.map((h) => [h.points, h.current])).toEqual([[840, false], [310, false], [null, true]]);
  });
});
