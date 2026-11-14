// The fixture duel's cards: kept out of ./cards and the fixtures barrel on purpose.
//
// With NEXT_PUBLIC_DUEL_SOURCE=fixtures (the default) these cards ARE the duel's answers, computed
// in the browser by the fixture duel client. With NEXT_PUBLIC_DUEL_SOURCE=api the server holds the
// answers, so no browser chunk may carry these cards: only the fixture duel client imports this
// module (an ESLint rule in eslint.config.mjs holds that), and a duel API build drops that client
// (scripts/check-client-bundle.mjs checks the built chunks for every id below). In ./cards they
// shipped with every page that shows the sample lives (S6 Closest life, the ladder, /kit), because
// a module's top-level parse is kept whenever any of its exports is used.
import { LifeCardSchema, type LifeCard } from '@lifeguessr/types';
import duelCardsJson from './cards.duel.sample.json';
import { deepFreeze } from './deepFreeze';

/**
 * Made-up cards for the fixture duel: one per metro (15 metros), so a fixture round pairs lives in
 * different cities. Like the sample cards they are not catalog cards (ids `sample-duel-*`; no card
 * matches a catalog card's ZIP and household), so no real game answer ships in a browser chunk.
 * Each ZIP is in packages/data/out/areas.json, which the browser already uses for area lookups.
 */
export const duelCardsSample: readonly LifeCard[] = deepFreeze(LifeCardSchema.array().parse(duelCardsJson));
