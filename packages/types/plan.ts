// Planner contracts (MP2, epic #160): accounts, plan events, scenarios, the yearly plan, Monte Carlo,
// budget and cash flow. Zod schemas are in ./schemas.ts (same names + `Schema`); fixtures in
// packages/data/fixtures (accounts.demo.json, scenario.*.json, plan.demo.json, monteCarlo.demo.json,
// transactions.demo.json), loaded by packages/data/fixtures/plan.ts.
//
// Units as everywhere: Money is unrounded US dollars (each field says monthly, yearly or balance),
// Rate is a decimal per year (0.065 = 6.5%). Plan event amounts are in today's dollars, like LifeEvent.
// Privacy (CLAUDE.md rule 6): account names, event names and transactions stay in the browser. The one
// exception: "Estimate with AI" sends one account's name, type and value when the person taps it (not stored).
import type {
  AreaData, CostCategory, Debt, Estimate, LifeEvent, Money, Profile, Rate, StatementClass, YearMonth,
} from './index';

// ----- Accounts (P2) -------------------------------------------------------------------------

export const ASSET_GROUPS = ['cash', 'investments', 'retirement', 'realEstate', 'vehicle', 'otherAsset'] as const;
export const LIABILITY_GROUPS = ['creditCard', 'loan', 'mortgage'] as const;
export const ACCOUNT_GROUPS = [...ASSET_GROUPS, ...LIABILITY_GROUPS] as const;
export type AccountGroup = (typeof ACCOUNT_GROUPS)[number];
export type AssetGroup = (typeof ASSET_GROUPS)[number];
export type LiabilityGroup = (typeof LIABILITY_GROUPS)[number];

export type Account = {
  id: string;
  group: AccountGroup;
  name: string;                     // user's label; stays in the browser (sent only by an explicit "Estimate with AI" tap, not stored)
  balance: Estimate<Money>;         // BALANCE, always ≥ 0; the sign comes from the group
  apr?: Rate;                       // liabilities only
  minPayment?: Estimate<Money>;     // monthly, liabilities only
  debtKind?: Debt['kind'];          // loan only: auto | student | personal | bnpl
  growth?: Rate;                    // per year; override of the group default (home appreciation, car depreciation < 0)
  growthNote?: AiGrowthNote;        // set only while `growth` is the AI estimate the person accepted; dropped when they type their own
  excluded?: boolean;               // left out of net worth and the plan
  history: { month: YearMonth; balance: Money }[]; // one point per month with an edit (last edit wins), for the balance chart
};

/**
 * Marks a growth rate an AI proposed ("Estimate with AI") and keeps its one-line reason, so the UI can
 * label it "AI estimate" wherever it shows. The rate itself is the plain `growth` value next to it; the
 * engine reads only that and does every projection itself. Spec: docs/ENGINEERING.md → AI growth estimate.
 */
export type AiGrowthNote = { source: 'ai'; reason: string };

/** Asset groups whose accounts have a yearly-change field (cash has none: it earns the cash yield). */
export const GROWTH_ESTIMATE_ACCOUNT_GROUPS = ['investments', 'retirement', 'realEstate', 'vehicle', 'otherAsset'] as const;
export type GrowthEstimateAccountGroup = (typeof GROWTH_ESTIMATE_ACCOUNT_GROUPS)[number];

/**
 * POST /api/ai/growth. 'account': one account's type, the name the person typed and its value (nothing
 * else about them). 'plan': the area (metro and state, no ZIP), account totals by group (no names) and the
 * engine's current default per group, for a suggestion per group. Nothing is stored on the server.
 */
export type GrowthEstimateRequest =
  | { mode: 'account'; account: { group: GrowthEstimateAccountGroup; name: string; value: Money } }   // value: a BALANCE
  | {
      mode: 'plan';
      area?: { metro: string; state: string };
      groups: { group: AssetGroup; total: Money; count: number }[];   // total: a BALANCE
      defaults: Record<AssetGroup, Rate>;                              // per year: what plan() uses today
    };
