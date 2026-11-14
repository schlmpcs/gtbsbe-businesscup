// Canonical fixtures: the only fixture location (docs/DATA.md). Engine tests and the web app both
// use them; apps/web/src/fixtures only re-exports this module.
//
// Every fixture is validated with the contract's zod schema when this module loads, so a bad
// edit fails loudly in tests and CI instead of producing wrong numbers later.
//
// The sample statement CSV is plain text, not JSON: read it with `readStatementSampleCsv` from
// '@lifeguessr/data/fixtures/node' (Node only: tests, scripts, server routes).
import {
  AreaDataSchema, CategoryTotalsSchema, LifeCardSchema, LoanInputSchema, NonNegativeMoneySchema, ProfileSchema,
  type AreaData, type CategoryTotals, type LifeCard, type LoanInput, type Money, type Profile,
} from '@lifeguessr/types';
import { z } from 'zod';
import areaDataJson from './areaData.sample.json';
import cardsJson from './cards.sample.json';
import leaseScenarioJson from './leaseScenario.sample.json';
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

/** A car lease: the S13 decision's "lease" path. Money is monthly except `dueAtSigning` (once per term). */
export type LeaseScenario = {
  /** Lease payment, per month. */
  monthly: Money;
  termMonths: number;
  /** Paid at signing, at the start of every term. */
  dueAtSigning: Money;
  /** Running costs of the leased car (insurance, fuel, upkeep), per month. */
  running: Money;
};

export const LeaseScenarioSchema = z.object({
  monthly: NonNegativeMoneySchema,
  termMonths: z.number().int().min(1).max(120),
  dueAtSigning: NonNegativeMoneySchema,
  running: NonNegativeMoneySchema,
});

/**
 * S13 (Decision: keep the car or lease a new one) starting lease terms. ILLUSTRATIVE, not a quote
 * and not sourced: every value is an estimate until the user edits it on the screen.
 */
export const leaseScenarioSample: Readonly<LeaseScenario> = deepFreeze(LeaseScenarioSchema.parse(leaseScenarioJson));

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
