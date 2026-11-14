// The sample life cards: kept out of the fixtures barrel (./index) on purpose.
//
// In fixture mode (NEXT_PUBLIC_GAME_SOURCE=fixtures, the default) these cards ARE the daily game's
// answers, computed in the browser. Every page imports the barrel (the store seeds the demo
// profile from it), so if the cards lived there they would ship in every browser chunk, including
// an API-mode build where the server holds the answers. Import them from
// '@lifeguessr/data/fixtures/cards' only where they are meant to be (an ESLint rule in
// eslint.config.mjs lists the browser modules that may).
import { LifeCardSchema, type LifeCard } from '@lifeguessr/types';
import cardsJson from './cards.sample.json';
import duelCardsJson from './cards.duel.sample.json';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/** Sample life cards spanning cheap → expensive. They hold the answer: see the note above. */
export const cardsSample: readonly LifeCard[] = deepFreeze(LifeCardSchema.array().parse(cardsJson));

/** A fixture life card by id; throws if it does not exist. */
export function cardById(id: string): LifeCard {
  const card = cardsSample.find((c) => c.id === id);
  if (!card) throw new Error(`No fixture LifeCard with id ${id}`);
  return card;
}

/**
 * Fixture cards for the duel: one real life card per metro (15 metros), copied from
 * packages/data/cards/cards.json so fixture duels pair lives across cities. Each card's ZIP is in
 * packages/data/out/areas.json, which the browser already uses for area lookups.
 */
export const duelCardsSample: readonly LifeCard[] = deepFreeze(LifeCardSchema.array().parse(duelCardsJson));
