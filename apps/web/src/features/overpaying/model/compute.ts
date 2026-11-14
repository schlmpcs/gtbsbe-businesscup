// The overpaying check without React: what the typed inputs mean (which area, what is missing or
// unusable) and, when there is something to compare, the engine's answer as a view-model. The hook
// only holds the form's state and calls this.
import { BENCHMARK_LINES, OverpayingResultSchema, type AreaData, type Profile } from '@lifeguessr/types';
import { runEngine } from '@/lib/model/errors';
import { KID_AGES, parseZip, toCheckInput } from './inputs';
import { toResultVM } from './rows';
import type {
  AreaTier, CoverageVM, Loadable, OverpayingDeps, OverpayingField, OverpayingInputsVM, OverpayingNeed, OverpayingResultVM,
} from './types';

export type ComputeArgs = {
  inputs: OverpayingInputsVM;
  /** The metro picker's choice; only used for a ZIP we have no data for. */
  metro: { metro: string | null; tier: AreaTier | null };
  /** The person's own profile, or null. Only passed to the engine, for the 10-year effects; never changed. */
  profile: Profile | null;
  deps: Pick<OverpayingDeps, 'areas' | 'check' | 'metros'>;
};

export type Computed = {
  coverage: CoverageVM;
  invalidFields: OverpayingField[];
  needs: OverpayingNeed | null;
  /** null until the inputs are complete and usable. */
  result: Loadable<OverpayingResultVM> | null;
  /** Identifies the set of inputs a result was made for (null while incomplete); used to count a check once. */
  signature: string | null;
};

const usable = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

export function computeOverpaying({ inputs, metro, profile, deps }: ComputeArgs): Computed {
  const zip = parseZip(inputs.zip);

  const invalidFields: OverpayingField[] = [];
  if (zip.kind === 'invalid') invalidFields.push('zip');
  for (const line of BENCHMARK_LINES) {
    const amount = inputs.amounts[line];
    if (amount !== null && !usable(amount)) invalidFields.push(line);
  }

  // Which area the numbers are about, and how sure we are of it.
  let coverage: CoverageVM;
  let area: AreaData | null = null;
  let areaCoverage: 'exact' | 'metro' | null = null;
  let areaKey = '';
  if (zip.kind === 'empty') coverage = { kind: 'empty' };
  else if (zip.kind === 'invalid') coverage = { kind: 'invalid' };
  else {
    const exact = deps.areas.forZip(zip.zip);
    const chosen = !exact && metro.metro && metro.tier ? (deps.metros?.forMetro(metro.metro, metro.tier) ?? null) : null;
    if (exact) {
      area = exact;
      areaCoverage = 'exact';
      areaKey = zip.zip;
      coverage = { kind: 'exact', zip: zip.zip, metro: exact.metro };
    } else if (chosen && metro.tier) {
      area = chosen;
      areaCoverage = 'metro';
      areaKey = `${chosen.metro}|${metro.tier}`;
      coverage = { kind: 'metro', zip: zip.zip, metro: chosen.metro, tier: metro.tier };
    } else {
      coverage = { kind: 'none', zip: zip.zip };
    }
  }

  const entered = BENCHMARK_LINES.filter((line) => inputs.amounts[line] !== null);
  const needs: OverpayingNeed | null =
    coverage.kind === 'empty' || coverage.kind === 'invalid' ? 'zip' : coverage.kind === 'none' ? 'metro' : entered.length === 0 ? 'amount' : null;

  if (needs !== null || invalidFields.length > 0 || area === null || areaCoverage === null) {
    return { coverage, invalidFields, needs, result: null, signature: null };
  }

  const signature = JSON.stringify([
    areaKey,
    inputs.bedrooms,
    inputs.adults,
    KID_AGES.map((age) => inputs.kids[age]),
    BENCHMARK_LINES.map((line) => inputs.amounts[line]),
  ]);

  const check = deps.check;
  let result: Loadable<OverpayingResultVM>;
  if (!check) {
    // The engine is not wired in yet (issue #86): say so the way every unfinished engine piece does.
    result = { status: 'error', error: { kind: 'notImplemented', task: 'M10' } };
  } else {
    const ran = runEngine(() => check(toCheckInput(inputs), area, profile ?? undefined, { coverage: areaCoverage }));
    if (ran.status !== 'ready') result = ran;
    else {
      // Numbers that contradict themselves (a position that does not match its range) are not shown.
      const valid = OverpayingResultSchema.safeParse(ran.data);
      const kidCount = KID_AGES.reduce((sum, age) => sum + inputs.kids[age], 0);
      result = valid.success
        ? { status: 'ready', data: toResultVM(ran.data, { profileUsed: profile !== null, kidCount }) }
        : { status: 'error', error: { kind: 'invalidResponse' } };
    }
  }
  return { coverage, invalidFields, needs, result, signature };
}
