// Strings for the life events timeline (/tools/life-events): place life events on the next 10 years
// and see what they do to "You in 10 years". Functions take numbers already formatted by the UI
// (formatMoney), never raw values. Educational simulation: no lenders, no products, no advice.
import type { LifeEventKind, LifeEventLineItem } from '@lifeguessr/types';

export const lifeEvents = {
  title: 'What will life do to your plan?',
  eyebrow: 'Life events',
  intro:
    'Put the big things on the next 10 years: a baby, a move, a car, a raise, a wedding. See what they do to you in 10 years, priced with the public data for where you live.',

  kinds: {
    baby: 'New baby',
    move: 'Move',
    car: 'Buy a car',
    raise: 'Raise or new job',
    purchase: 'One-off purchase',
  } satisfies Record<LifeEventKind, string>,
  /** Chip text on the timeline. */
  chip: {
    baby: 'Baby',
    move: (metro: string) => `Move: ${metro}`,
    car: 'Car',
    raise: 'Raise',
    purchase: 'Purchase',
  },

  picker: {
    title: 'Add a life event',
    hint: 'It lands on the timeline; drag it or pick its year.',
    add: (kind: string) => `+ ${kind}`,
  },

  timeline: {
    label: 'Your next 10 years',
    now: 'Now',
    plus10: '+10 years',
    yearTick: (offset: number) => (offset === 0 ? 'Now' : `+${offset}`),
    empty: 'No life events yet. Add one below.',
    chipLabel: (name: string, year: number) => `${name} in ${year}. Select to edit; arrow keys move it a year.`,
  },

  edit: {
    title: (name: string) => `Edit: ${name}`,
    year: 'Year',
    yearOption: (year: number, offset: number) => (offset === 0 ? `${year} (now)` : `${year} (+${offset} ${offset === 1 ? 'year' : 'years'})`),
    remove: 'Remove',
    metro: 'Move to',
    bedrooms: 'Bedrooms (for the rent)',
    bedroomOption: (n: number) => (n === 0 ? 'Studio' : `${n} bedroom${n === 1 ? '' : 's'}`),
    price: 'Car price',
    downPayment: 'Down payment',
    apr: 'Loan APR',
    term: 'Loan term',
    termSuffix: 'months',
    raiseBy: 'Change by',
    raiseByAmount: 'Dollars a month',
    raiseByRate: 'Percent',
    raiseAmount: 'Take-home pay change per month',
    raiseRate: 'Take-home pay change',
    raiseHint: 'Use a minus sign for a pay cut.',
    amount: 'Amount',
    defaultsNote: 'Starting values are typical examples; change them to yours.',
  },

  chart: {
    title: 'You in 10 years: net worth',
    without: 'Without these events',
    with: 'With them',
    footnote: "In today's dollars. Rules-based estimate from your plan and the area data.",
  },

  result: {
    in10y: 'In 10 years',
    deltaLabel: 'What these events do to you in 10 years',
    delta: (signed: string) => `${signed} in 10 years`,
    noEvents: 'Add a life event to see what it does.',
    without: 'Without these events',
    with: 'With them',
    perEventTitle: 'Event by event',
    eventLine: (name: string, year: number, signedMonthly: string) => `${name} in ${year}: ${signedMonthly}/mo`,
    oneOffOnly: (name: string, year: number, signed: string) => `${name} in ${year}: ${signed} once`,
    oneOff: (signed: string) => `plus ${signed} once`,
    lineAmount: (line: string, signedMonthly: string) => `${line}: ${signedMonthly}/mo`,
    alone: (signed: string) => `On its own: ${signed} in 10 years`,
    beyondHorizon: 'Starts at the end of the 10 years, so it does not change the number yet.',
    missingChildcare: 'We have no childcare price for this area, so childcare is not counted.',
    homeFallback: (metro: string) => `We have no area data for your ZIP, so we priced your home as ${metro}.`,
    homeArea: (metro: string) => `Priced for where you live: ${metro}.`,
    error: 'These events could not be simulated. Check the numbers you entered.',
  },

  lines: {
    childcare: 'Childcare',
    kidGroceries: "The child's groceries",
    kidOther: 'Clothes, diapers and other kid costs',
    rent: 'Your rent + utilities',
    groceries: 'Your groceries',
    childcareNow: 'Your childcare',
    carInsurance: 'Car insurance',
    fuel: 'Fuel',
    carLoan: 'Car loan payment',
    takeHome: 'Take-home pay',
  } satisfies Record<LifeEventLineItem, string>,

  disclaimer: 'Educational simulation, not financial advice.',
} as const;
