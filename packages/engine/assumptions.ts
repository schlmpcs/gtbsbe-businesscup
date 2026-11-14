// Every constant the engine uses, in one place (docs/ENGINEERING.md → Default assumptions).
// Each carries a `source` or `assumption: true`; the UI lists them in a "How we calculate" panel.
// Rates are decimals per year. `note` is developer documentation, not user-facing copy.
import type { CostCategory, Money, Rate, ServiceCategory, Source, StatementClass } from '@lifeguessr/types';

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

/**
 * Game (duel): two lives closer than this share of the costlier total are never paired (a coin
 * flip, not a question). The pick score reuses clueCost and clueFloor per hint.
 */
export const duelMinGap = {
  value: 0.03,
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

// ----- statements (JF6): monthly averages and follow-up questions ------------------------------

/**
 * A statement month counts toward the monthly averages only when the statement covers it nearly in
 * full: its first line no later than this many days after the 1st, and its last line no earlier than
 * this many days before the month's end. An export that runs to Nov 12, or starts on Aug 17, holds
 * only part of that month, and averaging it in would pull every category (and pay) down.
 */
export const statementFullMonthSlackDays = {
  value: 7,
  assumption: true,
  note: 'A week: a checking account almost always has a line (a bill, a card swipe, pay) within any week.',
} satisfies Assumption<number>;

/**
 * Categories every household pays for. A statement with none of them in any full month is taken to
 * be missing them (paid from another account or card), not to prove they cost $0: the profile keeps
 * its value for them and S9 asks instead.
 */
export const statementEssentialCategories = {
  value: ['rentUtilities', 'groceries'] as const satisfies readonly CostCategory[],
  assumption: true,
  note: 'Housing and food. Childcare, a car or subscriptions are often truly $0, so their absence is believed.',
} satisfies Assumption<readonly CostCategory[]>;

/** Smallest monthly amount at one unclear merchant (or in cash) worth a follow-up question on S9. */
export const statementFollowUpMinMonthly = {
  value: 20 as Money,
  assumption: true,
  note: 'Below about $20 a month, re-sorting a merchant moves no forecast number a user would notice.',
} satisfies Assumption<Money>;

/** The JF6 assumptions, spread into `assumptions` below. */
export const statementAssumptions = {
  statementFullMonthSlackDays,
  statementEssentialCategories,
  statementFollowUpMinMonthly,
} as const;

// ----- Y15: AI forecast sanity envelope (anchors.ts) -------------------------------------------

/** How far an AI forecast may stray from the rules forecast before it is rejected. */
export type AiForecastSanity = {
  /** Yearly mid may lie this share of |rules mid| outside the rules band. */
  relative: number;
  /**
   * The tolerance never goes below this many months of take-home pay (net worth near 0 or a zero band).
   * The year-10 value: at year y the floor is floorMonths × y / 10 months (1.2 at year 1).
   */
  floorMonths: number;
  /** The AI band may be this many times as wide as the rules band; the limit never goes below the tolerance. */
  bandMaxRatio: number;
  /** A scenario's effect (at 1, 3, 5 or 10 years) must be between these multiples of the rules effect (same sign)... */
  effectRatioMin: number;
  effectRatioMax: number;
  /** ...unless it is within this many dollars of it. The year-10 value: at year y it is effectFloor × y / 10 ($100 at year 1). */
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
    relative: 0.25,
    floorMonths: 12,
    bandMaxRatio: 3,
    effectRatioMin: 1 / 3,
    effectRatioMax: 3,
    effectFloor: 1_000 as Money,
  },
  assumption: true,
  note: 'Guard values, tunable against the fixtures. They reject wrong-unit and runaway answers, and (tightened 2026-11-14 from ±50% and 0.25×–4×) an answer far off the simulation: in a live run Sonnet 5.5 once put the demo profile 60% below it and passed the old ±50%. They do not grade accuracy within the envelope.',
} satisfies Assumption<AiForecastSanity>;

// ----- end Y15 --------------------------------------------------------------------------------

// ----- M3: subscription audit (detectSubscriptions) --------------------------------------------
// What counts as a recurring charge. The detector prefers to miss a subscription over calling rent
// one, so every threshold errs on the strict side; a pattern with no catalogue match is `low`
// confidence and is not counted until the user confirms it.

/** Fewest charges that make a monthly or quarterly series (one missed period allowed between charges). */
export const subsMinCharges = {
  value: 2,
  assumption: true,
  note: 'Two charges in consecutive periods is the least that looks like a pattern; with an unknown merchant that is only `low` confidence.',
} satisfies Assumption<number>;

/** How far a charge's day of month may sit from the series' usual day (month-end days clamp to the month's length). */
export const subsDayWindow = {
  value: 3,
  assumption: true,
  note: 'Banks post weekend and holiday charges a day or two late; a wider window starts matching unrelated purchases.',
} satisfies Assumption<number>;

