// Every constant the engine uses, in one place (docs/ENGINEERING.md → Default assumptions).
// Each carries a `source` or `assumption: true`; the UI lists them in a "How we calculate" panel.
// Rates are decimals per year. `note` is developer documentation, not user-facing copy.
import type { CostCategory, Money, Rate, Source } from '@lifeguessr/types';

export type Assumption<T> =
  | { value: T; source: Source; assumption?: false; note?: string }
  | { value: T; assumption: true; source?: Source; note?: string };

/** Fallback inflation when an area has no CPI. Normally `AreaData.cpiYoY` (BLS CPI-U) is used. */
export const inflationAnnualFallback = {
  value: 0.03 as Rate,
  assumption: true,
  note: 'Used only when AreaData.cpiYoY is missing; the real value comes from BLS CPI-U per area.',
} satisfies Assumption<Rate>;

/** Pay keeps pace with prices: income growth = inflationAnnual (real income flat). */
export const incomeGrowthAnnual = {
  value: 'inflationAnnual' as const,
  assumption: true,
  note: 'Income grows at the same rate as inflation. Raises are a decision, not a default.',
} satisfies Assumption<'inflationAnnual'>;

/** Nominal yearly return of the savings/retirement blend. */
export const returnAnnualNominal = {
  value: 0.06 as Rate,
  assumption: true,
  note: 'Blend of savings and retirement investments, nominal, before inflation.',
} satisfies Assumption<Rate>;

/** Yearly yield on cash. */
export const cashYieldAnnual = {
  value: 0.03 as Rate,
  assumption: true,
} satisfies Assumption<Rate>;

/**
 * Default card APR when the user does not give one. Federal Reserve G.19, interest rate on credit
 * card plans, accounts assessed interest, Q3 2026. DATA.md: prefer G.19 when it disagrees with
 * CardRates (the 22.8% draft figure could not be verified).
 */
export const cardAprDefault = {
  value: 0.2236 as Rate,
  source: {
    name: 'Federal Reserve G.19, credit card plans, accounts assessed interest, Q3 2026',
    year: 2026,
    url: 'https://www.federalreserve.gov/releases/g19/current/default.htm',
  },
} satisfies Assumption<Rate>;

/** Card minimum payment when the user skips it: interest for the month + 1% of balance, floor $25. */
export const cardMinPayment = {
  value: { balanceShare: 0.01, includesInterest: true, floor: 25 as Money },
  assumption: true,
  note: 'Typical issuer formula.',
} satisfies Assumption<{ balanceShare: number; includesInterest: boolean; floor: Money }>;

/** Share of a positive monthly surplus saved to retirement by default. */
export const retirementShareDefault = {
  value: 0 as Rate,
  assumption: true,
  note: 'Take-home pay is already after payroll retirement contributions; the user can raise it.',
} satisfies Assumption<Rate>;

/** ± spread applied to every `isEstimate` field to build the range band (and card cost ranges). */
export const estimateSpread = {
  value: 0.15,
  assumption: true,
  note: 'The band shows uncertainty in the inputs only, not market or inflation risk.',
} satisfies Assumption<number>;

/** Debt load (monthly debt payments / take-home pay): green < 0.20, yellow 0.20–0.36, red > 0.36. */
export const debtLoadThresholds = {
  value: { yellow: 0.2, red: 0.36 },
  assumption: true,
  note: 'Common lending rule of thumb; shown as guidance.',
} satisfies Assumption<{ yellow: number; red: number }>;

/** Can I Afford It?: month-end cash must stay at or above this many months of spending. */
export const safetyCushionMonths = {
  value: 1,
  assumption: true,
} satisfies Assumption<number>;

/** Game: each opened clue lowers the score multiplier by this much. Game tuning, not finance. */
export const clueCost = {
  value: 0.1,
  assumption: true,
  note: 'Tune after playtests.',
} satisfies Assumption<number>;

/** Game: the clue multiplier never goes below this. */
export const clueFloor = {
  value: 0.5,
  assumption: true,
  note: 'Tune after playtests.',
} satisfies Assumption<number>;

