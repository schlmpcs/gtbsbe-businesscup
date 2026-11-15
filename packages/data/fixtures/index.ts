// Canonical fixtures: the only fixture location (docs/DATA.md). Engine tests and the web app both
// use them; apps/web/src/fixtures only re-exports this module.
//
// Every fixture is validated with the contract's zod schema when this module loads, so a bad
// edit fails loudly in tests and CI instead of producing wrong numbers later.
//
// The sample statement CSV is plain text, not JSON: read it with `readStatementSampleCsv` from
// '@lifeguessr/data/fixtures/node' (Node only: tests, scripts, server routes).
//
// The sample life cards are not here: they live in '@lifeguessr/data/fixtures/cards' (see the note
// in cards.ts), so importing this barrel never puts game answers in a browser bundle.
import {
  AreaDataSchema, CategoryTotalsSchema, LoanInputSchema, NonNegativeMoneySchema, ProfileSchema, sourced, StatementFindingsSchema,
  type AreaData, type CategoryTotals, type LoanInput, type Money, type Profile, type Sourced, type StatementFindings,
} from '@lifeguessr/types';
import { z } from 'zod';
import areaDataJson from './areaData.sample.json';
import leaseScenarioJson from './leaseScenario.sample.json';
import loanOffersJson from './loanOffers.sample.json';
import profileJson from './profile.demo.json';
import statementFindingsJson from './statementFindings.sample.json';
import statementTotalsJson from './statementTotals.sample.json';
import { TogetherPartnerSchema, type TogetherPartner } from '@lifeguessr/types';
import togetherPartnerJson from './togetherPartner.sample.json';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

/** Sample AreaData for 4 Dallas-Fort Worth ZIPs, one per tier (cheap, mid, expensive, suburb). */
export const areaDataSample: readonly AreaData[] = deepFreeze(AreaDataSchema.array().parse(areaDataJson));

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

/** The lease fixture as stored: every value carries its `Source` and `isEstimate` (CLAUDE.md rule 5). */
export type LeaseScenarioFixture = { [K in keyof LeaseScenario]: Sourced<LeaseScenario[K]> };

export const LeaseScenarioFixtureSchema = z.object({
  monthly: sourced(LeaseScenarioSchema.shape.monthly),
  termMonths: sourced(LeaseScenarioSchema.shape.termMonths),
  dueAtSigning: sourced(LeaseScenarioSchema.shape.dueAtSigning),
  running: sourced(LeaseScenarioSchema.shape.running),
});

/**
 * S13 (Decision: keep the car or lease a new one) starting lease terms, with their source and
 * estimate flags. ILLUSTRATIVE, not a quote: every value is `isEstimate: true` until the user edits
 * it on the screen. Edit `leaseScenario.sample.json` to change the example.
 */
export const leaseScenarioFixture: Readonly<LeaseScenarioFixture> = deepFreeze(
  LeaseScenarioFixtureSchema.parse(leaseScenarioJson),
);

/** The plain lease terms of `leaseScenarioFixture` (what the engine path takes). */
export const leaseScenarioSample: Readonly<LeaseScenario> = deepFreeze({
  monthly: leaseScenarioFixture.monthly.value,
  termMonths: leaseScenarioFixture.termMonths.value,
  dueAtSigning: leaseScenarioFixture.dueAtSigning.value,
  running: leaseScenarioFixture.running.value,
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

/**
 * JF7: what `findIncomeAndDebts` finds in statement.sample.csv (the S9 "We found" review): the
 * biweekly ACME paycheck ($2,400 × 26 ÷ 12 = $5,200 a month), the Toyota car loan ($412) and the
 * Capital One card ($250), with each kind's typical APR and its source. Checked against the engine
 * on the real sample in apps/web/src/lib/statement/findingsGolden.test.ts.
 */
export const statementFindingsSample: Readonly<StatementFindings> = deepFreeze(
  StatementFindingsSchema.parse(statementFindingsJson),
);

/** AreaData for a fixture ZIP; throws if the ZIP is not in the fixtures. */
export function areaByZip(zip: string): AreaData {
  const area = areaDataSample.find((a) => a.zip === zip);
  if (!area) throw new Error(`No fixture AreaData for ZIP ${zip}`);
  return area;
}

/** A mutable deep copy of the demo profile (the exported one is frozen). */
export function cloneProfileDemo(): Profile {
  return ProfileSchema.parse(profileJson); // zod builds new objects/arrays on every parse
}

/**
 * "Together" (/together): a made-up second partner, only the numbers a shared plan holds for one
 * person (no names, ZIP or age; the nickname is a placeholder). Some values estimated. Engine tests
 * and the feature's tests use it.
 */
export const togetherPartnerSample: Readonly<TogetherPartner> = deepFreeze(TogetherPartnerSchema.parse(togetherPartnerJson));
