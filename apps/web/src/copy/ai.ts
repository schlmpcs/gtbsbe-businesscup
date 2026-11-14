// Strings for the AI helpers (/api/ai/parse, /api/ai/explain). Owner: Amir (Y12).
// The explain templates are the deterministic fallback when the model is unavailable or its
// sentence fails a guard. They take numbers already formatted by src/lib/format.ts.
import type { CostCategory, ForecastSource, MoveKind } from '@lifeguessr/types';

const categoryLabels: Record<CostCategory, string> = {
  rentUtilities: 'rent and utilities',
  car: 'car running costs',
  childcare: 'childcare',
  groceries: 'groceries',
  eatingOut: 'eating out',
  subscriptions: 'subscriptions',
  debtPayments: 'debt payments',
  other: 'other spending',
};

/** First sentence of a move explanation, by move kind (no lenders, securities or tax advice). */
const moveSentence: Record<MoveKind, (category?: CostCategory) => string> = {
  payCardFirst: () => 'This move puts your extra money toward your credit card balance first.',
  cutCategory: (category) =>
    `This move trims what you spend on ${category ? categoryLabels[category] : 'one category'} each month.`,
  cancelSubscriptions: () => 'This move cancels subscriptions you no longer use.',
  retirementMatch: () => 'This move raises your retirement saving to collect the full employer match.',
  hsa: () => 'This move sets money aside in a health savings account.',
  refinance: () => 'This move swaps a high-interest debt for a lower rate.',
  negotiateRent: () => 'This move asks for a lower rent at your next renewal.',
  reshopInsurance: () => 'This move compares car insurance quotes to lower your premium.',
};

/** "1 year", "3 years": how a horizon of whole years is written (also used by the forecast screen). */
export const yearsPhrase = (years: number): string => (years === 1 ? '1 year' : `${years} years`);

/** Second sentence of a move explanation: the effect after `years`, worded by where the number came from. */
const moveEffect = {
  simulation: {
    gain: (amount: string, years: number) => `In our simulation it adds about ${amount} to your net worth in ${yearsPhrase(years)}.`,
    loss: (amount: string, years: number) =>
      `In our simulation it lowers your net worth by about ${amount} in ${yearsPhrase(years)}.`,
  },
  ai: {
    gain: (amount: string, years: number) =>
      `Our AI estimate is that it adds about ${amount} to your net worth in ${yearsPhrase(years)}.`,
    loss: (amount: string, years: number) =>
      `Our AI estimate is that it lowers your net worth by about ${amount} in ${yearsPhrase(years)}.`,
  },
} as const;

export const ai = {
  /** Plain-language category names (also given to the model as facts). */
  categoryLabels,
  /** One sentence describing a move (also given to the model as the move's description). */
  moveSummary: (kind: MoveKind, category?: CostCategory) => moveSentence[kind](category),
  explain: {
    /**
     * `effect` is the move's change in net worth after `years` (10 unless the screen shows another
     * horizon). `source` says where it came from: 'ai' (the model's estimate, checked against our
     * rules) is named as such; 'rules' or none is the deterministic simulation.
     */
    move: (
      kind: MoveKind,
      category: CostCategory | undefined,
      effect: string,
      positive: boolean,
      source: ForecastSource | undefined,
      years: number,
    ) => {
      const sentences = source === 'ai' ? moveEffect.ai : moveEffect.simulation;
      return `${moveSentence[kind](category)} ${positive ? sentences.gain(effect, years) : sentences.loss(effect, years)}`;
    },
    loan: (monthly: string, totalInterest: string, payoff: string | null) =>
      `This loan costs ${monthly} a month and ${totalInterest} in interest in total. ${
        payoff === null
          ? 'The payment never covers the interest, so the balance never goes down.'
          : `It is paid off after ${payoff} months.`
      }`,
    moveAndLoan: (kind: MoveKind, category: CostCategory | undefined, monthly: string) =>
      `${moveSentence[kind](category)} The loan costs ${monthly} a month.`,
  },
  parse: {
    confirmNote: 'We read these numbers from what you typed. Check them before they go into your plan.',
    errors: {
      bad_request: 'That request was not valid.',
      too_large: 'That text is too long. Try a shorter description.',
      rate_limited: 'Too many requests. Wait a moment and try again.',
      unavailable: 'Typing it out is not available right now. Use the form instead.',
      nothing_found: 'We could not find any numbers to use in that text. Use the form instead.',
      invalid_output: 'We could not read that reliably. Use the form instead.',
      upstream_error: 'Something went wrong reading that. Use the form instead.',
    },
  },
} as const;