// ----- Y1: life cards and scoring (costOfLife, cardToProfile, scoreGuess) ----------------------

/**
 * Source shown on a cost line that rests on an assumption with no published source yet (for
 * example eating out, which uses `avgMealPrice`). Not an Assumption itself: it labels one.
 */
export const assumptionSource: Source = {
  name: 'LifeGuessr default assumption (listed under "How we calculate")',
  year: 2026,
};

/** Source shown on the car loan payment of a life card: computed from the card's own loan terms. */
export const lifeCardLoanSource: Source = {
  name: "Life card's own car price, down payment, APR and term (amortized monthly payment)",
  year: 2026,
};

/** Game: points for a guess inside the card's range; 0 at 2× off the nearest edge. */
export const guessMaxPoints = {
  value: 1000,
  assumption: true,
  note: 'Game scale from ENGINEERING.md → Guess scoring, not finance.',
} satisfies Assumption<number>;

/** Closest Life: age when the user has not given one. */
export const ageDefault = {
  value: 35,
  assumption: true,
  note: 'Middle of the 25–45 target audience. The balance sheet (S8) asks for the real age.',
} satisfies Assumption<number>;

/**
 * Closest Life: monthly spending (all categories + debt payments) as a share of take-home pay, so
 * take-home pay = outflow / share. A card has no income, so the default assumes the person behind
 * it lives on their pay and saves the rest, instead of a national figure unrelated to the card.
 */
export const cardSpendingShareOfTakeHome = {
  value: 0.9,
  assumption: true,
  note: 'Saves about 10% of take-home pay. Placeholder until T2 sources a spending/after-tax-income ratio (BLS CE).',
} satisfies Assumption<number>;

/** Closest Life: cash on hand, in months of monthly outflow (spending + debt payments). */
export const cashBufferMonthsDefault = {
  value: 2,
  assumption: true,
  note: 'Above safetyCushionMonths so a defaulted profile does not fail Can I Afford It? by construction.',
} satisfies Assumption<number>;

/** Closest Life: retirement balance when the user has not given one. */
export const retirementBalanceDefault = {
  value: 30_000 as Money,
  assumption: true,
  note: 'Placeholder between the Fed SCF 2022 median retirement balances for families under 35 and 35–44 that hold one; verify in T2.',
} satisfies Assumption<Money>;

/** Closest Life: monthly subscriptions (streaming, apps, memberships) for a household. */
export const subscriptionsMonthlyDefault = {
  value: 90 as Money,
  assumption: true,
  note: 'Placeholder; the Quick Sliders (S7) and a statement upload replace it.',
} satisfies Assumption<Money>;

/** Closest Life: monthly "other" spending (phone, clothing, personal care, household, out-of-pocket health) per adult. */
export const otherPerAdultMonthly = {
  value: 350 as Money,
  assumption: true,
  note: 'Placeholder until T2 sources it from BLS CE; a statement upload replaces it.',
} satisfies Assumption<Money>;

/** Closest Life: monthly "other" spending per child (clothing, school, activities). */
export const otherPerKidMonthly = {
  value: 150 as Money,
  assumption: true,
  note: 'Placeholder until T2 sources it from BLS CE / USDA expenditures on children.',
} satisfies Assumption<Money>;

/** The Y1 assumptions, spread into `assumptions` below. */
export const lifeCardAssumptions = {
  guessMaxPoints,
  ageDefault,
  cardSpendingShareOfTakeHome,
  cashBufferMonthsDefault,
  retirementBalanceDefault,
  subscriptionsMonthlyDefault,
  otherPerAdultMonthly,
  otherPerKidMonthly,
} as const;

// ----- end Y1 ---------------------------------------------------------------------------------

/** Average price of one meal or delivery order eaten out, per person-occasion. */
export const avgMealPrice = {
  value: 18 as Money,
  assumption: true,
  note: 'Placeholder until T2 sources it from BLS CE (food away from home) / national averages.',
} satisfies Assumption<Money>;

/** Gallons of gasoline per car per month. */
export const monthlyGallons = {
  value: 45,
  assumption: true,
  note: 'About 13,500 miles a year at about 25 mpg; replace with a sourced FHWA/EPA figure in T2.',
} satisfies Assumption<number>;

