// View-model types for the overpaying check (S23, route /tools/overpaying). Task: M11 (model + placeholder ui).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useOverpaying() in ./useOverpaying.ts.
import type {
  AreaData, Benchmark, BenchmarkLine, ClientFunnelEvent, KidAge, Money, OverpayingResult, Profile, Source,
} from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';

export type { Loadable, VMError } from '@/lib/model/types';
export type { BenchmarkLine, KidAge, Money, Source } from '@lifeguessr/types';

export type AreaTier = AreaData['tier'];
export type Position = Benchmark['position'];
export type Bedrooms = 0 | 1 | 2 | 3 | 4;
export type Adults = 1 | 2 | 3 | 4;
/** A box on the form that can hold something we cannot use. */
export type OverpayingField = 'zip' | BenchmarkLine;

// ----- what the form holds ----------------------------------------------------------------------

export type OverpayingInputsVM = {
  /** Exactly as typed, so the box keeps what the person wrote (spaces, ZIP+4 and all). */
  zip: string;
  /** 0 = studio; 4 stands for "4 or more": the rent data stops at 4. */
  bedrooms: Bedrooms;
  adults: Adults;
  /** Children per age band. */
  kids: Record<KidAge, number>;
  /** Monthly amounts in dollars; null = left blank. */
  amounts: Record<BenchmarkLine, Money | null>;
};

/** Where a pre-filled amount came from; null once the person typed their own or there was no profile. */
export type PrefillSource = 'profile' | 'profileEstimate' | null;

export type PrefillVM = {
  /** The ZIP box still shows the profile's ZIP. */
  zip: boolean;
  amounts: Record<BenchmarkLine, PrefillSource>;
};

// ----- coverage ---------------------------------------------------------------------------------

/**
 * How the typed ZIP maps to our data.
 * - empty: nothing typed; invalid: not a US ZIP.
 * - exact: a ZIP we have data for.
 * - none: a ZIP we have no data for and no metro chosen yet (the picker is shown).
 * - metro: no data for the ZIP; the person chose the nearest metro and area type, so results are approximate.
 */
export type CoverageVM =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'exact'; zip: string; metro: string }
  | { kind: 'none'; zip: string }
  | { kind: 'metro'; zip: string; metro: string; tier: AreaTier };

/** A metro we have data for and the area types (tiers) available in it. */
export type CoveredMetro = { metro: string; state: string; tiers: AreaTier[] };

export type MetroPickerVM = {
  options: CoveredMetro[];
  metro: string | null;
  tier: AreaTier | null;
  /** Area types the chosen metro has (empty until a metro is chosen). */
  tiers: AreaTier[];
  /** Choosing a metro keeps the current area type when the metro has it, else picks "mid" (or its first). */
  setMetro: (metro: string | null) => void;
  setTier: (tier: AreaTier) => void;
};

/** What is still missing before there is anything to compare. */
export type OverpayingNeed = 'zip' | 'metro' | 'amount';

// ----- the result -------------------------------------------------------------------------------

/**
 * A range bar on one linear axis. Every position is a fraction (0–1) of the way along it; the axis
 * is padded around the data and need not start at zero, so the labels carry the numbers.
 */
export type RangeBarVM = { min: Money; max: Money; low: number; mid: number; high: number; yours: number };

export type BenchmarkRowVM = {
  line: BenchmarkLine;
  yours: Money;
  typical: { low: Money; mid: Money; high: Money };
  /** Where `typical` comes from; shown with every row. */
  source: Source;
  /** The range is partly assumed (or approximate, nearest metro): shown with the estimate tag. */
  isEstimate: boolean;
  position: Position;
  gapPerMonth: Money;
  gapPerYear: Money;
  /**
   * What closing the gap to the middle of the range is projected to be worth over 10 years, in today's
   * dollars (rules-based forecast of your profile). null unless the line is above the range, a profile of
   * the person's own was used and it can absorb the change; a real effect is always above zero.
   */
  effect10y: Money | null;
  bar: RangeBarVM;
};

/** A line that was not compared: left blank, no benchmark for it here, or childcare entered with no children. */
export type SkippedLineVM = { line: BenchmarkLine; reason: 'notEntered' | 'noData' | 'noKids' };

export type OverpayingSummaryVM = {
  /** Lines compared. */
  compared: number;
  /** Of those, above the typical range. */
  above: number;
  /** Total gap per year over the lines above the range. */
  gapPerYear: Money;
  /** Total 10-year effect over the lines that have one; null when none does. */
  effect10y: Money | null;
};

