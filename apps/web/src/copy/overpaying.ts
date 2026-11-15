// Strings for the overpaying check (S23, /tools/overpaying). Owner: Amir (M11).
// Functions take numbers already formatted by the UI (formatMoney), never raw values.
//
// Wording guardrails (docs/design/11-overpaying-check.md): the screen says where a cost sits against a
// typical range and what a gap is worth. It never says "overpaying", "too much" or "ripped off", never
// tells anyone to move, switch, cancel or negotiate, and never names a provider. "Below" is neutral.
// overpayingCopy.test.ts checks every string against a list of banned words.
import type { BenchmarkLine, KidAge } from '@lifeguessr/types';

type Position = 'below' | 'inRange' | 'above';
type Tier = 'cheap' | 'mid' | 'expensive' | 'suburb';

export const overpaying = {
  screens: {
    S23: 'Are you paying more than typical?',
  },

  intro:
    'Put what you pay each month next to the typical range for your area. The ranges are sourced, you need no documents, and your numbers stay on this device.',
  loading: 'Loading…',

  /** The four lines that can be compared. Rent includes utilities, as the HUD figures do. */
  lines: {
    rent: 'Rent + utilities',
    carInsurance: 'Car insurance',
    groceries: 'Groceries',
    childcare: 'Childcare',
  } satisfies Record<BenchmarkLine, string>,

  form: {
    title: 'Your numbers',
    zip: 'ZIP code',
    zipHint: 'Five digits. A ZIP+4 works too.',
    zipPlaceholder: '75206',
    householdTitle: 'Your household',
    bedrooms: 'Bedrooms',
    bedroomOptions: { 0: 'Studio', 1: '1', 2: '2', 3: '3', 4: '4 or more' } as Record<number, string>,
    bedroomsHint: 'Our rent data stops at 4 bedrooms.',
    adults: 'Adults',
    kidsTitle: 'Children',
    kidsHint: 'Used for childcare and groceries. Skip it if you have none.',
    kidAges: {
      infant: 'Infants',
      toddler: 'Toddlers',
      preschool: 'Preschool age',
      schoolAge: 'School age',
    } satisfies Record<KidAge, string>,
    amountsTitle: 'What you pay each month',
    amountsHint: 'Fill in at least one. Leave the others blank.',
    perMonth: '/ month',
    amountPlaceholder: '0',
    fromProfile: 'From your profile',
    noWriteBack: 'What you type here stays on this device. It never changes your profile.',
    /** JF4: the profile says the person owns their home. */
    ownerHousing: 'You own your home, so your housing costs are not compared with rent here.',
    errors: {
      zip: 'Enter a 5-digit US ZIP code.',
      amount: 'Enter an amount above $0, or leave it blank.',
    },
  },

  needs: {
    zip: 'Enter your ZIP code to see how your costs compare.',
    amount: 'Enter at least one monthly cost to compare.',
  },

  coverage: {
    /** `zip`, `metro` as typed or named in the data. */
    exact: (zip: string, metro: string) => `Compared with typical costs for ZIP ${zip}, ${metro}.`,
    approximate: 'approximate, nearest metro',
    metro: (metro: string, tier: string) =>
      `We have no data for your ZIP, so this is approximate: it uses typical costs in ${metro} (${tier}).`,
    noneTitle: 'We do not have data for this ZIP yet',
    none: (zip: string, zips: number, metros: number) =>
      `We cover ${zips} ZIP codes in ${metros} metros, and ${zip} is not one of them. Pick the nearest metro and area type for an approximate comparison.`,
  },

  picker: {
    title: 'Nearest metro',
    metro: 'Metro',
    choose: 'Choose a metro',
    tier: 'Area type',
    tiers: {
      cheap: 'Lower-cost area',
      mid: 'Mid-cost area',
      expensive: 'Higher-cost area',
      suburb: 'Suburb',
    } satisfies Record<Tier, string>,
  },

  result: {
    title: 'How your costs compare',
    /** Which household the comparison is about (the default is our assumption until the person edits it). */
    household: {
      describe: (bedrooms: number, adults: number, kids: number) =>
        [
          bedrooms === 0 ? 'studio' : bedrooms >= 4 ? '4 or more bedrooms' : bedrooms === 1 ? '1 bedroom' : `${bedrooms} bedrooms`,
          adults === 1 ? '1 adult' : `${adults} adults`,
          kids === 0 ? 'no children' : kids === 1 ? '1 child' : `${kids} children`,
        ].join(', '),
      default: (what: string) => `Compared with ${what} (default).`,
      defaultWhy: 'We have not asked about your household yet, so this is our assumption. Change it in the form to make it yours.',
      entered: (what: string) => `Based on the household you entered: ${what}.`,
    },

    summaryLabel: 'Summary',
    compared: 'Lines compared',
    above: 'Above the typical range',
    gapPerYear: 'Gap per year',
    gapPerYearHint: 'Added up over the lines above the range.',
    effect10y: 'Over 10 years',
    effectHint:
      'Projected, based on your inputs: the 10-year value of a cost at the middle of the typical range instead of yours, added up over every line above the range, in today’s dollars.',
    effectPartial: 'Not added up: the 10-year figure could not be worked out for every line above the range. Each line shows its own where it can.',
    effectNone: 'Not available',
    effectNoneAbove: 'The 10-year figure could not be worked out from your profile for the lines above the range.',
    summaryLine: (compared: number, above: number) =>
      compared === 1
        ? above === 1
          ? '1 line compared, and it is above the typical range.'
          : '1 line compared, and it is not above the typical range.'
        : `${compared} lines compared, ${above} above the typical range.`,
    positions: {
      below: 'Below the typical range',
      inRange: 'In the typical range',
      above: 'Above the typical range',
    } satisfies Record<Position, string>,
    belowNote: 'Below can simply mean a smaller place or a different plan.',
    you: 'You pay',
    perMonthShort: 'a month',
    typicalRange: (low: string, high: string) => `Typical range ${low} to ${high} a month`,
    /** The bar's text alternative. */
    barLabel: (yours: string, low: string, mid: string, high: string) =>
      `You pay ${yours} a month. The typical range is ${low} to ${high}, with ${mid} in the middle.`,
    barLow: 'Low',
    barHigh: 'High',
    yourMarker: 'You',
    gap: (perMonth: string, perYear: string) => `${perMonth} a month above the range, ${perYear} a year`,
    /** `perMonth`: yours minus the middle of the range (not the gap, which stops at the top of it). */
    effect: (perMonth: string, value: string) =>
      `Projected, based on your inputs: a cost at the middle of the typical range would be ${perMonth} a month lower than yours, worth about ${value} over 10 years, in today’s dollars.`,
    effectNeedsProfile: 'The 10-year effect needs your own numbers.',
    effectNeedsProfileLink: 'Add your balance sheet',
    effectUnavailable: 'The 10-year effect could not be worked out from your profile for this line.',
    estimate: 'estimate',
    estimateWhy: 'Part of this range is assumed, or approximate for a nearby metro.',
    effectEstimateWhy: 'A projection from your inputs with our rules-based forecast, not a measured figure.',
    skippedTitle: 'Not compared',
    skipped: {
      notEntered: (line: string) => `${line}: left blank.`,
      noData: (line: string) => `${line}: we have no benchmark for this area.`,
      noKids: 'Childcare: add your children to compare it.',
    },
    notAdvice: 'This shows where each cost sits against a typical range for the area, and what a gap is worth. It is not advice.',
  },

  errors: {
    invalidResponse: 'We could not check these numbers. Please try different inputs.',
    unknown: 'Something went wrong while comparing. Please try different inputs.',
  },

  streamer: {
    title: 'Not shown in streamer mode',
    body: 'This tool is built on your own numbers, so it stays hidden while you stream.',
    back: 'Back to the game',
  },
} as const;
