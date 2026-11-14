// The overpaying check's form: reading a typed ZIP, the starting values (saved inputs, else the
// profile, else defaults), the shape the engine takes and the shape the store keeps. Pure.
import { BENCHMARK_LINES, type CostCategory, type Profile } from '@lifeguessr/types';
import type {
  Adults, AreaTier, Bedrooms, BenchmarkLine, KidAge, Money, OverpayingCheckInput, OverpayingInputsVM, OverpayingToolState,
  PrefillSource, PrefillVM,
} from './types';

export const KID_AGES = ['infant', 'toddler', 'preschool', 'schoolAge'] as const satisfies readonly KidAge[];

/** Most bedrooms the rent data has (HUD tables stop at 4); more counts as 4. */
export const BEDROOMS_MAX = 4;
export const ADULTS_MIN = 1;
export const ADULTS_MAX = 4;
/** Most children per age band. Four bands, so a household has at most 20: the store's limit. */
export const KIDS_PER_BAND_MAX = 5;
/** Starting household when nothing says otherwise (the same defaults the store's saved inputs use). */
export const DEFAULT_BEDROOMS: Bedrooms = 2;
export const DEFAULT_ADULTS: Adults = 1;

/** Which profile spending line holds the same thing as each benchmark line. Car insurance is not a profile line. */
const PROFILE_CATEGORY: Partial<Record<BenchmarkLine, CostCategory>> = {
  rent: 'rentUtilities',
  groceries: 'groceries',
  childcare: 'childcare',
};

// ----- ZIP ---------------------------------------------------------------------------------------

export type ZipParse = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'zip'; zip: string };

/**
 * Reads what was typed in the ZIP box: spaces anywhere are ignored, and a ZIP+4 ("75206-1234" or the
 * nine digits run together) is cut to its five digits. Anything else (letters, a foreign postcode, too
 * few or too many digits) is invalid. ASCII digits only.
 */
export function parseZip(text: string): ZipParse {
  const compact = text.replace(/\s+/g, '');
  if (compact === '') return { kind: 'empty' };
  const m = /^(\d{5})(?:[-–—]?\d{4})?$/.exec(compact);
  return m ? { kind: 'zip', zip: m[1]! } : { kind: 'invalid' };
}

/** Whether two typed ZIPs mean the same ZIP ("75206" and " 75206-1234 " do; so do two that are both empty or both invalid). */
export function sameZip(a: string, b: string): boolean {
  const x = parseZip(a);
  const y = parseZip(b);
  return x.kind === y.kind && (x.kind !== 'zip' || (y.kind === 'zip' && x.zip === y.zip));
}

// ----- clamps ------------------------------------------------------------------------------------

function clampWhole(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
export const clampBedrooms = (n: number): Bedrooms => clampWhole(n, 0, BEDROOMS_MAX, DEFAULT_BEDROOMS) as Bedrooms;
export const clampAdults = (n: number): Adults => clampWhole(n, ADULTS_MIN, ADULTS_MAX, DEFAULT_ADULTS) as Adults;
export const clampKidCount = (n: number): number => clampWhole(n, 0, KIDS_PER_BAND_MAX, 0);

// ----- the form's state ----------------------------------------------------------------------------

/** What the person has typed and chosen: the form's inputs plus the metro picker's choice. */
export type Draft = { inputs: OverpayingInputsVM; metro: string | null; tier: AreaTier | null };

const noKids = (): Record<KidAge, number> => ({ infant: 0, toddler: 0, preschool: 0, schoolAge: 0 });
const noAmounts = (): Record<BenchmarkLine, Money | null> => ({ rent: null, carInsurance: null, groceries: null, childcare: null });
const noPrefill = (): PrefillVM => ({ zip: false, amounts: { rent: null, carInsurance: null, groceries: null, childcare: null } });

export function emptyInputs(): OverpayingInputsVM {
  return { zip: '', bedrooms: DEFAULT_BEDROOMS, adults: DEFAULT_ADULTS, kids: noKids(), amounts: noAmounts() };
}

function countKids(kids: readonly KidAge[]): Record<KidAge, number> {
  const counts = noKids();
  for (const age of kids) counts[age] += 1;
  for (const age of KID_AGES) counts[age] = clampKidCount(counts[age]);
  return counts;
}

function expandKids(counts: Record<KidAge, number>): KidAge[] {
  return KID_AGES.flatMap((age) => Array.from({ length: counts[age] }, () => age));
}

/**
 * Where the form starts. Saved inputs (the last ones typed) win as a whole: a box left blank stays blank.
 * Without them, a profile of the person's own fills the ZIP and the spending lines that match a benchmark
 * (rent + utilities, groceries, childcare when above 0); the household and car insurance are always asked.
 * `prefill` says which boxes came from the profile.
 */
export function initialDraft(profile: Profile | null, stored: OverpayingToolState | undefined): { draft: Draft; prefill: PrefillVM } {
  if (stored) {
    const amounts = noAmounts();
    for (const line of BENCHMARK_LINES) amounts[line] = stored[line] ?? null;
    return {
      draft: {
        inputs: {
          zip: stored.zip ?? '',
          bedrooms: clampBedrooms(stored.bedrooms),
          adults: clampAdults(stored.adults),
          kids: countKids(stored.kids),
          amounts,
        },
        metro: stored.metro ?? null,
        tier: stored.tier ?? null,
      },
      prefill: noPrefill(),
    };
  }
  const inputs = emptyInputs();
  const prefill = noPrefill();
  if (profile) {
    if (profile.zip) {
      inputs.zip = profile.zip;
      prefill.zip = true;
    }
    for (const line of BENCHMARK_LINES) {
      const category = PROFILE_CATEGORY[line];
      const spending = category ? profile.spending[category] : undefined;
      if (spending && spending.value > 0) {
        inputs.amounts[line] = spending.value;
        const from: PrefillSource = spending.isEstimate ? 'profileEstimate' : 'profile';
        prefill.amounts[line] = from;
      }
    }
  }
  return { draft: { inputs, metro: null, tier: null }, prefill };
}

// ----- what leaves the form ----------------------------------------------------------------------------

const usable = (n: Money | null): n is Money => n !== null && Number.isFinite(n) && n > 0;

/** The engine's input. Only amounts that are usable go in; the caller has already refused the rest. */
export function toCheckInput(inputs: OverpayingInputsVM): OverpayingCheckInput {
  const out: OverpayingCheckInput = { bedrooms: inputs.bedrooms, adults: inputs.adults, kids: expandKids(inputs.kids) };
  for (const line of BENCHMARK_LINES) {
    const v = inputs.amounts[line];
    if (usable(v)) out[line] = v;
  }
  return out;
}

/**
 * The last inputs as the store keeps them (`tools.overpaying`). Its schema is strict: a ZIP is five digits
 * and an amount is above 0, so anything else is left out rather than saved and refused.
 */
export function toToolState(draft: Draft): OverpayingToolState {
  const { inputs } = draft;
  const zip = parseZip(inputs.zip);
  const state: OverpayingToolState = { bedrooms: inputs.bedrooms, adults: inputs.adults, kids: expandKids(inputs.kids) };
  if (zip.kind === 'zip') state.zip = zip.zip;
  if (draft.metro) state.metro = draft.metro;
  if (draft.tier) state.tier = draft.tier;
  for (const line of BENCHMARK_LINES) {
    const v = inputs.amounts[line];
    if (usable(v)) state[line] = v;
  }
  return state;
}
