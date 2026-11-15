// View-model types for /plan (MP7, epic #160). The contract with plan/ui/*, which may import only this
// file, @/ui-kit/** and @/copy (lint-enforced). Every number the UI shows arrives here already
// formatted (strings named `...Label` or without a Money type); raw numbers are kept next to them only
// where a chart or a control needs them. The UI never computes.
//
// Hooks: usePlan, useScenarios, useEventCatalog, useEventEditor, useAssumptions, useCompare,
// useChanceOfSuccess, usePlanMoves, useAiLine (one file each in this folder).
import type { AccountGroup, Money, PlanEventType, Rate, Source } from '@lifeguessr/types';

export type { AccountGroup, Money, PlanEventType, Rate, Source } from '@lifeguessr/types';

/** An icon id the UI maps to a sprite or glyph. Scenario icons are free strings from the scenario ('home', 'kid'). */
export type PlanEventIconId =
  | 'cash' | 'receipt' | 'home' | 'kid' | 'briefcase' | 'pause' | 'gift' | 'beach' | 'shield';

export type PlanTone = 'good' | 'bad';
export type PlanDisplay = 'today' | 'future';
/** 'error': this browser refused the write (private window, storage full or blocked); the plan stays in memory. */
export type SaveState = 'saving' | 'saved' | 'error';

/** A value the person can edit: raw for the control, formatted for display, with where it came from. */
export type PlanFieldValue = number | boolean | string | null;

// ----- usePlan -------------------------------------------------------------------------------

export type PlanKpiId = 'netWorthEndOfYear' | 'netWorthAtRetirement' | 'netWorthAtEnd' | 'shortfall';
export type PlanKpiVM = {
  id: PlanKpiId;
  label: string;
  /** "$109,000", "−$220,433", "Age 35" or "Past 90". */
  value: string;
  /** Raw value behind `value` (dollars, or the age; null = never runs short). */
  raw: Money | number | null;
  tone: PlanTone;
  /** Key into copy.plan.kpi.<id> and its resolved tooltip. */
  tooltipKey: PlanKpiId;
  tooltip: string;
};

export type PlanChartPoint = {
  year: number;
  age: number;
  /** In the plan's display unit; unrounded, for drawing. */
  netWorth: Money;
  /** Formatted for tooltips: "$12,345" or "−$3,214". */
  netWorthLabel: string;
  belowZero: boolean;
};
export type PlanChartMarker = { id: string; year: number; age: number; icon: PlanEventIconId; label: string; enabled: boolean };
export type PlanChartTick = { year: number; age: number; label: string };
export type PlanChartVM = {
  points: PlanChartPoint[];
  markers: PlanChartMarker[];
  xTicks: PlanChartTick[];
  /** Smallest and largest net worth, for the y axis. */
  yDomain: [Money, Money];
  retireYear: number | null;
  /** Years an event may be dragged to (inclusive). */
  yearRange: { min: number; max: number };
};

export type PlanAccountsTableVM = {
  columns: { accountId: string; name: string; group: AccountGroup; groupLabel: string }[];
  /** Assets, then liabilities: the groups that have rows in the plan, in group order, with their account ids. */
  sections: {
    id: 'assets' | 'liabilities';
    label: string;
    groups: { group: AccountGroup; label: string; accountIds: string[] }[];
  }[];
  rows: {
    year: number;
    age: number;
    isRetirementYear: boolean;
    netWorthLabel: string;
    /** Year-end totals from the plan (liabilities as a positive balance). */
    assetsLabel: string;
    liabilitiesLabel: string;
    /** Year-end balance per group: the sum of its accounts' `end`. */
    groupEnds: Partial<Record<AccountGroup, string>>;
    cells: Record<string, { start: string; growth: string; deposits: string; withdrawals: string; end: string }>;
  }[];
};
export type PlanCashFlowTableVM = {
  rows: {
    year: number;
    age: number;
    incomeLabel: string;
    expensesLabel: string;
    withdrawalsLabel: string;
    netLabel: string;
    netTone: PlanTone;
    incomeLines: { key: string; label: string; amountLabel: string }[];
    expenseLines: { key: string; label: string; amountLabel: string }[];
  }[];
};
export type PlanEventRowVM = {
  id: string;
  type: PlanEventType;
  icon: PlanEventIconId;
  title: string;
  /** Person's own name for the event, when set; stays in the browser. */
  name?: string;
  year: number;
  age: number;
  summary: string;
  enabled: boolean;
};

export type PlanVM =
  /** The saved plan is not loaded yet (server render and the first client render). */
  | { status: 'loading'; disclaimer: string }
  | { status: 'notFound'; disclaimer: string }
  | {
      status: 'ready';
      scenarioId: string;
      scenarioName: string;
      kpis: PlanKpiVM[];
      chart: PlanChartVM;
      tables: { accounts: PlanAccountsTableVM; cashFlow: PlanCashFlowTableVM; events: PlanEventRowVM[] };
      display: { value: PlanDisplay; label: string; options: { value: PlanDisplay; label: string }[] };
      saveState: SaveState;
      /** "Saving…", "Saved just now" or the could-not-save message. */
      saveLabel: string;
      disclaimer: string;
      setDisplay: (display: PlanDisplay) => void;
      /** Drag an event on the chart; the year is clamped to `chart.yearRange` and rounded to a whole year. */
      moveEvent: (id: string, year: number) => void;
    };