/** One AI-proposed rate (per year, a decimal) that passed the envelope (aiGrowthEnvelope), with its reason. */
export type GrowthEstimate = { group: AssetGroup; rate: Rate; reason: string };
/** 200 from /api/ai/growth. `rejected`: groups whose proposal failed the checks (their default stays). */
export type GrowthEstimateResponse = { ok: true; source: 'ai'; estimates: GrowthEstimate[]; rejected: AssetGroup[] };

/** netWorthSummary(accounts) (MP8). Excluded accounts are left out. All values are balances. */
export type NetWorthSummary = {
  netWorth: Money;                  // assets.total − liabilities.total
  assets: { total: Money; byGroup: Partial<Record<AssetGroup, Money>> };
  liabilities: { total: Money; byGroup: Partial<Record<LiabilityGroup, Money>> };
  change1m: Money | null;           // net worth change over the last month, from `history`; null without a point a month back
};

// ----- Plan events (P8): every amount in today's dollars ------------------------------------

export const PLAN_EVENT_TYPES = [
  'income', 'expense', 'buyHome', 'haveKid', 'newJob', 'careerBreak', 'windfall', 'retire', 'socialSecurity',
] as const;
export type PlanEventType = (typeof PLAN_EVENT_TYPES)[number];
type PlanEventBase = { id: string; type: PlanEventType; year: number; enabled: boolean; name?: string };
export type PlanEvent = PlanEventBase & (
  | { type: 'income'; monthly: Money; endYear?: number }
  | { type: 'expense'; amount: Money; cadence: 'once' | 'monthly'; endYear?: number;
      financing?: { downPayment: Money; apr: Rate; termMonths: number } }      // = old Can I Afford It?
  | { type: 'buyHome'; homeValue: Money; downPayment: Money; payCash: boolean;
      termYears: 15 | 30; rate: Rate; propertyTaxRate: Rate;                  // tax: per year, share of value
      insuranceMonthly: Estimate<Money>;                                      // AreaData.homeInsuranceMonthly
      upkeepRate: Rate; replaceHousing: boolean }                             // upkeep: per year, share of value
  | { type: 'haveKid'; childcareMonthly: Estimate<Money>; childcareYears: number; otherMonthly: Estimate<Money> }
  | { type: 'newJob'; takeHomePay: Money }                                    // monthly
  | { type: 'careerBreak'; endYear: number }
  | { type: 'windfall'; amount: Money }
  | { type: 'retire' }                                // year derived from assumptions.retireAge by default
  | { type: 'socialSecurity'; monthly: Estimate<Money> }
);
/** The plan event of one type, e.g. `PlanEventOf<'buyHome'>`. */
export type PlanEventOf<T extends PlanEventType> = Extract<PlanEvent, { type: T }>;

/** What defaultEvent / expandEvent read (MP4). Events start in January of their year, or `asOf` in the current year. */
export type PlanEventContext = { profile: Profile; area?: AreaData; assumptions: PlanAssumptions; asOf: YearMonth };
/** expandEvent(event, ctx) (MP4): the primitives simulate() understands. `month` counts from `asOf` (0 = now). */
export type ExpandedEvent = {
  lifeEvents: LifeEvent[];
  debts: Debt[];
  assets: { group: AccountGroup; month: number; value: Money }[];   // value: a BALANCE added that month
};
/** buyHomeBreakdown(event) (MP4): the monthly payment the event panel shows, so UI and engine never disagree. */
export type BuyHomeBreakdown = { principalAndInterest: Money; propertyTax: Money; insurance: Money; total: Money }; // monthly
/** expenseFinancingBreakdown(event) (MP4): a financed expense; null from the function when the event has no financing. */
export type ExpenseFinancingBreakdown = {
  downPayment: Money;               // paid once, at the start
  financed: Money;                  // amount − downPayment (a BALANCE)
  monthlyPayment: Money;            // monthly, amortized over termMonths
  totalInterest: Money;
};

