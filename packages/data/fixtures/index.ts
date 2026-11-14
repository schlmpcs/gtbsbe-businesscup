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
  AreaDataSchema, AreaTierSchema, CategoryTotalsSchema, LoanInputSchema, NonNegativeMoneySchema, ProfileSchema,
  SCENARIO_MAX_CHANGES, ScenarioChangeSchema, SourceSchema, sourced,
  type AreaData, type CategoryTotals, type LoanInput, type Money, type Profile, type Scenario, type ScenarioChange,
  type Source, type Sourced,
} from '@lifeguessr/types';
import { z } from 'zod';
import { areaForMetro } from '../areas';
import areaDataJson from './areaData.sample.json';
import leaseScenarioJson from './leaseScenario.sample.json';
import loanOffersJson from './loanOffers.sample.json';
import profileJson from './profile.demo.json';
import statementTotalsJson from './statementTotals.sample.json';
import whatIfPresetsJson from './whatIfPresets.sample.json';

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

// ----- What if? presets (two choices, two futures) -------------------------------------------

/** A preset change: a ScenarioChange, or a move to another tier of the user's own metro. */
export type WhatIfPresetChange = ScenarioChange | { kind: 'moveTier'; tier: AreaData['tier'] };
export type WhatIfPresetSide = { label: string; art: string; changes: WhatIfPresetChange[] };
export type WhatIfPreset = {
  id: string;
  A: WhatIfPresetSide;
  B: WhatIfPresetSide;
  /** Where the preset's own numbers (loan terms, ZIPs) come from; estimates are labeled. */
  source: Source;
  isEstimate: boolean;
};

const WhatIfPresetSideSchema = z.object({
  label: z.string().min(1).max(80),
  art: z.string().regex(/^[a-z0-9-]+$/),
  changes: z.array(z.union([
    ScenarioChangeSchema,
    z.object({ kind: z.literal('moveTier'), tier: AreaTierSchema }),
  ])).max(SCENARIO_MAX_CHANGES),
});

export const WhatIfPresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  A: WhatIfPresetSideSchema,
  B: WhatIfPresetSideSchema,
  source: SourceSchema,
  isEstimate: z.boolean(),
});

/** The five What if? presets (whatIfPresets.sample.json): each is two scenarios, A and B. */
export const whatIfPresets: readonly WhatIfPreset[] = deepFreeze(WhatIfPresetSchema.array().parse(whatIfPresetsJson));

/**
 * A preset side as a Scenario for the engine: `moveTier` becomes a move to that tier's ZIP in
 * `home`'s metro (left out when home is already that ZIP or the metro lacks the tier).
 */
export function resolveWhatIfPreset(side: WhatIfPresetSide, home: Pick<AreaData, 'metro' | 'zip'>): Scenario {
  const changes: ScenarioChange[] = [];
  for (const c of side.changes) {
    if (c.kind !== 'moveTier') {
      changes.push(c);
      continue;
    }
    const zip = areaForMetro(home.metro, c.tier)?.zip;
    if (zip && zip !== home.zip) changes.push({ kind: 'move', zip });
  }
  return { label: side.label, changes };
}