/** Charges within this share of each other are the same price (a steady amount), not a price change. */
export const subsAmountTolerance = {
  value: 0.03,
  assumption: true,
  note: 'Absorbs currency and sales-tax jitter on a steady charge; anything further apart is a step the detector must explain.',
} satisfies Assumption<number>;

/** A rise is flagged `priceUp` when the new amount is at least this many times the old steady amount... */
export const subsPriceUpMinRatio = {
  value: 1.05,
  assumption: true,
  note: 'Above the amount tolerance: a 3 to 5% step is kept in the series but not called a price rise.',
} satisfies Assumption<number>;

/** ...and at least this many dollars above it, so a few cents on a cheap plan is not a "price rise". */
export const subsPriceUpMinDollars = {
  value: 0.5 as Money,
  assumption: true,
  note: 'A 5% rise on a $2.99 plan is 15 cents; not worth an alert.',
} satisfies Assumption<Money>;

/** The old steady amount must have been charged at least this many times before a step counts as a price change. */
export const subsSteadyMinCharges = {
  value: 2,
  assumption: true,
  note: 'One charge is not a steady amount: a lone different charge on the usual day is more likely a one-off than a new price.',
} satisfies Assumption<number>;

/**
 * A step more than this many times bigger or smaller (either way) is a different charge, not a price change.
 * The same factor bounds a lone charge of a service that sells only monthly plans against a plan's price.
 */
export const subsStepMaxRatio = {
  value: 2,
  assumption: true,
  note: 'Keeps an annual fee or a one-off on the billing day from being read as a price change. A smaller first charge can still be an intro price (below). Also keeps a one-off purchase or a yearly prepayment from a known vendor (a $1,299 store order, a $264 annual plan) from being read as one monthly bill: a lone charge counts only within this factor of a monthly plan price.',
} satisfies Assumption<number>;

/** `introEnded`: the first charges were at most this share of the amount that followed. */
export const subsIntroMaxRatio = {
  value: 0.5,
  assumption: true,
  note: 'Intro offers are typically half price or less; a milder jump reads as a price rise instead.',
} satisfies Assumption<number>;

/** `introEnded`: an intro price lasts at most this many charges (a longer run at the low price is the price). */
export const subsIntroMaxCharges = {
  value: 2,
  assumption: true,
  note: 'Typical trials and intro offers run one or two billing cycles.',
} satisfies Assumption<number>;

/** A series is `stopped` when its last charge is older than this many billing periods before the last day of the statement. */
export const subsStoppedAfterPeriods = {
  value: 1.5,
  assumption: true,
  note: 'One missed period plus half a period of slack for late posting; the statement may simply end before the next charge.',
} satisfies Assumption<number>;

/** Calendar days in an average month, to measure "1.5 billing periods" in days. */
export const subsDaysPerMonth = {
  value: 30.4375,
  assumption: true,
  note: '365.25 ÷ 12.',
} satisfies Assumption<number>;

/** Categories where owning several services is usually duplication (`overlap`); a gym and a language app are not. */
export const subsOverlapCategories = {
  value: ['video', 'music', 'news', 'cloud'] as readonly ServiceCategory[],
  assumption: true,
  note: 'Services that compete for the same job: two streaming video plans, two music plans, two news sites, two cloud storage plans.',
} satisfies Assumption<readonly ServiceCategory[]>;

/** Statement classes the detector looks at with no catalogue match; rent, loans, groceries and the like never. */
export const subsCandidateClasses = {
  value: ['subscriptions', 'other'] as readonly StatementClass[],
  assumption: true,
  note: 'A catalogue match overrides the class (a known service is a subscription whatever the categorizer said).',
} satisfies Assumption<readonly StatementClass[]>;

/** A charge within this share of a catalogue plan price is that plan (prices drift, so not exact). */
export const subsPlanPriceTolerance = {
  value: 0.1,
  assumption: true,
  note: 'The catalogue is a dated snapshot; a plan that went up 7% in a year should still be recognised.',
} satisfies Assumption<number>;

/** Smallest steady amount reported: below it a charge is a card check or a rounding artefact, not a subscription. */
export const subsMinAmount = {
  value: 0.5 as Money,
  assumption: true,
  note: 'Real $0.99 plans exist (cloud storage), so the floor is low; it also keeps the monthly figure of a yearly charge above zero cents.',
} satisfies Assumption<Money>;

/** Billing periods that may pass with no charge between two charges of one series (a failed payment, a paused month). */
export const subsMissedPeriodsAllowed = {
  value: 1,
  assumption: true,
  note: 'One missed month is a hiccup; two in a row is a series that ended.',
} satisfies Assumption<number>;

/** A monthly or quarterly series needs this many pairs of charges in adjacent periods. */
export const subsMinAdjacentPairs = {
  value: 1,
  assumption: true,
  note: 'Charges every other month are a two-month cycle, not a monthly charge that skips a month each time.',
} satisfies Assumption<number>;