// ----- Assumptions + scenarios ---------------------------------------------------------------

export type PlanAssumptions = {
  retireAge: number;                 // default 67
  endAge: number;                    // default 90 ("End of plan")
  inflation: Rate;                   // default AreaData.cpiYoY ?? 0.03
  display: 'today' | 'future';       // today's dollars (default) or future dollars
  expenses: { mode: 'budget' } | { mode: 'manual'; monthly: Money };
  growth: Partial<Record<AccountGroup, Rate>>;            // overrides of engine defaults
  growthNotes?: Partial<Record<AssetGroup, AiGrowthNote>>; // which overrides are an accepted AI estimate (and why)
  withdrawalOrder: AccountGroup[];                        // default cash → investments → retirement
  savingsSplit: { group: AccountGroup; share: Rate }[];   // shares sum to 1; default from profile.retirementShare
};
export type Scenario = { id: string; name: string; icon?: string; assumptions: PlanAssumptions; events: PlanEvent[] };

// ----- Plan output (MP3) ---------------------------------------------------------------------

/** One account over one plan year; every value in the plan's display unit. */
export type PlanAccountRow = { accountId: string; start: Money; growth: Money; deposits: Money; withdrawals: Money; end: Money };
export type PlanYear = {
  year: number; age: number;
  netWorth: Money; assets: Money; liabilities: Money;   // year-end balances; liabilities ≥ 0
  shortfall: Money;                  // unfunded expenses so far (a BALANCE, ≥ 0)
  accounts: PlanAccountRow[];
  cashFlow: { income: { key: string; amount: Money }[]; expenses: { key: string; amount: Money }[];
              withdrawals: Money; net: Money };     // per YEAR
  events: string[];                  // ids of events that start this year
};
export type PlanKpis = { netWorthEndOfYear: Money; netWorthAtRetirement: Money; retireAge: number;
  netWorthAtEnd: Money; shortfallAge: number | null };
export type PlanResult = { years: PlanYear[]; kpis: PlanKpis; display: 'today' | 'future'; source: 'rules' };

// ----- Scenarios, Compare, moves on the plan (MP6) -------------------------------------------
// Every money value is in the plans' display unit. Differences are B − A. No text: the UI words them.

/** Net worth of plans A and B in one calendar year; diff = b − a. */
export type CompareYear = { year: number; a: Money; b: Money; diff: Money };
/** One KPI of both plans; diff = b − a, null when either value is null (shortfallAge null = money lasts). */
export type CompareKpi = { key: keyof PlanKpis; a: number | null; b: number | null; diff: number | null };
/**
 * The data behind the Compare sentence ("Plan B leaves you $34K richer by 2036"), read in the year A
 * retires: `leader` is the plan with more net worth that year (null when they differ by less than
 * COMPARE_TIE), `amount` the gap (≥ 0), `since` the first year from which the leader stays ahead
 * through `year` (null without a leader).
 */
export type CompareSentenceData = { leader: 'a' | 'b' | null; amount: Money; year: number; age: number; since: number | null };
/** compareScenarios(a, b) (MP6). */
export type ScenarioComparison = {
  years: CompareYear[]; kpis: CompareKpi[];
  firstYearBAhead: number | null;    // first year B's net worth beats A's by COMPARE_TIE or more
  sentence: CompareSentenceData;
};
/** planMoveEffects (MP6): a Next Move measured on one scenario's plan (with the move − without). */
export type PlanMoveEffect = {
  moveId: string;
  effectAtRetirement: Money;         // change in PlanKpis.netWorthAtRetirement
  effectAtEnd: Money;                // change in PlanKpis.netWorthAtEnd
  successRateDelta?: Rate;           // change in Monte Carlo successRate, same seed; top 3 only, when Monte Carlo settings are given
};
/** previewEvent (MP6): the plan with the event on vs without it, for the event panel. */
export type EventPreview = {
  withEvent: PlanKpis;
  without: PlanKpis;
  leftOverMonthly: Money;            // monthly: average take-home − spending − debt payments in the event's first plan year, with it
};

