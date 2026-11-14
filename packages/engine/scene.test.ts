/// <reference types="node" />
// T12: sceneOf. Spec: docs/ENGINEERING.md → House scene.
//
// The consistency test is the point of this file: for every card (the fixtures, plus the full deck
// from @lifeguessr/data when it is present) each clue room's props are turned back into the cost
// lines they stand for and compared with costOfLife, so the picture cannot contradict the numbers.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { areaByZip, areaDataSample, cardsSample } from '@lifeguessr/data/fixtures';
import {
  CLUE_IDS, COST_CATEGORIES,
  type AreaData, type ClueId, type CostCategory, type KidAge, type LifeCard, type SceneProp,
} from '@lifeguessr/types';
import { avgMealPrice, kidGroceryFactor, lifeCardLoanSource, weeksPerMonth } from './assumptions';
import { costOfLife } from './cost';
import { amortizedPayment } from './loan/index';
import {
  CAR_PRICE_BANDS, CLUE_COST_CATEGORIES, DECOR_ROOMS, DECOR_SPRITE_IDS, KID_SPRITES, LAYOUT_BEDROOMS,
  LAYOUT_COST_CATEGORY, SPRITE_IDS, TAKEOUT_BUCKETS, carSprite, sceneOf, takeoutSprite,
} from './scene';

// ----- the cards under test -------------------------------------------------------------------

type Pair = { card: LifeCard; area: AreaData; deck: string };

/**
 * The full deck (T10: 60 hand-written cards in packages/data/cards/, 60 areas in packages/data/out/),
 * loaded through @lifeguessr/data's own validated loaders once they are on this branch. Until then
 * only the fixtures run. The specifiers are variables so this file compiles before those modules exist.
 */
async function fullDeck(): Promise<Pair[]> {
  if (!existsSync(new URL('../data/cards/cards.json', import.meta.url))) return [];
  const cardsModule: string = '@lifeguessr/data/cards';
  const areasModule: string = '@lifeguessr/data/areas';
  const { lifeCards } = (await import(/* @vite-ignore */ cardsModule)) as { lifeCards: readonly LifeCard[] };
  const { getArea } = (await import(/* @vite-ignore */ areasModule)) as { getArea: (zip: string) => AreaData };
  return lifeCards.map((card) => ({ card, area: getArea(card.zip), deck: 'deck' }));
}

const PAIRS: Pair[] = [
  ...cardsSample.map((card) => ({ card, area: areaByZip(card.zip), deck: 'fixtures' })),
  ...(await fullDeck()),
];

// ----- helpers --------------------------------------------------------------------------------

/** Equal up to float noise (amounts are sums of products of dollars and rates). */
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const spritesOf = (props: readonly SceneProp[]) => props.map((p) => p.sprite);
const count = (xs: readonly string[], x: string) => xs.filter((y) => y === x).length;

const AGE_OF_SPRITE = new Map<string, KidAge>(
  (Object.entries(KID_SPRITES) as [KidAge, string][]).map(([age, sprite]) => [sprite, age]),
);

/** Which band a car price falls in, read back from CAR_PRICE_BANDS (not from carSprite). */
function priceInBand(price: number, sprite: string): boolean {
  switch (sprite) {
    case 'garage/economy': return price < CAR_PRICE_BANDS.economyBelow;
    case 'garage/mid': return price >= CAR_PRICE_BANDS.economyBelow && price <= CAR_PRICE_BANDS.luxuryAbove;
    case 'garage/luxury': return price > CAR_PRICE_BANDS.luxuryAbove;
    default: return false;
  }
}

/** The bucket a takeout sprite shows, read back from TAKEOUT_BUCKETS (not from takeoutSprite). */
function perWeekInBucket(perWeek: number, sprite: string): boolean {
  const i = TAKEOUT_BUCKETS.findIndex((b) => `kitchen/takeout-${b.id}` === sprite);
  if (i < 0) return false;
  const min = i === 0 ? -Infinity : TAKEOUT_BUCKETS[i - 1]!.maxPerWeek;
  return perWeek > min && perWeek <= TAKEOUT_BUCKETS[i]!.maxPerWeek;
}

