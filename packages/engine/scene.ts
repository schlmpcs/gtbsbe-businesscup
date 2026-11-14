// T12: the house scene of a life card. Spec: docs/ENGINEERING.md → House scene.
//
// `sceneOf` is the only place scene content comes from, so the picture can never contradict the
// numbers: every prop is derived from the same LifeCard / AreaData field that drives a cost line in
// `costOfLife` (CLUE_COST_CATEGORIES), and decor depends only on the public layout. scene.test.ts
// proves it for every card: each clue's props are recomputed into the cost lines they stand for.
//
// Sprite ids are stable: the browser loads `apps/web/public/scene/<id>.svg`, and the designer's
// final kit (D1) replaces the placeholder files one-for-one by id (apps/web/public/scene/README.md).
import {
  CLUE_IDS,
  type AreaData, type ClueId, type ClueReveal, type CostCategory, type KidAge, type LifeCard, type Money,
  type PublicCard, type SceneLayout, type SceneProp,
} from '@lifeguessr/types';

/**
 * Car price bands for the garage clue, in dollars: economy below $25k, luxury above $45k, mid in
 * between (both edges inclusive, so a $25,000 or $45,000 car is mid).
 */
export const CAR_PRICE_BANDS = { economyBelow: 25_000 as Money, luxuryAbove: 45_000 as Money } as const;

/** Takeout piles in the kitchen, by meals eaten out per week (inclusive upper bounds, ascending). */
export const TAKEOUT_BUCKETS = [
  { id: '0-1', maxPerWeek: 1 },
  { id: '2-3', maxPerWeek: 3 },
  { id: '4-6', maxPerWeek: 6 },
  { id: '7plus', maxPerWeek: Number.POSITIVE_INFINITY },
] as const;

/**
 * The cost lines each clue room stands for (costOfLife categories). The always-visible layout
 * stands for rentUtilities (LAYOUT_COST_CATEGORY). The consistency test checks both directions:
 * every clue maps to these lines, and every cost line of a card is covered by a clue or the layout.
 */
export const CLUE_COST_CATEGORIES = {
  garage: ['car'],
  kidsRoom: ['childcare', 'groceries'],
  kitchen: ['eatingOut'],
  entry: ['groceries'],
  mailbox: ['rentUtilities'],
} as const satisfies Record<ClueId, readonly CostCategory[]>;

/** The cost line the always-visible layout (number of bedrooms) stands for. */
export const LAYOUT_COST_CATEGORY = 'rentUtilities' as const satisfies CostCategory;

/** Scene layout by number of bedrooms (the card's `bedrooms`, which prices the rent line). */
export const LAYOUTS = {
  0: 'studio', 1: '1bed', 2: '2bed', 3: '3bed', 4: '4bed',
} as const satisfies Record<LifeCard['bedrooms'], SceneLayout>;

/** Number of bedrooms a layout shows (the inverse of LAYOUTS). */
export const LAYOUT_BEDROOMS = {
  studio: 0, '1bed': 1, '2bed': 2, '3bed': 3, '4bed': 4,
} as const satisfies Record<SceneLayout, LifeCard['bedrooms']>;

/** One prop per child in the kids' room, by age (each age has its own childcare price). */
export const KID_SPRITES = {
  infant: 'kidsRoom/crib',
  toddler: 'kidsRoom/toddler',
  preschool: 'kidsRoom/preschool',
  schoolAge: 'kidsRoom/schoolAge',
} as const satisfies Record<KidAge, string>;

/**
 * Decor sprites: always visible, carry no `clue`, and never suggest a cost. They depend only on the
 * public layout (never on the car, kids, eating out, household, ZIP or tier), so a cheap home and an
 * expensive home with the same layout look the same until a room is opened.
 */
export const DECOR_SPRITE_IDS = [
  'decor/skyline', 'decor/lamp', 'decor/plant', 'decor/bed', 'decor/bookshelf', 'decor/tree',
] as const;

/**
 * Rooms that hold decor only (no clue). `bedroom1`…`bedroom4`: one per bedroom; a studio has none
 * and a sleeping `loft` instead, with the bed in the living room. The scene component places decor
 * by these ids (apps/web/public/scene/README.md → Room geometry).
 */
export const DECOR_ROOMS = ['living', 'yard', 'loft', 'bedroom1', 'bedroom2', 'bedroom3', 'bedroom4'] as const;
export type DecorRoom = (typeof DECOR_ROOMS)[number];

/** Every sprite id a scene can use. Files: apps/web/public/scene/<id>.svg. */
export const SPRITE_IDS = [
  ...Object.values(LAYOUTS).map((l) => `layout/${l}` as const),
  'garage/none', 'garage/economy', 'garage/mid', 'garage/luxury', 'garage/loanTag',
  ...Object.values(KID_SPRITES), 'kidsRoom/homeOffice',
  ...TAKEOUT_BUCKETS.map((b) => `kitchen/takeout-${b.id}` as const),
  'entry/coat-adult', 'entry/coat-kid',
  'mailbox/tier-cheap', 'mailbox/tier-mid', 'mailbox/tier-expensive', 'mailbox/tier-suburb',
  ...DECOR_SPRITE_IDS,
] as const;
export type SpriteId = (typeof SPRITE_IDS)[number];

