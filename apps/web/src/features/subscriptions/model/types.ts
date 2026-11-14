// View-model types for the subscription audit (S21, `/tools/subscriptions`). Task: M5 (issue #81).
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced).
// Hook: useSubscriptions (./useSubscriptions.ts). The pure parts are in ./audit.ts.
import type { MoveCandidate } from '@lifeguessr/engine';
import type {
  Cadence, ChargeDate, ForecastSource, MissBucket, Money, ServiceCategory, Source, SubscriptionFlag,
} from '@lifeguessr/types';
import type { StatementFileProblem } from '@/features/upload/model/types';
import type { DownloadOutcome } from '@/lib/download';
import type { EstimatedMoney, Loadable, VMError } from '@/lib/model/types';

export type { EstimatedMoney, Loadable, VMError } from '@/lib/model/types';
export type { DownloadOutcome } from '@/lib/download';
export type {
  Cadence, ChargeDate, ForecastSource, MissBucket, Money, ServiceCategory, Source, SubscriptionFlag,
} from '@lifeguessr/types';

/** The flow, in order. A person can move between the steps that are available. */
export type SubscriptionsStep = 'guess' | 'ticks' | 'reveal' | 'statement' | 'findings' | 'plan';
export type StepVM = { id: SubscriptionsStep; available: boolean };

/** A failure of the statement path: the S9 messages (`unreadable` = the file could not be used) or a server error. */
export type StatementErrorVM = VMError | { kind: 'unreadable'; reason: StatementFileProblem };

// ----- ticks -------------------------------------------------------------------------------------

export type TickPlanVM = {
  id: string;
  name: string;
  /** Per `cadence`, catalogue price. */
  price: Money;
  cadence: Cadence;
  /** The price per month (a yearly plan ÷ 12). */
  monthly: Money;
};

/** One service of the tick-list, with the plan shown (the ticked one, or the default while not ticked). */
export type TickServiceVM = {
  serviceId: string;
  name: string;
  category: ServiceCategory;
  ticked: boolean;
  /** The ticked plan, or the default plan while the service is not ticked. */
  plan: TickPlanVM;
  /** Every plan that costs something; more than one = the person can pick. */
  plans: TickPlanVM[];
  /** The year the catalogue price is from ("catalogue price, 2026"). */
  priceYear: number;
  source: Source;
  /** Always true: a tick is not a charge anyone has shown, so its price is an estimate even when the catalogue's own price was checked. */
  isEstimate: boolean;
};

export type TickGroupVM = { category: ServiceCategory; services: TickServiceVM[] };

export type TicksVM = {
  groups: TickGroupVM[];
  count: number;
  /** What the ticks cost: catalogue prices, per month and per year. */
  monthly: Money;
  yearly: Money;
  /**
   * Tick a service (with `planId`, or its default plan), untick it (it is ticked and no other plan
   * is asked for), or change its plan (ticked, another `planId`).
   */
  toggle: (serviceId: string, planId?: string) => void;
};

// ----- reveal ------------------------------------------------------------------------------------

/**
 * The guess against the actual total. `against` says which total: the ticks (catalogue prices), or
 * once a statement is read, the statement's counted findings (like with like). `missFactor` is null
 * without a guess or when the total is 0: then the screen shows the total alone.
 */
export type RevealVM = {
  guess: Money | null;
  against: 'ticks' | 'statement';
  /** The total compared with the guess, per month and per year. */
  actual: Money;
  actualYearly: Money;
  /** Always the ticks, whatever `against` says. */
  ticks: { count: number; monthly: Money; priceYear: number | null };
  statement: { monthly: Money; yearly: Money; monthsCovered: number } | null;
  missFactor: number | null;
  miss: MissBucket | null;
  /** How far apart the guess and `actual` are, per month, to the cent. Null without a guess. */
  gap: Money | null;
  /** The guess below, near or above the total (bucket under 0.8, 0.8 to 1.25, above). Null with no `miss`. */
  direction: 'lower' | 'close' | 'higher' | null;
  survey: { guessed: Money; itemized: Money; source: Source };
};

// ----- statement and findings --------------------------------------------------------------------

export type StatementVM = {
  /** 'done' = a statement was read and its findings are kept. */
  status: 'idle' | 'reading' | 'done' | 'error';
  error: StatementErrorVM | null;
  /** Calendar months with at least one line in the statement (0 before one is read). */
  monthsCovered: number;
  /** Under 2 months: little can be told from it, so most findings are `medium` confidence. */
  isShort: boolean;
  /** The latest day in the statement. */
  asOf: ChargeDate | null;
  /** Read a CSV on this device and look for recurring charges. Needs the network (the categorizer). */
  upload: (file: File) => void;
  /** Read the sample statement (a made-up export, fixture) the same way, for a first look without a CSV. */
  trySample: () => void;
  dismissError: () => void;
};