export type OverpayingResultVM = {
  rows: BenchmarkRowVM[];
  skipped: SkippedLineVM[];
  summary: OverpayingSummaryVM;
  /** A profile of the person's own went into the 10-year effects. */
  effectAvailable: boolean;
};

// ----- the view-model ---------------------------------------------------------------------------

export type OverpayingVM = {
  status: 'loading' | 'ready';
  /** Streamer mode (`?stream=1`) never shows this tool: the screen shows a notice instead. */
  hidden: boolean;
  inputs: OverpayingInputsVM;
  setZip: (text: string) => void;
  /** Whole numbers only; above 4 counts as 4 (the data stops there), below 0 as a studio. */
  setBedrooms: (bedrooms: number) => void;
  /** 1 to 4. */
  setAdults: (adults: number) => void;
  setKidCount: (age: KidAge, count: number) => void;
  setAmount: (line: BenchmarkLine, amount: Money | null) => void;
  /** Most children in one age band, and the tallest household the form takes. */
  limits: { kidsPerBand: number; bedrooms: number; adults: number };
  /** Which boxes still hold what the profile gave. Editing here never changes the profile. */
  prefill: PrefillVM;
  /** The ZIPs and metros we have data for (for the "not covered" notice); null when unknown. */
  coverageCounts: { zips: number; metros: number } | null;
  coverage: CoverageVM;
  /** Shown when `coverage` is none or metro; null otherwise. */
  metroPicker: MetroPickerVM | null;
  /** Boxes with something we cannot use (a bad ZIP, an amount of 0); no result while any is set. */
  invalidFields: OverpayingField[];
  /** What the person still has to give us; null once there is something to compare. */
  needs: OverpayingNeed | null;
  /** null until there is something to compare. */
  result: Loadable<OverpayingResultVM> | null;
  /** Where the streamer notice sends people back to. */
  playHref: string;
  /** Where to build a profile (balance sheet), for the 10-year effect. */
  profileHref: string;
};

// ----- what the model is given ------------------------------------------------------------------

/** What the engine's `overpayingCheck` takes (packages/engine/overpaying.ts, issue #86). */
export type OverpayingCheckInput = {
  bedrooms: Bedrooms;
  adults: Adults;
  kids: KidAge[];
  rent?: Money;
  carInsurance?: Money;
  groceries?: Money;
  childcare?: Money;
};

/** Same signature as the engine's `overpayingCheck(input, area, profile?, opts?)` (#86). */
export type OverpayingCheckFn = (
  input: OverpayingCheckInput,
  area: AreaData | null,
  profile?: Profile,
  opts?: { coverage?: 'exact' | 'metro' },
) => OverpayingResult;

/** Engine, data and the event sender, so the model can be tested on its own. Bound to the real ones in ./deps.ts. */
export type OverpayingDeps = {
  areas: {
    /** `areaForZip` (lib/areas.ts). */
    forZip: (zip: string) => AreaData | null;
    /** How many ZIPs the data covers. */
    zipCount: number;
  };
  /** `overpayingCheck` (#86). Absent until that lands: the result then reports "not implemented". */
  check?: OverpayingCheckFn;
  /** `coveredMetros` and `areaForMetro` from `@lifeguessr/data/areas` (#86). Absent until that lands: no metro picker. */
  metros?: {
    list: () => CoveredMetro[];
    forMetro: (metro: string, tier: AreaTier) => AreaData | null;
  };
  /** `track` from lib/events. */
  track: (event: ClientFunnelEvent, opts?: { once?: string }) => void;
};

/**
 * The last inputs, as kept in the store under `tools.overpaying` (OverpayingToolStateSchema in
 * packages/types/tools.ts, issue #78). Same shape as that schema's output.
 */
export type OverpayingToolState = {
  zip?: string;
  metro?: string;
  tier?: AreaTier;
  bedrooms: number;
  adults: number;
  kids: KidAge[];
  rent?: Money;
  carInsurance?: Money;
  groceries?: Money;
  childcare?: Money;
};

export type OverpayingOptions = {
  /** Streamer mode: the tool is hidden. */
  streamer?: boolean;
  /** The saved inputs: the store's `tools.overpaying` (#78). They win over the profile's values. */
  stored?: OverpayingToolState;
  /** Called with the inputs after each change the person makes (`setTool('overpaying', state)`, #78). */
  onStore?: (state: OverpayingToolState) => void;
  /** Engine, data and events; defaults to the real ones. */
  deps?: OverpayingDeps;
};
