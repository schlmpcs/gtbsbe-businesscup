// What if? Two choices, two futures (/what-if) and the TwoFuturesHero.
import type { CostCategory, KidAge } from '@lifeguessr/types';
import { common } from './common';

type Letter = 'A' | 'B';
type Term = CostCategory | 'income';
type Tier = 'cheap' | 'mid' | 'expensive' | 'suburb';

const years = (months: number) => {
  if (months % 12 === 0) {
    const y = months / 12;
    return y === 1 ? '1 year' : `${y} years`;
  }
  return months === 1 ? '1 month' : `${months} months`;
};

const KID_AGE: Record<KidAge, string> = {
  infant: 'Baby',
  toddler: 'Toddler',
  preschool: 'Preschooler',
  schoolAge: 'School-age kid',
};

const TIER: Record<Tier, string> = {
  cheap: 'lower-cost area',
  mid: 'mid-priced area',
  expensive: 'pricier area',
  suburb: 'suburbs',
};

export const whatIf = {
  pageTitle: 'Two choices. Two futures.',
  pageLead: 'Pick a choice you’re weighing. We run both through your numbers and show where each one leaves you in 10 years.',
  presetsLabel: 'Try a choice',
  presets: {
    car: 'A $35k car or a $22k car',
    city: 'Austin or Chicago',
    baby: 'A baby now or in 2 years',
    card: 'Pay off the card or save the cash',
    rent: 'Rent downtown or in the suburbs',
  } as Record<string, string>,
  /** Card titles for the preset sides, by preset id and letter. */
  sideTitles: {
    car: { A: 'The $35k car', B: 'The $22k car' },
    city: { A: 'Move to Austin', B: 'Move to Chicago' },
    baby: { A: 'A baby now', B: 'A baby in 2 years' },
    card: { A: 'Pay off the card', B: 'Keep the cash' },
    rent: { A: 'Rent downtown', B: 'Rent in the suburbs' },
  } as Record<string, Record<Letter, string>>,
  custom: 'Your own what-if',
  asItIs: 'Your plan as it is',
  vs: 'VS',
  choiceLabel: (letter: Letter) => `Choice ${letter}`,
  edit: 'Change',
  editLabel: (letter: Letter) => `Change choice ${letter}`,
  reset: 'Back to the plan as it is',
  homeAssumed: (metro: string) => `We don’t know your area yet, so costs use ${metro}.`,
  sampleNote: 'Shown on a sample life until you add your own numbers.',

  /** Fact chips on a choice card. */
  facts: {
    price: (amount: string) => `${amount} price`,
    loan: (rate: string, months: number) => `${rate} APR · ${months} mo`,
    loanMonthly: (amount: string) => `${amount}/mo payment`,
    down: (amount: string) => `${amount} down`,
    cash: 'Paid in cash',
    card: 'On a card',
    recurring: (amount: string, per: 'monthly' | 'yearly') => `${amount} ${per === 'monthly' ? 'a month' : 'a year'}`,
    place: (metro: string, tier: Tier) => `${metro.replace(/, [A-Z]{2}$/, '')} · ${TIER[tier]}`,
    kid: (age: KidAge, inMonths: number) => (inMonths === 0 ? `${KID_AGE[age]} now` : `${KID_AGE[age]} in ${years(inMonths)}`),
    childcare: (amount: string) => `Childcare ${amount}/mo`,
    income: (amount: string) => `${amount}/mo take-home`,
    grossRaise: (amount: string) => `${amount} a year before tax`,
    rent: (amount: string) => `Rent ${amount}/mo`,
    payDebt: (amount: string) => `${amount} to the card`,
    noDebt: 'No card balance to pay',
    keep: 'Cash stays in savings',
    asItIs: 'No change',
    estimate: 'estimate',
    afford: {
      fits: 'Fits your budget',
      wait: (months: number) => `Fits in ${years(months)}`,
      no: 'Doesn’t fit yet',
    },
  },

  /** The "What if…" text field. */
  ask: {
    label: 'What if…',
    placeholder: 'we have a baby next year · I move to Austin · I get a $10k raise',
    hint: 'One change at a time. You check it before it’s used.',
    submit: 'Read it',
    reading: 'Reading…',
    confirmTitle: 'Here’s what we read',
    putIn: (letter: Letter) => `Put it in ${letter}`,
    discard: 'Not this',
    inferred: 'we filled this in',
    readBy: { ai: 'Read by AI. The math is ours.', rules: 'Read by our rules. The math is ours.' },
    placeNote: (metro: string, zip: string, tier: Tier) =>
      `We have prices for ${metro} by ZIP, so we used ${zip}, a ${TIER[tier]}.`,
    raiseNote: (gross: string, monthly: string) =>
      `${gross} a year before tax is about ${monthly} a month take-home (estimate).`,
    noTimingNote: 'You didn’t say when, so it starts now.',
    errors: {
      nothingFound: 'We couldn’t find a change in that. Try “I move to Austin” or “we have a baby next year”.',
      placeMissing: (metros: string) => `We only have prices for these metros: ${metros}.`,
      incomplete: 'We need one more number for that, like the loan’s APR and length.',
      rateLimited: 'Too many tries in a minute. Wait a moment and try again.',
      unknown: 'That didn’t work. Try again, or pick a choice above.',
    },
  },

  /** Kinds of change, as the confirm box names them. */
  changeKinds: {
    purchase: 'Buy',
    loan: 'Borrow',
    move: 'Move',
    kid: 'A child',
    income: 'Pay change',
    rent: 'New rent',
    payDebt: 'Pay down debt',
  },

  chart: {
    title: 'Net worth over 10 years, both choices',
    today: 'Today',
    yearTick: (y: number) => (y === 0 ? 'Now' : `${y}y`),
    goal: (target: string) => `Goal ${target}`,
    starts: (letter: Letter) => `${letter} starts`,
    range: 'A range, not a promise.',
    rangeHint: 'The shaded bands show how far the result moves if the numbers we estimated are off.',
    rulesLabel: 'Rules forecast',
    todaysDollars: 'In today’s dollars',
    scrubLabel: 'Year to compare',
    endYear: (year: number) => `In 10 years · ${year}`,
    scrubYear: (y: number) => (y === 0 ? 'Today' : y === 1 ? 'In 1 year' : `In ${y} years`),
    verdict: { onTrack: 'on track', withinRange: 'within range', behind: 'behind' },
    tableCaption: 'Both futures by year',
  },

  result: {
    ahead: (letter: Letter, amount: string, year: number) => `${letter} leaves you ${amount} ahead in ${year}.`,
    /** The same sentence in two parts, so the amount can be styled: before + amount + after. */
    aheadBefore: (letter: Letter) => `${letter} leaves you `,
    aheadAfter: (year: number) => ` ahead in ${year}.`,
    tie: 'Both choices end in the same place.',
    decidedBy: 'What decided it:',
    decided: (term: Term, winner: Letter, amount: string) =>
      term === 'income'
        ? `pay. ${winner}’s pay change is worth ${amount} more by year 10.`
        : `${(common.categories[term as CostCategory] ?? term).toLowerCase()}. ${winner} comes out ${amount} better on it over 10 years.`,
    monthlyTitle: 'What changes each month',
    monthlyHint: 'Compared with your plan as it is, the month each change starts. Lower is better.',
    termLabel: (term: Term) => (term === 'income' ? 'Take-home pay (more is better)' : common.categories[term as CostCategory]),
    perMonth: '/mo',
    noMonthly: 'Neither choice changes your monthly costs. The difference is in your balances.',
    source: 'Educational simulation, not financial advice. Rules forecast from your profile and public area data.',
  },

  save: {
    cta: 'Save this choice',
    saved: 'Saved',
    lockTitle: 'Saving choices is a Pro feature',
    lockBody: 'Keep the choices you’re weighing and come back to them as your numbers change.',
    lockCta: 'See Pro',
    listTitle: 'Saved choices',
    open: 'Open',
    remove: 'Remove',
  },
  tryAnother: 'Try another what-if',

  hero: {
    title: 'Two choices. Two futures.',
    lead: 'Every choice bends your 10-year line. See how far.',
    cta: 'Try your own what-if',
    sample: 'Sample life',
  },
};
