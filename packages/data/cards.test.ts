import { describe, expect, it } from 'vitest';
import { LifeCardSchema } from '@lifeguessr/types';
import { getArea } from './areas';
import {
  DAY_SLOTS, cardSlot, dailyCards, dailyCycleDays, findCard, lifeCards, packCards, packIds, parseCatalog,
} from './cards';
import cardsJson from './cards/cards.json';

const daily = lifeCards.filter((c) => c.pack === undefined);

describe('life-card catalog (T10)', () => {
  it('has 50 daily cards and 2 creator packs of 5', () => {
    expect(daily).toHaveLength(50);
    expect(packIds).toEqual(['nyc-25', 'city-swap']);
    for (const p of packIds) expect(packCards(p)).toHaveLength(DAY_SLOTS);
    expect(lifeCards).toHaveLength(60);
    expect(new Set(lifeCards.map((c) => c.id)).size).toBe(60);
  });

  it('validates every card against the LifeCard contract and strips catalog-only fields', () => {
    for (const c of lifeCards) {
      expect(LifeCardSchema.parse(c)).toEqual(c);
      expect(c).not.toHaveProperty('slot');
    }
  });

  it('puts every card in an area we have data for, in the same metro', () => {
    for (const c of lifeCards) {
      const area = getArea(c.zip);
      expect(c.metro, c.id).toBe(area.metro);
      if (c.kids.length > 0) expect(area.childcareMonthly, c.id).toBeDefined();
    }
    // The daily cards cover every metro and every tier.
    expect(new Set(daily.map((c) => c.metro)).size).toBe(15);
    expect(new Set(daily.map((c) => getArea(c.zip).tier)).size).toBe(4);
  });

  it('has captions with no cost facts (no numbers, prices or percentages)', () => {
    for (const c of lifeCards) {
      expect(c.caption, c.id).not.toMatch(/[\d$%]/);
      expect(c.caption, c.id).not.toMatch(/\b(rent|mortgage|salary|paycheck|daycare|loan|debt|cheap|expensive|pricey)\b/i);
      expect(c.caption.length, c.id).toBeLessThanOrEqual(90);
    }
    expect(new Set(lifeCards.map((c) => c.caption)).size).toBe(lifeCards.length);
  });

  it('builds each day easy → curveball from 5 different metros, cycling through all 50 cards', () => {
    expect(dailyCycleDays).toBe(10);
    const seen = new Set<string>();
    for (let day = 0; day < dailyCycleDays; day++) {
      const set = dailyCards(day);
      expect(set.map((c) => cardSlot(c.id))).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(set.map((c) => c.metro)).size, `day ${day}`).toBe(DAY_SLOTS);
      for (const c of set) seen.add(c.id);
    }
    expect(seen.size).toBe(50);
    // Deterministic, cyclic, and defined for any integer day (e.g. dayNumber of a US Eastern date).
    expect(dailyCards(20_406)).toEqual(dailyCards(20_406 + dailyCycleDays));
    expect(dailyCards(-1)).toEqual(dailyCards(dailyCycleDays - 1));
    expect(() => dailyCards(1.5)).toThrow();
  });

  it('orders packs and keeps them out of the daily rotation', () => {
    expect(packCards('nyc-25').map((c) => c.id)).toEqual(['nyc25-1', 'nyc25-2', 'nyc25-3', 'nyc25-4', 'nyc25-5']);
    for (const c of packCards('nyc-25')) expect(c.metro).toBe('New York, NY');
    // "Your city vs mine": one household, five metros.
    const swap = packCards('city-swap');
    expect(new Set(swap.map((c) => c.metro)).size).toBe(5);
    const household = ({ adults, kids, bedrooms, car, eatingOutPerWeek }: (typeof swap)[number]) =>
      ({ adults, kids, bedrooms, car, eatingOutPerWeek });
    for (const c of swap) expect(household(c)).toEqual(household(swap[0]!));
    for (let day = 0; day < dailyCycleDays; day++) {
      for (const c of dailyCards(day)) expect(c.pack).toBeUndefined();
    }
    expect(() => packCards('nope')).toThrow();
  });

  it('finds cards by id', () => {
    expect(findCard('lc-001')?.zip).toBe('75206');
    expect(findCard('nope')).toBeNull();
    expect(() => cardSlot('nope')).toThrow();
  });

  describe('fails loudly on a bad catalog', () => {
    const raw = structuredClone(cardsJson) as Record<string, unknown>[];
    const withCard = (i: number, patch: Record<string, unknown>) => raw.map((c, j) => (j === i ? { ...c, ...patch } : c));

    it('a card whose ZIP is missing from areas', () => {
      expect(() => parseCatalog(withCard(0, { zip: '99999' }))).toThrow(/ZIP 99999 is missing from .*areas\.json/);
    });
    it('a card whose metro is not its area\'s', () => {
      expect(() => parseCatalog(withCard(0, { metro: 'Austin, TX' }))).toThrow(/metro/);
    });
    it('a duplicate id', () => {
      expect(() => parseCatalog(withCard(1, { id: raw[0]!.id }))).toThrow(/duplicate/);
    });
    it('incomplete daily slots or packs', () => {
      expect(() => parseCatalog(withCard(0, { slot: 2 }))).toThrow(/same number/);
      const packIndex = raw.findIndex((c) => c.pack === 'nyc-25');
      expect(() => parseCatalog(withCard(packIndex, { slot: 2 }))).toThrow(/Pack nyc-25/);
    });
    it('a card that breaks the contract', () => {
      expect(() => parseCatalog(withCard(0, { bedrooms: 7 }))).toThrow();
      expect(() => parseCatalog(withCard(0, { slot: 6 }))).toThrow();
    });
    it('a card with kids in an area without childcare data', () => {
      const noChildcare = (zip: string) => ({ metro: getArea(zip).metro });
      expect(() => parseCatalog(raw, noChildcare)).toThrow(/childcare/);
    });
  });
});