/**
 * decisionSweep (home "Life line" hero): one event of a scenario moved to one candidate year. `plan` is
 * plan() of that scenario; `chance` is monteCarlo() of it with the sweep's fixed seed (the same draws at
 * every year, so a change in successRate is the move's, not noise), absent when no settings were given.
 */
export type DecisionSweepPoint = {
  year: number; age: number;
  plan: PlanResult;
  chance?: { successRate: Rate; bands: { year: number; p10: Money; p90: Money }[] };
};

// ----- Monte Carlo (P10, MP5) ----------------------------------------------------------------

export type MonteCarloSettings = {
  paths: number;                     // default 1000, max 5000
  seed: number | null;               // null = new seed each run (the result returns the one used)
  inflation: { mean: Rate; sd: Rate };                       // default { cpi, 0.02 }
  growth: Partial<Record<AccountGroup, { mean: Rate; sd: Rate }>>;
  endThreshold: Money;               // success: net worth at end ≥ this AND shortfall never > 0
};
export type HistogramBin = { from: number; to: number; count: number };
export type MonteCarloResult = {
  paths: number; seed: number; successRate: Rate;           // successRate: share of paths, 0–1
  bands: { year: number; p10: Money; p50: Money; p90: Money;
           p5?: Money; p95?: Money }[];                     // p5/p95 (MP5): the band the AI line is checked against
  samplePaths: { success: boolean; netWorth: Money[] }[];   // ≤ 200 paths for drawing
  histograms: { atRetirement: HistogramBin[]; atEnd: HistogramBin[]; shortfallAge: HistogramBin[] };
  pathsWithoutShortfall?: number;    // MP5: paths left out of histograms.shortfallAge (never short)
};

// ----- Budget (P5, MP9) ----------------------------------------------------------------------

/** Monthly amounts; `remaining` = planned − actual. */
export type BudgetRow = { category: CostCategory; planned: Money; actual: Money; remaining: Money;
  expectedByToday: Money; status: 'under' | 'onPace' | 'over' };
/** The income line of the budget table: a BudgetRow without a cost category. */
export type BudgetIncomeRow = Omit<BudgetRow, 'category'>;
export type BudgetTotals = { planned: Money; actual: Money; remaining: Money; expectedByToday: Money };
/** How far into the month "today" is, for expectedByToday. */
export type BudgetDay = { day: number; daysInMonth: number };
/** budgetRows / budgetRowsForYear (MP9). */
export type BudgetTable = { income: BudgetIncomeRow; rows: BudgetRow[]; totals: BudgetTotals };

// ----- Cash Flow (P4, MP9) -------------------------------------------------------------------

export type CashFlowPeriod = { from: YearMonth; to: YearMonth };   // inclusive
export type CashFlowSummary = {
  period: CashFlowPeriod;
  income: Money; expenses: Money; savings: Money; savingsRate: Rate | null;   // sums over the period; null when income = 0
  byCategory: { category: CostCategory; amount: Money }[];
  sankey: { nodes: { id: string; kind: 'income' | 'total' | 'category' | 'savings' }[];
            links: { source: string; target: string; value: Money }[] };
};

// ----- Transactions (P3), browser only -------------------------------------------------------

/**
 * One statement line on the Transactions page. Browser only, never sent (rule 6). Named apart from
 * the CSV reader's `Transaction` (amount > 0 = money out): here amount > 0 = money IN, < 0 = out.
 */
export type LedgerTransaction = { id: string; date: string /* YYYY-MM-DD */; label: string; amount: Money; // + in, − out
  accountId?: string; cls: StatementClass; categoryOverridden: boolean; goalId?: string };