/** Groceries for one child as a share of one adult's groceries. */
export const kidGroceryFactor = {
  value: 0.7,
  assumption: true,
  note: 'Placeholder until sourced from the USDA food plans (child age groups vs adult 19–50).',
} satisfies Assumption<number>;

/** Weeks per month used to turn "per week" into "per month" (ENGINEERING.md: 4.33). */
export const weeksPerMonth = {
  value: 4.33,
  assumption: true,
  note: '52 weeks / 12 months, rounded as in the spec.',
} satisfies Assumption<number>;

/** The forecast always simulates at least this many months so `in10y` (month 120) exists. */
export const minForecastMonths = {
  value: 120,
  assumption: true,
  note: 'Product rule: "You in 10 years".',
} satisfies Assumption<number>;

// ----- Y3: Next Moves (rankMoves) -------------------------------------------------------------

/** Next Moves, payCardFirst: share of this month's surplus put toward the card as an extra payment. */
export const payCardExtraShareOfSurplus = {
  value: 0.5,
  assumption: true,
  note: 'Half of what is left after spending and minimum payments; the other half keeps building cash. Capped by the card balance.',
} satisfies Assumption<number>;

/** Next Moves, payCardFirst: the extra payment is rounded down to a multiple of this many dollars. */
export const payCardExtraStep = {
  value: 10 as Money,
  assumption: true,
  note: 'A round amount a person can set up ("pay $250 extra a month"); not a financial input.',
} satisfies Assumption<Money>;

/** Next Moves, cutCategory: share cut from the largest discretionary category (spec: 20%). */
export const cutCategoryShare = {
  value: 0.2,
  assumption: true,
  note: 'ENGINEERING.md → Next Moves.',
} satisfies Assumption<number>;

/** Next Moves, cancelSubscriptions: share of statement-detected subscription spend cancelled. */
export const cancelSubscriptionsShare = {
  value: 0.5,
  assumption: true,
  note: 'Cancel the ones you no longer use and keep the rest. Placeholder until sourced; the statement gives totals, not which ones are unused.',
} satisfies Assumption<number>;

/** The Y3 assumptions, spread into `assumptions` below. */
export const movesAssumptions = {
  payCardExtraShareOfSurplus,
  payCardExtraStep,
  cutCategoryShare,
  cancelSubscriptionsShare,
} as const;

// ----- end Y3 ---------------------------------------------------------------------------------

// ----- T9: month-end (monthEnd) ----------------------------------------------------------------

/** Month-end: full months of statement history needed before there is a "usual" to drift from. */
export const monthEndHistoryMonths = {
  value: 3,
  assumption: true,
  note: 'ENGINEERING.md → Month-end: the average of the last 3 full months. Fewer months: no average, no drift flags.',
} satisfies Assumption<number>;

/**
 * Month-end: categories paid in one lump a month (or close to it), projected as
 * max(spent so far, usual) instead of extrapolated from the days elapsed, which would multiply a
 * rent paid on the 1st by the days in the month. `car` mixes a fixed monthly insurance bill with
 * variable gas, so it is floored at usual and not extrapolated either.
 */
export const monthEndBillCategories = {
  value: ['rentUtilities', 'childcare', 'subscriptions', 'car'] as readonly CostCategory[],
  assumption: true,
  note: 'Usual = the 3-month average, or the profile value with less history. Every other category is extrapolated linearly.',
} satisfies Assumption<readonly CostCategory[]>;

/** Month-end: a drift is flagged when |projection − average| > max(std dev, this share × average, minSpread). */
export const monthEndDriftSpreadShare = {
  value: 0.1,
  assumption: true,
  note: 'ENGINEERING.md → Month-end: spread = max(std dev, 10% of average).',
} satisfies Assumption<number>;

/** Month-end: the smallest drift ever flagged, so a few dollars in a usually empty category is not "drift". */
export const monthEndDriftMinSpread = {
  value: 25 as Money,
  assumption: true,
  note: 'Without it a category averaging $0 would flag any charge at all.',
} satisfies Assumption<Money>;

