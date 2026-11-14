// The life-card catalog (T10): 50 daily cards + 2 creator packs of 5, hand-written in
// cards/cards.json. Costs are never stored on a card: the engine's costOfLife computes them from
// the card and its area's real data (./areas), so "cards load with real costs".
//
// SERVER ONLY: a LifeCard holds the answer. Import this module from API routes, scripts and tests,
// never from browser code (an ESLint rule in eslint.config.mjs enforces that for apps/web).
//
// Day shape (docs/PRODUCT.md → Game design): each card has a `slot` 1–5, its position in a day's
// set, from 1 = easy to 5 = curveball (e.g. childcare costs more than rent). Daily cards are kept
// in one pool per slot; day d takes the (d mod pool size)-th card of each pool, so every day is
// easy → curveball and the pools cycle every `dailyCycleDays` days. Pack cards have their own
// order (slot 1–5 within the pack) and never appear in the daily rotation.
//
// Validated when this module loads; it throws on a schema error, a duplicate id, a card whose ZIP
// is missing from areas.json (or whose metro differs from its area's), a card with kids in an area
// without childcare data, or incomplete slots.
import { LifeCardSchema, type LifeCard } from '@lifeguessr/types';
import { z } from 'zod';
import { findArea } from './areas';
import cardsJson from './cards/cards.json';

/** Cards in a day's set (and in a pack). */
export const DAY_SLOTS = 5;

export type Slot = 1 | 2 | 3 | 4 | 5;

export const CatalogCardSchema = LifeCardSchema.extend({
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});
export type CatalogCard = z.infer<typeof CatalogCardSchema>;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

type Catalog = {
  cards: LifeCard[];
  slots: Map<string, Slot>;
  dailyPools: LifeCard[][];          // index = slot − 1, in file order
  packs: Map<string, LifeCard[]>;    // pack id → cards in slot order
};

/** Validate the raw catalog against the contract and the area data. Throws on the first problem. */
export function parseCatalog(raw: unknown, area: (zip: string) => { metro: string; childcareMonthly?: unknown } | null = findArea): Catalog {
  const entries = CatalogCardSchema.array().min(1).parse(raw);
  const cards: LifeCard[] = [];
  const slots = new Map<string, Slot>();
  const dailyPools: LifeCard[][] = Array.from({ length: DAY_SLOTS }, () => []);
  const packSlots = new Map<string, Map<Slot, LifeCard>>();

  for (const { slot, ...fields } of entries) {
    const card = LifeCardSchema.parse(fields);
    if (slots.has(card.id)) throw new Error(`cards.json: duplicate card id ${card.id}`);
    const a = area(card.zip);
    if (!a) throw new Error(`Card ${card.id}: ZIP ${card.zip} is missing from packages/data/out/areas.json`);
    if (a.metro !== card.metro) {
      throw new Error(`Card ${card.id}: metro "${card.metro}" differs from its area's "${a.metro}" (ZIP ${card.zip})`);
    }
    if (card.kids.length > 0 && !a.childcareMonthly) {
      throw new Error(`Card ${card.id}: has kids but ZIP ${card.zip} has no childcare data`);
    }
    cards.push(card);
    slots.set(card.id, slot);
    if (card.pack === undefined) {
      dailyPools[slot - 1]!.push(card);
    } else {
      const pack = packSlots.get(card.pack) ?? new Map<Slot, LifeCard>();
      if (pack.has(slot)) throw new Error(`Pack ${card.pack}: two cards in slot ${slot}`);
      pack.set(slot, card);
      packSlots.set(card.pack, pack);
    }
  }

  const poolSize = dailyPools[0]!.length;
  if (poolSize === 0 || dailyPools.some((p) => p.length !== poolSize)) {
    throw new Error(`cards.json: every daily slot needs the same number of cards, got ${dailyPools.map((p) => p.length).join('/')}`);
  }
  const packs = new Map<string, LifeCard[]>();
  for (const [id, bySlot] of packSlots) {
    if (bySlot.size !== DAY_SLOTS) throw new Error(`Pack ${id}: needs slots 1–${DAY_SLOTS}, has ${[...bySlot.keys()].join(', ')}`);
    packs.set(id, ([1, 2, 3, 4, 5] as const).map((s) => bySlot.get(s)!));
  }
  return { cards, slots, dailyPools, packs };
}

const catalog = deepFreeze(parseCatalog(cardsJson));

/** Every life card (daily + packs), as plain LifeCards. */
export const lifeCards: readonly LifeCard[] = catalog.cards;

/** Days before the daily sets repeat (cards per daily slot). */
export const dailyCycleDays: number = catalog.dailyPools[0]!.length;

/** Creator pack ids, in catalog order. */
export const packIds: readonly string[] = [...catalog.packs.keys()];

/** A card's slot: its position in a day's set (1 easy … 5 curveball) or in its pack. */
export function cardSlot(id: string): Slot {
  const slot = catalog.slots.get(id);
  if (slot === undefined) throw new Error(`No life card with id ${id}`);
  return slot;
}

/** A life card by id, or null. */
export function findCard(id: string): LifeCard | null {
  return catalog.cards.find((c) => c.id === id) ?? null;
}

/**
 * The day's 5 cards in play order (easy → curveball). `day` is any integer day counter, e.g.
 * whole days since 1970-01-01 of the US Eastern calendar date (apps/web/src/lib/dates dayNumber).
 */
export function dailyCards(day: number): LifeCard[] {
  if (!Number.isInteger(day)) throw new Error(`dailyCards: day must be an integer, got ${day}`);
  const i = ((day % dailyCycleDays) + dailyCycleDays) % dailyCycleDays;
  return catalog.dailyPools.map((pool) => pool[i]!);
}

/** A creator pack's 5 cards in order; throws for an unknown pack. */
export function packCards(pack: string): LifeCard[] {
  const cards = catalog.packs.get(pack);
  if (!cards) throw new Error(`No creator pack ${pack}`);
  return [...cards];
}