/** The car band sprite for a car price (CAR_PRICE_BANDS). */
export function carSprite(price: Money): 'garage/economy' | 'garage/mid' | 'garage/luxury' {
  if (price < CAR_PRICE_BANDS.economyBelow) return 'garage/economy';
  if (price > CAR_PRICE_BANDS.luxuryAbove) return 'garage/luxury';
  return 'garage/mid';
}

/** The takeout pile sprite for meals eaten out per week (TAKEOUT_BUCKETS). */
export function takeoutSprite(perWeek: number): `kitchen/takeout-${(typeof TAKEOUT_BUCKETS)[number]['id']}` {
  const bucket = TAKEOUT_BUCKETS.find((b) => perWeek <= b.maxPerWeek) ?? TAKEOUT_BUCKETS[TAKEOUT_BUCKETS.length - 1]!;
  return `kitchen/takeout-${bucket.id}`;
}

/** Decor of a layout (see DECOR_SPRITE_IDS): the same for every card with that layout. */
function decorOf(layout: SceneLayout): SceneProp[] {
  const at = (room: DecorRoom, ...sprites: (typeof DECOR_SPRITE_IDS)[number][]): SceneProp[] =>
    sprites.map((sprite) => ({ sprite, room }));
  const bedrooms = LAYOUT_BEDROOMS[layout];
  return [
    // The skyline in the living-room window stands for the metro, which is public anyway.
    ...(bedrooms === 0
      ? [...at('living', 'decor/skyline', 'decor/bed', 'decor/lamp'), ...at('loft', 'decor/bookshelf', 'decor/plant')]
      : at('living', 'decor/skyline', 'decor/lamp', 'decor/plant')),
    ...Array.from({ length: bedrooms }, (_, i) => at(`bedroom${i + 1}` as DecorRoom, 'decor/bed')).flat(),
    ...at('yard', 'decor/tree'),
  ];
}

function cluePropsAndFacts(card: LifeCard, area: AreaData, clue: ClueId): Pick<ClueReveal, 'props' | 'facts'> {
  const prop = (sprite: SpriteId): SceneProp => ({ sprite, room: clue, clue });
  switch (clue) {
    case 'garage': {
      // No car: a bike and a bus pass, and no car line in the cost.
      if (!card.car) return { props: [prop('garage/none')], facts: {} };
      const props = [prop(carSprite(card.car.price))];
      // Financed (price above the down payment) ⇔ the cost has a car loan payment line.
      if (card.car.price > card.car.downPayment) props.push(prop('garage/loanTag'));
      return { props, facts: { car: { ...card.car } } };
    }
    case 'kidsRoom':
      // One prop per child, by age (childcare and kids' groceries); no kids: a home office.
      return {
        props: card.kids.length > 0 ? card.kids.map((k) => prop(KID_SPRITES[k])) : [prop('kidsRoom/homeOffice')],
        facts: { kids: [...card.kids] },
      };
    case 'kitchen':
      return { props: [prop(takeoutSprite(card.eatingOutPerWeek))], facts: { eatingOutPerWeek: card.eatingOutPerWeek } };
    case 'entry':
      // A coat per person: who eats (groceries per adult, a share of that per kid).
      return {
        props: [
          ...Array.from({ length: card.adults }, () => prop('entry/coat-adult')),
          ...card.kids.map(() => prop('entry/coat-kid')),
        ],
        facts: { adults: card.adults, kids: [...card.kids] },
      };
    case 'mailbox':
      // ZIP + neighborhood tier sign: where the rent comes from.
      return { props: [prop(`mailbox/tier-${area.tier}`)], facts: { zip: card.zip, tier: area.tier } };
  }
}

/**
 * The public scene (no answers: layout, decor, metro, caption) and the reveal for each clue room.
 * Deterministic: the same card and area always give the same scene. Throws when `area` is not the
 * card's ZIP, since the mailbox tier and the rent would then describe another place.
 */
export function sceneOf(card: LifeCard, area: AreaData): { public: PublicCard; clues: Record<ClueId, ClueReveal> } {
  if (area.zip !== card.zip) {
    throw new Error(`sceneOf: card ${card.id} is in ZIP ${card.zip}, but the AreaData is for ZIP ${area.zip}`);
  }
  const layout = LAYOUTS[card.bedrooms];
  const clues = Object.fromEntries(
    CLUE_IDS.map((clue) => [clue, { cardId: card.id, clue, ...cluePropsAndFacts(card, area, clue) }]),
  ) as Record<ClueId, ClueReveal>;
  return {
    public: { id: card.id, metro: card.metro, layout, caption: card.caption, decor: decorOf(layout) },
    clues,
  };
}
