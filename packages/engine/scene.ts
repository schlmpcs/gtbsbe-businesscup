// STUB until T12 (Aibek) — replace with the real implementation + tests
// Deterministic scene from a life card: layout from bedrooms, no decor yet, one ClueReveal per
// ClueId carrying the matching card facts. Sprite ids are placeholders until the list is agreed
// with the designer (Hour 0) and the kit lands in apps/web/public/scene/.
// Spec: docs/ENGINEERING.md → House scene.
import {
  CLUE_IDS,
  type AreaData, type ClueId, type ClueReveal, type KidAge, type LifeCard, type Money,
  type PublicCard, type SceneLayout, type SceneProp,
} from '@lifeguessr/types';

/** Car price bands for the garage clue (car price in dollars). */
export const CAR_PRICE_BANDS = { economyBelow: 25_000 as Money, luxuryAbove: 45_000 as Money } as const;

/** Takeout piles in the kitchen, by meals eaten out per week (inclusive upper bounds). */
export const TAKEOUT_BUCKETS = [
  { id: '0-1', maxPerWeek: 1 },
  { id: '2-3', maxPerWeek: 3 },
  { id: '4-6', maxPerWeek: 6 },
  { id: '7plus', maxPerWeek: Number.POSITIVE_INFINITY },
] as const;

const LAYOUTS: Record<LifeCard['bedrooms'], SceneLayout> = {
  0: 'studio', 1: '1bed', 2: '2bed', 3: '3bed', 4: '4bed',
};

const KID_SPRITES: Record<KidAge, string> = {
  infant: 'kidsRoom/crib',
  toddler: 'kidsRoom/toddler',
  preschool: 'kidsRoom/preschool',
  schoolAge: 'kidsRoom/schoolAge',
};

/** Placeholder sprite ids (to be agreed with the designer). Files: public/scene/<id>.svg */
export const SPRITE_IDS = [
  ...Object.values(LAYOUTS).map((l) => `layout/${l}`),
  'garage/none', 'garage/economy', 'garage/mid', 'garage/luxury', 'garage/loanTag',
  ...Object.values(KID_SPRITES), 'kidsRoom/homeOffice',
  ...TAKEOUT_BUCKETS.map((b) => `kitchen/takeout-${b.id}`),
  'entry/coat-adult', 'entry/coat-kid',
  'mailbox/tier-cheap', 'mailbox/tier-mid', 'mailbox/tier-expensive', 'mailbox/tier-suburb',
] as const;

function carSprite(price: Money): string {
  if (price < CAR_PRICE_BANDS.economyBelow) return 'garage/economy';
  if (price > CAR_PRICE_BANDS.luxuryAbove) return 'garage/luxury';
  return 'garage/mid';
}

function takeoutSprite(perWeek: number): string {
  const bucket = TAKEOUT_BUCKETS.find((b) => perWeek <= b.maxPerWeek) ?? TAKEOUT_BUCKETS[3];
  return `kitchen/takeout-${bucket.id}`;
}

function cluePropsAndFacts(card: LifeCard, area: AreaData, clue: ClueId): Pick<ClueReveal, 'props' | 'facts'> {
  const prop = (sprite: string): SceneProp => ({ sprite, room: clue, clue });
  switch (clue) {
    case 'garage': {
      if (!card.car) return { props: [prop('garage/none')], facts: {} };
      const props = [prop(carSprite(card.car.price))];
      if (card.car.price > card.car.downPayment) props.push(prop('garage/loanTag'));
      return { props, facts: { car: card.car } };
    }
    case 'kidsRoom':
      return {
        props: card.kids.length > 0 ? card.kids.map((k) => prop(KID_SPRITES[k])) : [prop('kidsRoom/homeOffice')],
        facts: { kids: card.kids },
      };
    case 'kitchen':
      return { props: [prop(takeoutSprite(card.eatingOutPerWeek))], facts: { eatingOutPerWeek: card.eatingOutPerWeek } };
    case 'entry':
      return {
        props: [
          ...Array.from({ length: card.adults }, () => prop('entry/coat-adult')),
          ...card.kids.map(() => prop('entry/coat-kid')),
        ],
        facts: { adults: card.adults, kids: card.kids },
      };
    case 'mailbox':
      return { props: [prop(`mailbox/tier-${area.tier}`)], facts: { zip: card.zip, tier: area.tier } };
  }
}

/** The public scene (no answers) and the reveal for each clue room. Deterministic. */
export function sceneOf(card: LifeCard, area: AreaData): { public: PublicCard; clues: Record<ClueId, ClueReveal> } {
  const clues = Object.fromEntries(
    CLUE_IDS.map((clue) => [clue, { cardId: card.id, clue, ...cluePropsAndFacts(card, area, clue) }]),
  ) as Record<ClueId, ClueReveal>;
  return {
    public: { id: card.id, metro: card.metro, layout: LAYOUTS[card.bedrooms], caption: card.caption, decor: [] },
    clues,
  };
}