// ----- useScenarios / useEventCatalog ---------------------------------------------------------

export type ScenarioItemVM = { id: string; name: string; icon: string; active: boolean };
export type ScenariosVM = {
  items: ScenarioItemVM[];
  activeId: string;
  /** At least two scenarios exist. */
  canCompare: boolean;
  select: (id: string) => void;
  /** Duplicates the active scenario, selects the copy and returns its id. */
  add: () => string;
  rename: (id: string, name: string) => void;
  /** The last scenario cannot be removed. */
  remove: (id: string) => void;
  canRemove: boolean;
};

export type EventCatalogEntryVM = {
  type: PlanEventType;
  titleKey: PlanEventType;
  descriptionKey: PlanEventType;
  title: string;
  description: string;
  icon: PlanEventIconId;
  /** False when the type is one-per-plan and already there (Retire, Social Security). */
  enabled: boolean;
};
export type EventCatalogVM = {
  entries: EventCatalogEntryVM[];
  /** Creates the event with its defaults in the active scenario, opens it in the editor and returns its id (null if not enabled). */
  add: (type: PlanEventType) => string | null;
  /** The event the editor is open on, or null. */
  openEventId: string | null;
  openEditor: (id: string) => void;
  closeEditor: () => void;
};

// ----- useEventEditor -------------------------------------------------------------------------

export type EventFieldKind = 'money' | 'rate' | 'year' | 'count' | 'toggle' | 'choice';
export type EventFieldVM = {
  /** Pass to `update`. */
  key: string;
  kind: EventFieldKind;
  label: string;
  value: PlanFieldValue;
  /** Formatted value: "$615,400", "6.5%", "2029". Toggles and choices: the option label. */
  display: string;
  /** Our estimate rather than the person's own number. */
  isEstimate: boolean;
  source?: Source;
  hint?: string;
  /** Choice fields. */
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
};
export type EventBreakdownVM = {
  lines: { key: 'principalAndInterest' | 'propertyTax' | 'insurance'; label: string; amountLabel: string; amount: Money }[];
  totalLabel: string;
  total: Money;
};
export type EventPreviewVM = {
  /** With the event on vs the same plan without it. */
  rows: { id: 'netWorthAtRetirement' | 'netWorthAtEnd' | 'shortfall'; label: string; withLabel: string; withoutLabel: string; deltaLabel: string; tone: PlanTone }[];
  series: { year: number; age: number; withEvent: Money; withoutEvent: Money }[];
};
export type EventEditorVM =
  | { status: 'notFound'; message: string }
  | {
      status: 'ready';
      id: string;
      type: PlanEventType;
      icon: PlanEventIconId;
      title: string;
      /** Person's own label for the event (browser only). */
      name: string;
      enabled: boolean;
      fields: EventFieldVM[];
      /** buyHome only. */
      breakdown: EventBreakdownVM | null;
      /** buyHome only: down payment as a decimal share of the price (0.2 = 20%), always = downPayment / homeValue. */
      downPaymentPct: Rate | null;
      downPaymentPctLabel: string | null;
      preview: EventPreviewVM;
      /** `field` is an `EventFieldVM.key`, or 'name', or 'downPaymentPct' (a decimal share). A typed estimate becomes the person's own number. */
      update: (field: string, value: PlanFieldValue) => void;
      /** The eye icon. */
      toggleEnabled: () => void;
      remove: () => void;
    };

// ----- useAssumptions -------------------------------------------------------------------------

export type AssumptionKey = 'retireAge' | 'endAge' | 'inflation' | 'display' | 'expensesMode' | 'expensesMonthly';
export type AssumptionFieldVM = {
  key: AssumptionKey;
  kind: EventFieldKind;
  label: string;
  value: PlanFieldValue;
  display: string;
  isEstimate: boolean;
  source?: Source;
  /** "Most plans use 2–3%". */
  hint?: string;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
};
export type GrowthRowVM = {
  group: AccountGroup;
  label: string;
  /** The person's override, or null to use the default. */
  override: Rate | null;
  /** What is used: the override, else the default. */
  rate: Rate;
  rateLabel: string;
  hint: string;
  source?: Source;
};
export type AssumptionsVM = {
  fields: AssumptionFieldVM[];
  growth: GrowthRowVM[];
  withdrawalOrder: { group: AccountGroup; label: string }[];
  savingsSplit: { group: AccountGroup; label: string; share: Rate; shareLabel: string }[];
  /** Why the last `setSavingsSplit` or `setWithdrawalOrder` was refused; null when fine. */
  error: 'savingsSplit' | 'withdrawalOrder' | null;
  errorMessage: string | null;
  update: (key: AssumptionKey, value: PlanFieldValue) => void;
  updateGrowth: (group: AccountGroup, rate: Rate | null) => void;
  /** Must list every group of the current order exactly once; else refused (`error`). */
  setWithdrawalOrder: (order: AccountGroup[]) => boolean;
  /** Shares must sum to 1 (within 0.0001); else refused (`error`). */
  setSavingsSplit: (split: { group: AccountGroup; share: Rate }[]) => boolean;
};