/** Months that two charges of a yearly or quarterly plan may be off from a whole year or quarter and still be the same series. */
export const subsPlanGapSlackMonths = {
  value: { yearly: 1, quarterly: 0 },
  assumption: true,
  note: 'A yearly renewal drifts a month with the billing date and the statement; a quarter is short enough to be exact.',
} satisfies Assumption<{ yearly: number; quarterly: number }>;

/** Whether a single sighting (one charge of a known service, no pattern) that already looks stopped is still reported. */
export const subsReportStoppedSightings = {
  value: false,
  assumption: true,
  note: 'One old charge shows no recurrence: it is more likely a one-off than a subscription that has been cancelled.',
} satisfies Assumption<boolean>;

/** More than this share of a lane's months with two or more charges means a weekly or multi-per-month pattern, not a monthly one. */
export const subsDoubledMonthsMaxShare = {
  value: 0.5,
  assumption: true,
  note: 'An occasional double charge is a retry or a duplicate and is counted once; a charge in most months twice over is not a monthly subscription.',
} satisfies Assumption<number>;

/** Charges at which a pattern is `high` confidence (a catalogue match with fewer is `medium`, or `high` with the minimum of 2). */
export const subsHighConfidenceMinCharges = {
  value: 3,
  assumption: true,
  note: 'Three charges in a row is a pattern; two could be a coincidence unless the catalogue knows the merchant.',
} satisfies Assumption<number>;

/**
 * Classes in which a pattern with no catalogue match can be `high` confidence. Any other class that is
 * still a candidate (`other`: a transfer to a person, rent, a regular shop) stays `low` at any number
 * of charges: shown to the user to confirm, not counted in the totals until confirmed.
 */
export const subsPatternHighClasses = {
  value: ['subscriptions'] as readonly StatementClass[],
  assumption: true,
  note: 'Owner decision on the issue\'s two confidence rules: the categorizer calling a recurring line a subscription is the evidence that lifts a pattern with no catalogue entry.',
} satisfies Assumption<readonly StatementClass[]>;

/** The M3 assumptions, spread into `assumptions` below. */
export const subscriptionAssumptions = {
  subsMinCharges,
  subsDayWindow,
  subsAmountTolerance,
  subsPriceUpMinRatio,
  subsPriceUpMinDollars,
  subsSteadyMinCharges,
  subsStepMaxRatio,
  subsIntroMaxRatio,
  subsIntroMaxCharges,
  subsStoppedAfterPeriods,
  subsDaysPerMonth,
  subsOverlapCategories,
  subsCandidateClasses,
  subsPlanPriceTolerance,
  subsMinAmount,
  subsMissedPeriodsAllowed,
  subsMinAdjacentPairs,
  subsPlanGapSlackMonths,
  subsReportStoppedSightings,
  subsDoubledMonthsMaxShare,
  subsHighConfidenceMinCharges,
  subsPatternHighClasses,
} as const;

// ----- end M3 ---------------------------------------------------------------------------------

// ----- M5: subscription audit screen ----------------------------------------------------------

/**
 * Where a monthly guess lands against the actual total, as guess ÷ actual, written as numerator and
 * denominator pairs so the edges are compared in whole cents with no floating point. Lowest first:
 * under 1/2, 1/2 up to 4/5, 4/5 up to 5/4, 5/4 up to 2/1, 2/1 and over (MISS_BUCKETS in packages/types, in that order).
 */
export const subsMissEdges = {
  value: [[1, 2], [4, 5], [5, 4], [2, 1]] as readonly (readonly [number, number])[],
  assumption: true,
  note: 'Half and double are the plain "way off" marks; 4/5 and 5/4 are reciprocals, a fifth under or over: "about right". Each bucket includes its lower edge.',
} satisfies Assumption<readonly (readonly [number, number])[]>;

/** The M5 assumptions, spread into `assumptions` below. */
export const subscriptionAuditAssumptions = { subsMissEdges } as const;

// ----- end M5 ---------------------------------------------------------------------------------

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
  duelMinGap,
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
  ...statementAssumptions,
  ...subscriptionAssumptions,
  ...subscriptionAuditAssumptions,
} as const;

export type AssumptionId = keyof typeof assumptions;

/** Solver bound: at most $1 million of additional debt payments per month. */
export const PAYOFF_MAX_EXTRA = 1_000_000;
/** Dollar precision of the feasible upper bound returned by the payoff solver. */
export const PAYOFF_SOLVE_TOLERANCE = 1;
/** Rent spread when Census quartile ratios are unavailable; an assumed range, not measured quartiles. */
export const RENT_RANGE_FALLBACK = 0.2;
/** Insurance premiums depend on coverage and driver details absent here; assumed ±20% range. */
export const INSURANCE_TOLERANCE = 0.2;
/** Grocery plans vary by household; assumed ±15% range around the sourced plan. */
export const GROCERY_TOLERANCE = 0.15;
/** Childcare varies by provider; assumed ±20% range around the county benchmark. */
export const CHILDCARE_TOLERANCE = 0.2;