/** The T9 assumptions, spread into `assumptions` below. */
export const monthEndAssumptions = {
  monthEndHistoryMonths,
  monthEndBillCategories,
  monthEndDriftSpreadShare,
  monthEndDriftMinSpread,
} as const;

// ----- statements (T7): which charges count as one-offs -----------------------------------------
// A one-off (a vet bill, a yearly membership) is kept out of the monthly category totals so it
// doesn't inflate the averages that replace the estimates. Only a merchant that appears in one
// month of a statement covering two or more months can be a one-off; rent, childcare and debt
// payments never are. Then either the categorizer says the merchant is typically one-off or
// yearly, or the charge is an outlier for its category.

/** Smallest charge a "typically one-off or yearly" merchant hint applies to (coffee isn't a one-off). */
export const oneOffHintMinAmount = {
  value: 50 as Money,
  assumption: true,
  note: 'Below this, a charge is too small to distort a monthly average.',
} satisfies Assumption<Money>;

/** Smallest charge the outlier rule flags without a merchant hint. */
export const oneOffOutlierMinAmount = {
  value: 400 as Money,
  assumption: true,
} satisfies Assumption<Money>;

/** The outlier rule: at least this many times the median charge of the same category in the statement. */
export const oneOffOutlierMultiple = {
  value: 5,
  assumption: true,
} satisfies Assumption<number>;

// ----- Y15: AI forecast sanity envelope (anchors.ts) -------------------------------------------

/** How far an AI forecast may stray from the rules forecast before it is rejected. */
export type AiForecastSanity = {
  /** Yearly mid may lie this share of |rules mid| outside the rules band. */
  relative: number;
  /** The tolerance never goes below this many months of take-home pay (net worth near 0 or a zero band). */
  floorMonths: number;
  /** The AI band may be this many times as wide as the rules band; the limit never goes below the tolerance. */
  bandMaxRatio: number;
  /** A scenario's 10-year effect must be between these multiples of the rules effect (same sign)... */
  effectRatioMin: number;
  effectRatioMax: number;
  /** ...unless it is within this many dollars of it. */
  effectFloor: Money;
};

/**
 * Guards against wrong-unit or runaway model answers (thousands, ×10, a flipped sign), not a claim
 * about how accurate a forecast is: loose enough that a sensible answer passes, tight enough to catch
 * those. Deliberately NOT in `assumptions` below: it is a developer guard, not a number the "How we
 * calculate" list should show a user.
 */
export const aiForecastSanity = {
  value: {
    relative: 0.5,
    floorMonths: 12,
    bandMaxRatio: 3,
    effectRatioMin: 0.25,
    effectRatioMax: 4,
    effectFloor: 1_000 as Money,
  },
  assumption: true,
  note: 'Guard values, tunable against the fixtures: they only have to reject wrong-unit and runaway answers, not grade accuracy.',
} satisfies Assumption<AiForecastSanity>;

// ----- end Y15 --------------------------------------------------------------------------------

/** All assumptions by name, for the "How we calculate" panel. */
export const assumptions = {
  inflationAnnualFallback,
  incomeGrowthAnnual,
  returnAnnualNominal,
  cashYieldAnnual,
  cardAprDefault,
  cardMinPayment,
  retirementShareDefault,
  estimateSpread,
  debtLoadThresholds,
  safetyCushionMonths,
  clueCost,
  clueFloor,
  ...lifeCardAssumptions,
  avgMealPrice,
  monthlyGallons,
  kidGroceryFactor,
  weeksPerMonth,
  minForecastMonths,
  ...movesAssumptions,
  ...monthEndAssumptions,
  oneOffHintMinAmount,
  oneOffOutlierMinAmount,
  oneOffOutlierMultiple,
} as const;

export type AssumptionId = keyof typeof assumptions;

/** Solver bound: at most $1 million of additional debt payments per month. */
export const PAYOFF_MAX_EXTRA = 1_000_000;
/** Dollar precision of the feasible upper bound returned by the payoff solver. */
export const PAYOFF_SOLVE_TOLERANCE = 1;