// ----- useCompare -----------------------------------------------------------------------------

export type CompareVM =
  | { status: 'notFound' }
  | {
      status: 'ready';
      a: { id: string; name: string };
      b: { id: string; name: string };
      /** Net worth per year of each scenario, in the display unit. */
      series: { year: number; age: number; a: Money; b: Money }[];
      diffTable: { id: 'netWorthAtRetirement' | 'netWorthAtEnd' | 'shortfall'; label: string; aLabel: string; bLabel: string; diffLabel: string; tone: PlanTone | null }[];
      /** The data behind `sentence`, for a UI that wants to bold parts. */
      sentenceData: { aName: string; bName: string; age: number; direction: 'higher' | 'lower' | 'same'; diffLabel: string };
      sentence: string;
      swap: () => void;
    };

// ----- useChanceOfSuccess ---------------------------------------------------------------------

export type ChanceStatus = 'idle' | 'running' | 'done' | 'error';
export type HistogramVM = {
  id: 'atRetirement' | 'atEnd' | 'shortfallAge';
  title: string;
  xLabel: string;
  bins: { from: number; to: number; count: number; label: string }[];
  /** The rules-based plan's own value on this axis (same display unit), for a marker; null when it has none (money never runs short). */
  planValue: number | null;
  /** "Plan $371K", "Plan: age 84" or "Plan: lasts past 90". */
  planLabel: string;
};
export type ChanceResultVM = {
  /** Whole percent for the gauge, 0–100. */
  gaugePct: number;
  gaugeLabel: string;
  tone: PlanTone;
  /** "x of N paths work". */
  pathsLabel: string;
  successfulPaths: number;
  paths: number;
  seed: number;
  bands: { year: number; p10: Money; p50: Money; p90: Money }[];
  samplePaths: { success: boolean; points: { year: number; netWorth: Money }[] }[];
  histograms: HistogramVM[];
};
export type ChanceSettingsVM = {
  paths: number;
  fixedSeed: boolean;
  seed: number | null;
  inflation: { mean: Rate; sd: Rate };
  endThreshold: Money;
  growth: { group: AccountGroup; label: string; mean: Rate; sd: Rate }[];
  /** Label and hint per setting key. */
  fields: { key: 'paths' | 'fixedSeed' | 'inflationMean' | 'inflationSd' | 'endThreshold'; label: string; hint: string | null; display: string }[];
  limits: { paths: { min: number; max: number } };
};
export type ChanceSettingsPatch = Partial<{
  paths: number;
  seed: number | null;
  inflation: { mean: Rate; sd: Rate };
  endThreshold: Money;
}>;
export type ChanceOfSuccessVM = {
  status: ChanceStatus;
  /** Null until a run is done. A settings change goes back to 'idle' and drops the result. */
  result: ChanceResultVM | null;
  settings: ChanceSettingsVM;
  idleMessage: string;
  /** Only when status is 'error'. */
  errorMessage: string | null;
  /** Starts a run of the engine's monteCarlo() on the active scenario. */
  run: () => void;
  updateSettings: (patch: ChanceSettingsPatch) => void;
  /** On: a fixed seed (same result every run). Off: a new seed each run. */
  setFixedSeed: (fixed: boolean) => void;
};

// ----- usePlanMoves ---------------------------------------------------------------------------

export type PlanMoveVM = {
  id: string;
  title: string;
  /** Net worth change at retirement from adding the move, signed: "+$41,000". */
  effectAtRetirement: string;
  effectAtRetirementRaw: Money;
  /** Change in the chance of success, in percentage points, signed: "+4 pts". Null until it is measured (same-seed Monte Carlo). */
  successRateDelta: string | null;
  successRateDeltaRaw: Rate | null;
  explanation: string;
  added: boolean;
  tone: PlanTone;
};
export type PlanMovesVM = {
  moves: PlanMoveVM[];
  /** Adds the move to the active scenario's plan. */
  addToPlan: (moveId: string) => void;
};

// ----- useAiLine ------------------------------------------------------------------------------

export type AiLineStatus = 'off' | 'loading' | 'shown' | 'rejected';
export type AiLineRejectReason = 'outsideBand' | 'todayMismatch';
export type AiLineVM = {
  status: AiLineStatus;
  /** Only when status is 'shown'; net worth per plan year in the display unit. */
  points?: { year: number; netWorth: Money }[];
  /** Always "AI estimate". */
  label: string;
  /** Only when status is 'rejected'. */
  reason?: AiLineRejectReason;
  reasonMessage?: string;
};
