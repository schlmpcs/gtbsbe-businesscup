// The real life-card catalog (packages/data, T10) through the engine: every card gets a sane cost
// from its area's real data, and each day's set really goes easy → curveball.
import { describe, expect, it } from 'vitest';
import { getArea } from '@lifeguessr/data/areas';
import { cardSlot, dailyCards, dailyCycleDays, lifeCards } from '@lifeguessr/data/cards';
import type { CostBreakdown, CostCategory, LifeCard } from '@lifeguessr/types';
import { cardToProfile, costOfLife } from './cost';

/** The game's guess slider range (apps/web/src/features/game/model/constants.ts). */
const GUESS_MIN = 1_000;
const GUESS_MAX = 15_000;

const byCategory = (cost: CostBreakdown): Map<CostCategory, number> => {
  const totals = new Map<CostCategory, number>();
  for (const i of cost.items) totals.set(i.category, (totals.get(i.category) ?? 0) + i.amount);
  return totals;
};

/** A curveball: some other category costs at least as much as housing (e.g. childcare > rent). */
const curveball = (cost: CostBreakdown): CostCategory | null => {
  const totals = byCategory(cost);
  const rent = totals.get('rentUtilities')!;
  for (const [category, amount] of totals) if (category !== 'rentUtilities' && amount >= rent) return category;
  return null;
};

const costOf = (card: LifeCard) => costOfLife(card, getArea(card.zip));

describe('life cards with real area data', () => {
  it('cost every card sanely: positive lines, low ≤ mid ≤ high, mid inside the guess slider', () => {
    for (const card of lifeCards) {
      const { total, items } = costOf(card);
      expect(total.low, card.id).toBeGreaterThan(0);
      expect(total.low, card.id).toBeLessThanOrEqual(total.mid);
      expect(total.mid, card.id).toBeLessThanOrEqual(total.high);
      expect(total.mid, card.id).toBeGreaterThanOrEqual(GUESS_MIN);
      expect(total.mid, card.id).toBeLessThanOrEqual(GUESS_MAX);
      expect(total.mid).toBeCloseTo(items.reduce((s, i) => s + i.amount, 0), 6);
      for (const i of items) {
        expect(i.amount, `${card.id} ${i.category}`).toBeGreaterThan(0);
        expect(i.source.name.length).toBeGreaterThan(0);
      }
      const categories = new Set(items.map((i) => i.category));
      expect(categories.has('rentUtilities')).toBe(true);
      expect(categories.has('childcare')).toBe(card.kids.length > 0);
      expect(categories.has('car')).toBe(card.car !== undefined);
    }
  });

  it('turn every card into a valid closest-life profile', () => {
    for (const card of lifeCards) {
      const p = cardToProfile(card, getArea(card.zip));
      expect(p.takeHomePay.value, card.id).toBeGreaterThan(0);
      expect(p.zip).toBe(card.zip);
    }
  });

  it('shape every day: slot 1 easy, slots 1–4 housing-led, slot 5 a curveball', () => {
    for (let day = 0; day < dailyCycleDays; day++) {
      const [first, ...rest] = dailyCards(day);
      // Easy: no kids, and housing is the biggest line.
      expect(first!.kids, first!.id).toEqual([]);
      expect(curveball(costOf(first!)), first!.id).toBeNull();
      for (const card of rest) {
        const twist = curveball(costOf(card));
        if (cardSlot(card.id) === 5) expect(twist, `${card.id} should be a curveball`).not.toBeNull();
        else expect(twist, `${card.id} should be housing-led`).toBeNull();
      }
    }
  });

  it('spread the daily curveballs over different twists', () => {
    const twists = new Set<CostCategory>();
    for (let day = 0; day < dailyCycleDays; day++) twists.add(curveball(costOf(dailyCards(day)[4]!))!);
    expect([...twists].sort()).toEqual(['car', 'childcare', 'eatingOut']);
  });
});