// ----- tests ----------------------------------------------------------------------------------

describe('sceneOf: structure', () => {
  it.each(PAIRS.map((p) => [`${p.deck}/${p.card.id}`, p] as const))('%s', (_name, { card, area }) => {
    const scene = sceneOf(card, area);
    expect(sceneOf(card, area), 'deterministic').toEqual(scene);

    // The public card holds no answer.
    expect(Object.keys(scene.public).sort()).toEqual(['caption', 'decor', 'id', 'layout', 'metro']);
    expect(scene.public).toMatchObject({ id: card.id, metro: card.metro, caption: card.caption });
    expect(LAYOUT_BEDROOMS[scene.public.layout]).toBe(card.bedrooms);

    // One reveal per clue; every prop belongs to its clue's room and has a sprite file id.
    expect(Object.keys(scene.clues).sort()).toEqual([...CLUE_IDS].sort());
    for (const clue of CLUE_IDS) {
      const reveal = scene.clues[clue];
      expect(reveal.clue).toBe(clue);
      expect(reveal.cardId).toBe(card.id);
      expect(reveal.props.length, clue).toBeGreaterThan(0);
      for (const prop of reveal.props) {
        expect(prop).toEqual({ sprite: prop.sprite, room: clue, clue });
        expect(SPRITE_IDS).toContain(prop.sprite);
      }
    }
  });
});

