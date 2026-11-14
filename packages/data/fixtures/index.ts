// Canonical fixtures: the only fixture location (docs/DATA.md). Engine tests and the web app both
// use them; apps/web/src/fixtures only re-exports this module.
//
// Every fixture is validated with the contract's zod schema when this module loads, so a bad
// edit fails loudly in tests and CI instead of producing wrong numbers later.
//
// The sample statement CSV is plain text, not JSON: read it with `readStatementSampleCsv` from
// '@lifeguessr/data/fixtures/node' (Node only: tests, scripts, server routes).
import {
  AreaDataSchema, CategoryTotalsSchema, LifeCardSchema, LoanInputSchema, ProfileSchema,
  type AreaData, type CategoryTotals, type LifeCard, type LoanInput, type Profile,
} from '@lifeguessr/types';
import areaDataJson from './areaData.sample.json';
import cardDecisionJson from './carDecision.sample.json';
import cardsJson from './cards.sample.json';
import loanOffersJson from './loanOffers.sample.json';
import profileJson from './profile.demo.json';
import statementTotalsJson from './statementTotals.sample.json';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/** Sample AreaData for 4 Dallas-Fort Worth ZIPs, one per tier (cheap, mid, expensive, suburb). */
export const areaDataSample: readonly AreaData[] = deepFreeze(AreaDataSchema.array().parse(areaDataJson));

/** Sample life cards spanning cheap → expensive. Server-side only during play (holds the answer). */
export const cardsSample: readonly LifeCard[] = deepFreeze(LifeCardSchema.array().parse(cardsJson));

/** The demo profile: a 32-year-old with a card balance and an auto loan; some fields estimated. */
export const profileDemo: Readonly<Profile> = deepFreeze(ProfileSchema.parse(profileJson));

/** Three loan offers for the Loan Lab compare (same $28,000 car, different APR/term/fees). */
export const loanOffersSample: readonly LoanInput[] = deepFreeze(LoanInputSchema.array().parse(loanOffersJson));

/**
 * S13 (Decision: the car) starting offers, one per path: A = a newer car on a long loan, B = a cheaper
 * used car on a short one. Sample inputs the user edits, like the Loan Lab offers (not market data).
 */
export const carDecisionSample: Readonly<{ pathA: LoanInput; pathB: LoanInput }> = deepFreeze({
  pathA: LoanInputSchema.parse(cardDecisionJson.pathA),
  pathB: LoanInputSchema.parse(cardDecisionJson.pathB),
});

/**
 * Category totals of the four full months (Jul–Oct 2026) of statement.sample.csv, oldest first: what
 * the statement categorizer produces for it, so screens that read statement history (S14 check-in)
 * work before an upload. Categorized with a fixed merchant table (fixtures.test.ts recomputes the
 * totals from the CSV); paychecks go to `detectedPay`; transfers, money received and the two one-off
 * charges (a vet bill, a yearly Prime renewal) are left out. November is partial, so it is not here.
 */
export const statementTotalsSample: readonly CategoryTotals[] = deepFreeze(
  CategoryTotalsSchema.array().parse(statementTotalsJson),
);

/** AreaData for a fixture ZIP; throws if the ZIP is not in the fixtures. */
export function areaByZip(zip: string): AreaData {
  const area = areaDataSample.find((a) => a.zip === zip);
  if (!area) throw new Error(`No fixture AreaData for ZIP ${zip}`);
  return area;
}

/** A fixture life card by id; throws if it does not exist. */
export function cardById(id: string): LifeCard {
  const card = cardsSample.find((c) => c.id === id);
  if (!card) throw new Error(`No fixture LifeCard with id ${id}`);
  return card;
}

/** A mutable deep copy of the demo profile (the exported one is frozen). */
export function cloneProfileDemo(): Profile {
  return ProfileSchema.parse(profileJson); // zod builds new objects/arrays on every parse
}