/** A finding as the UI shows it. */
export type FindingVM = {
  id: string;
  /** The catalogue's service name when known, else the label. */
  name: string;
  /** The masked statement label (a service name for a tick). */
  label: string;
  serviceId: string | null;
  category: ServiceCategory;
  cadence: Cadence;
  /** Per `cadence`. */
  amount: Money;
  monthly: Money;
  yearly: Money;
  chargesSeen: number;
  lastCharge: ChargeDate | null;
  nextExpected: ChargeDate | null;
  status: 'active' | 'stopped';
  flags: SubscriptionFlag[];
  /** With `priceUp`: what it was before. */
  previousAmount: Money | null;
  /** With `overlap`: how many other findings overlap it. */
  overlapCount: number;
  confidence: 'high' | 'medium' | 'low';
  origin: 'statement' | 'tickList';
  /** True for a ticked service (a catalogue price); false for a charge seen in the statement. */
  isEstimate: boolean;
  /** In the totals: active, and not low confidence unless confirmed. */
  counted: boolean;
  /** Found in the statement but not ticked (only once something was ticked). */
  forgotten: boolean;
  markedCancel: boolean;
};

export type FindingsVM = {
  /** Counted statement findings, costliest first. */
  active: FindingVM[];
  /** Low confidence, not confirmed: "looks recurring, is it a subscription?". Not in any total. */
  toConfirm: FindingVM[];
  /** Not charged recently. Not in any total. */
  stopped: FindingVM[];
  /** Ticked, but not in this statement. Counted in the plan as estimates. */
  tickedOnly: FindingVM[];
  /** The statement's counted findings: how many, and what they cost. */
  found: number;
  monthly: Money;
  yearly: Money;
  /** Services ticked. */
  ticked: number;
  forgotten: number;
  /** Statement findings with at least one flag. */
  flagged: number;
  /** Findings the person said are not subscriptions (hidden). */
  dismissedCount: number;
  /** Yes: it is a subscription; it counts from now on. Only for a `toConfirm` finding. */
  confirm: (id: string) => void;
  /** No: not a subscription; hidden and never counted. */
  dismiss: (id: string) => void;
  restoreDismissed: () => void;
};

// ----- plan --------------------------------------------------------------------------------------

/** The 10-year effect of cancelling what is marked: the same forecast as Next Moves, today's dollars. */
export type CancelEffectVM = { effect10y: Money; source: ForecastSource };

export type PlanVM = {
  /** What can be marked: the counted findings (statement findings, then ticked-only services). */
  options: FindingVM[];
  markedCount: number;
  /**
   * What the marked ones cost; null when none is marked. `isEstimate`: a marked line is a ticked
   * (catalogue) price or a charge below high confidence, so the numbers carry the estimate tag.
   */
  saving: { monthly: Money; yearly: Money; isEstimate: boolean } | null;
  /**
   * The move the plan would be, for `useCancelResult` to measure: null when nothing is marked. This hook
   * itself never asks the forecast: only a screen with something marked does.
   */
  candidate: MoveCandidate | null;
  /** The profile's subscriptions line, which the move lowers. */
  profileSubscriptions: EstimatedMoney;
  /** False when the profile holds less for subscriptions than is marked: the 10-year number counts only what it holds. */
  profileCovers: boolean;
  /** The profile is the sample one (nothing entered yet): the 10-year number is for it, not for the person. */
  isSampleProfile: boolean;
  markCancel: (id: string) => void;
  unmarkCancel: (id: string) => void;
  /** The committed move is this cancel plan, exactly as it stands now (same marks, same subscriptions line). */
  moveAdded: boolean;
  /** The committed move is an earlier version of this cancel plan: the marks or the profile's line changed since. Add it again to update it. */
  moveOutdated: boolean;
};

/** The 10-year number of the marked plan and the way to add it as the next move (`useCancelResult`). */
export type CancelResultVM = {
  /** Null without a candidate. 'ready' with `effect10y` 0 = below $1, not worth a move. */
  effect: Loadable<CancelEffectVM> | null;
  canAddAsMove: boolean;
  addAsMove: () => void;
};

/** "Use this in my plan": what would change in the profile, from and to. Nothing changes until `applyToProfile`. */
export type ApplyVM = {
  canApply: boolean;
  from: EstimatedMoney;
  /** The counted total per month; an estimate while any ticked service (a catalogue price) is in it. */
  to: EstimatedMoney;
  /** The profile already holds this total. */
  inPlan: boolean;
  applyToProfile: () => void;
};

export type RenewalsVM = {
  /** Upcoming renewals the calendar file would hold (active statement findings with a next date). */
  count: number;
  canExport: boolean;
  /** What the last export did; null before one. */
  outcome: DownloadOutcome | null;
  exportCalendar: () => void;
};

// ----- the whole tool ----------------------------------------------------------------------------

export type SubscriptionsVM = {
  /** 'loading' until the saved state is read. */
  status: 'loading' | 'ready';
  step: SubscriptionsStep;
  steps: StepVM[];
  goTo: (step: SubscriptionsStep) => void;
  next: () => void;
  back: () => void;
  guess: {
    value: Money | null;
    presets: readonly Money[];
    /** null clears it. A guess of 0 is a guess. */
    set: (value: Money | null) => void;
  };
  ticks: TicksVM;
  /** Something to compare the guess with: a tick or a statement. */
  canReveal: boolean;
  reveal: RevealVM;
  statement: StatementVM;
  findings: FindingsVM;
  plan: PlanVM;
  apply: ApplyVM;
  renewals: RenewalsVM;
  /** Anything is saved in this browser. */
  hasLocalData: boolean;
  /** Forget the guess, ticks, choices and findings kept in this browser. */
  clearLocalData: () => void;
};