describe('sceneOf: every clue maps to the cost lines it stands for (consistency)', () => {
  it('each clue names real cost categories, and every cost category is covered by a clue or the layout', () => {
    const covered = new Set<CostCategory>([LAYOUT_COST_CATEGORY, ...Object.values(CLUE_COST_CATEGORIES).flat()]);
    for (const clue of CLUE_IDS) {
      expect(CLUE_COST_CATEGORIES[clue].length, clue).toBeGreaterThan(0);
      for (const c of CLUE_COST_CATEGORIES[clue]) expect(COST_CATEGORIES).toContain(c);
    }
    for (const { card, area } of PAIRS) {
      for (const item of costOfLife(card, area).items) {
        expect(covered.has(item.category), `${card.id}: ${item.category} has no clue`).toBe(true);
      }
    }
  });

  it.each(PAIRS.map((p) => [`${p.deck}/${p.card.id}`, p] as const))('%s', (_name, { card, area }) => {
    const scene = sceneOf(card, area);
    const cost = costOfLife(card, area);
    const lines = (category: CostCategory) => cost.items.filter((i) => i.category === category);
    const total = (category: CostCategory) => lines(category).reduce((s, i) => s + i.amount, 0);
    const sprites = (clue: ClueId) => spritesOf(scene.clues[clue].props);

    // Each clue's facts are what its props were drawn from.
    // garage → car: no car sprite ⇔ no car lines; band ⇔ price; loan tag ⇔ a loan payment line.
    const garage = sprites('garage');
    const band = garage.filter((s) => s !== 'garage/loanTag');
    expect(band, 'exactly one car (or no-car) sprite').toHaveLength(1);
    const car = scene.clues.garage.facts.car;
    if (band[0] === 'garage/none') {
      expect(garage).toEqual(['garage/none']);
      expect(car).toBeUndefined();
      expect(lines('car')).toEqual([]);
    } else {
      expect(car).toEqual(card.car);
      expect(lines('car').length).toBeGreaterThan(0);
      expect(priceInBand(car!.price, band[0]!), `${car!.price} in ${band[0]}`).toBe(true);
      const loanLines = lines('car').filter((l) => l.source.name === lifeCardLoanSource.name);
      expect(garage.includes('garage/loanTag'), 'loan tag ⇔ loan payment line').toBe(loanLines.length === 1);
      if (loanLines.length === 1) {
        expect(close(loanLines[0]!.amount, amortizedPayment(car!.price - car!.downPayment, car!.apr, car!.termMonths))).toBe(true);
      }
    }

    // kidsRoom → childcare (+ kids' groceries): childcare = Σ the area's price for each kid prop's age.
    const kidsRoom = sprites('kidsRoom');
    const kidAges = kidsRoom.filter((s) => s !== 'kidsRoom/homeOffice').map((s) => AGE_OF_SPRITE.get(s));
    expect(kidAges.every((a) => a !== undefined), `unknown kid sprite in ${kidsRoom.join(', ')}`).toBe(true);
    if (kidsRoom.includes('kidsRoom/homeOffice')) {
      expect(kidsRoom, 'home office only when there are no kids').toEqual(['kidsRoom/homeOffice']);
      expect(lines('childcare')).toEqual([]);
    } else {
      expect(kidAges).toEqual(card.kids);
      const expected = kidAges.reduce((s, age) => s + area.childcareMonthly![age!], 0);
      expect(close(total('childcare'), expected), 'childcare = Σ kid props').toBe(true);
    }

    // entry → groceries: one coat per adult and per kid; groceries = per adult × (adults + factor × kids).
    const entry = sprites('entry');
    expect(entry.length).toBe(count(entry, 'entry/coat-adult') + count(entry, 'entry/coat-kid'));
    const adultCoats = count(entry, 'entry/coat-adult');
    const kidCoats = count(entry, 'entry/coat-kid');
    expect(kidCoats, 'kid coats = kid props in the kids’ room').toBe(kidAges.length);
    const groceries = area.groceriesPerAdult.value * (adultCoats + kidGroceryFactor.value * kidCoats);
    expect(close(total('groceries'), groceries), 'groceries = coats').toBe(true);

    // kitchen → eatingOut: the takeout pile is the bucket of the meals the eating-out line prices.
    const kitchen = sprites('kitchen');
    expect(kitchen).toHaveLength(1);
    const impliedPerWeek = Math.round((total('eatingOut') / (weeksPerMonth.value * avgMealPrice.value)) * 1e6) / 1e6;
    expect(impliedPerWeek).toBe(card.eatingOutPerWeek);
    expect(perWeekInBucket(impliedPerWeek, kitchen[0]!), `${impliedPerWeek}/week in ${kitchen[0]}`).toBe(true);

    // mailbox + layout → rentUtilities: the tier sign is the area's; the rent is for the layout's bedrooms.
    expect(sprites('mailbox')).toEqual([`mailbox/tier-${area.tier}`]);
    expect(scene.clues.mailbox.facts).toEqual({ zip: card.zip, tier: area.tier });
    expect(close(total('rentUtilities'), area.rentByBedrooms[LAYOUT_BEDROOMS[scene.public.layout]].value)).toBe(true);
  });
});

describe('sceneOf: decor never suggests a cost', () => {
  it('is neutral decor in decor rooms, one bed per bedroom, and depends only on the layout', () => {
    const decorByLayout = new Map<string, SceneProp[]>();
    for (const { card, area } of PAIRS) {
      const { layout, decor } = sceneOf(card, area).public;
      for (const prop of decor) {
        expect(prop.clue, 'decor has no clue').toBeUndefined();
        expect(DECOR_SPRITE_IDS).toContain(prop.sprite);
        expect(DECOR_ROOMS).toContain(prop.room);
      }
      const bedrooms = decor.filter((p) => p.room.startsWith('bedroom'));
      expect(bedrooms.map((p) => p.sprite)).toEqual(Array(LAYOUT_BEDROOMS[layout]).fill('decor/bed'));
      const seen = decorByLayout.get(layout);
      if (seen) expect(decor, `${card.id}: same decor as every other ${layout}`).toEqual(seen);
      else decorByLayout.set(layout, decor);
    }
  });

  it('does not change with the hidden fields (car, kids, eating out, household, tier)', () => {
    const card = cardsSample.find((c) => c.car && c.kids.length > 0)!;
    const area = areaByZip(card.zip);
    const base = sceneOf(card, area).public;
    const variants: LifeCard[] = [
      { ...card, car: undefined },
      { ...card, car: { ...card.car!, price: 120_000 } },
      { ...card, kids: [] },
      { ...card, kids: ['infant', 'infant', 'schoolAge'] },
      { ...card, eatingOutPerWeek: 14 },
      { ...card, adults: card.adults === 1 ? 2 : 1 },
    ];
    for (const v of variants) expect(sceneOf(v, area).public).toEqual(base);
    for (const tier of ['cheap', 'mid', 'expensive', 'suburb'] as const) {
      expect(sceneOf(card, { ...area, tier }).public).toEqual(base);
    }
  });
});

describe('sceneOf: bands and buckets', () => {
  it('car price bands: economy below $25k, mid $25k–$45k inclusive, luxury above $45k', () => {
    expect(carSprite(24_999.99)).toBe('garage/economy');
    expect(carSprite(25_000)).toBe('garage/mid');
    expect(carSprite(45_000)).toBe('garage/mid');
    expect(carSprite(45_000.01)).toBe('garage/luxury');
  });

  it('takeout buckets: 0–1, 2–3, 4–6, 7+ per week', () => {
    expect([0, 1, 1.5, 2, 3, 3.5, 4, 6, 6.5, 7, 21].map(takeoutSprite)).toEqual([
      'kitchen/takeout-0-1', 'kitchen/takeout-0-1', 'kitchen/takeout-2-3', 'kitchen/takeout-2-3',
      'kitchen/takeout-2-3', 'kitchen/takeout-4-6', 'kitchen/takeout-4-6', 'kitchen/takeout-4-6',
      'kitchen/takeout-7plus', 'kitchen/takeout-7plus', 'kitchen/takeout-7plus',
    ]);
  });

  it('a car with nothing financed has no loan tag; no kids is a home office', () => {
    const card = cardsSample.find((c) => c.car)!;
    const area = areaByZip(card.zip);
    const cash = sceneOf({ ...card, car: { ...card.car!, downPayment: card.car!.price } }, area);
    expect(spritesOf(cash.clues.garage.props)).toEqual([carSprite(card.car!.price)]);
    const noKids = sceneOf({ ...card, kids: [] }, area);
    expect(spritesOf(noKids.clues.kidsRoom.props)).toEqual(['kidsRoom/homeOffice']);
    expect(spritesOf(noKids.clues.entry.props)).not.toContain('entry/coat-kid');
  });

  it('sprite ids are unique, and decor ids are a separate set from clue props', () => {
    expect(new Set(SPRITE_IDS).size).toBe(SPRITE_IDS.length);
    expect(SPRITE_IDS.filter((s) => s.startsWith('decor/'))).toEqual([...DECOR_SPRITE_IDS]);
  });
});

describe('sceneOf: inputs', () => {
  it('refuses an area from another ZIP', () => {
    const card = cardsSample[0]!;
    const other = areaDataSample.find((a) => a.zip !== card.zip)!;
    expect(() => sceneOf(card, other)).toThrow(/ZIP/);
  });

  it('does not return references into the card (the reveal can be stored and edited safely)', () => {
    const card = cardsSample.find((c) => c.car && c.kids.length > 0)!;
    const scene = sceneOf(card, areaByZip(card.zip));
    expect(scene.clues.garage.facts.car).not.toBe(card.car);
    expect(scene.clues.kidsRoom.facts.kids).not.toBe(card.kids);
  });
});

describe('sceneOf: snapshot of every fixture card', () => {
  it.each(cardsSample.map((c) => [c.id, c] as const))('%s', (_id, card) => {
    expect(sceneOf(card, areaByZip(card.zip))).toMatchSnapshot();
  });
});
