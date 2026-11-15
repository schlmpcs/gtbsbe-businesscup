// Shared user-facing strings (app shell, nav, disclaimers, UI kit). Feature strings live in their own file.
import type { CostCategory } from '@lifeguessr/types';

const NOW = 'Now';

export const common = {
  appName: 'LifeGuessr',
  tagline: 'Money apps forecast your accounts. We forecast your decisions, and rank which one to make next.',
  disclaimer: 'Educational simulation, not financial advice.',
  /**
   * The app shell (MP14): a sidebar on desktop, bottom tabs and a "More" sheet on a phone.
   * Routes live in features/shell/model; these are the labels.
   */
  shell: {
    home: 'LifeGuessr dashboard',
    skipToContent: 'Skip to content',
    /** Accessible names of the nav landmarks. */
    sidebarLabel: 'Main',
    tabsLabel: 'Main tabs',
    moreLabel: 'More pages',
    /** Group headings in the sidebar (null: the group has no heading). */
    groups: {
      main: null,
      money: 'Money',
      game: null,
    },
    links: {
      dashboard: 'Dashboard',
      plan: 'Plan',
      whatif: 'What if?',
      accounts: 'Accounts',
      transactions: 'Transactions',
      cashflow: 'Cash flow',
      budget: 'Budget',
      recurring: 'Recurring',
      goals: 'Goals',
      play: 'Play',
      pro: 'Go Pro',
    },
    badges: {
      daily: 'Daily',
    },
    more: 'More',
    moreTitle: 'More',
    moreDescription: 'The rest of your money planner.',
    proLine: 'Plan to 90, Compare, Chance of success',
  },
  /**
   * The slim strip at the top of the content while the numbers on screen are the sample household's,
   * not yours (the demo profile): `text` after "See a sample plan", `textDefault` when nothing was
   * entered yet, `textLedger` when the person imported their own transactions but the plan (profile)
   * is still the sample's.
   */
  sampleBanner: {
    text: 'Sample life — make it yours',
    textDefault: 'Sample numbers — make it yours',
    textLedger: 'Your transactions are in; the plan still uses sample numbers — make it yours',
    cta: 'Use my numbers',
  },
  nav: {
    title: 'Screens',
    placeholderNote: 'Placeholder screen. The real UI lands with its task.',
  },
  estimateTag: 'estimate',
  estimateHint: 'We filled this in with a typical value. Change it to make it yours.',

  /** Display names for every cost category (shared by the reveal, ladder, forecast and afford screens). */
  categories: {
    rentUtilities: 'Rent + utilities',
    car: 'Car',
    childcare: 'Childcare',
    groceries: 'Groceries',
    eatingOut: 'Eating out',
    subscriptions: 'Subscriptions',
    debtPayments: 'Debt payments',
    other: 'Everything else',
  } satisfies Record<CostCategory, string>,
  /** JF4: the rentUtilities label when the person owns their home (owner costs, not rent). */
  ownerHousing: 'Home costs + utilities',

  /** Strings the UI kit (src/ui-kit) shows on its own. Everything else comes in through props. */
  kit: {
    close: 'Close',
    source: 'Source',
    sourcePrefix: 'Source:',
    showSource: 'Show source',
    hideSource: 'Hide source',
    opensInNewTab: '(opens in a new tab)',
    gaugeZones: { low: 'Low', medium: 'Medium', high: 'High' },
    chart: {
      /** The band is the spread from estimated inputs only (ENGINEERING.md → Forecast: label it this way). */
      rangeLegend: 'Range from the numbers we estimated',
      yearAxis: 'Years from now',
      /** X-axis tick for a whole number of years from now. */
      yearTick: (years: number) => (years === 0 ? NOW : `${years}y`),
      /** Tooltip / table heading for a point in time. */
      yearLabel: (years: number) => (years === 0 ? NOW : years === 1 ? 'In 1 year' : `In ${years} years`),
      /** Tooltip heading for any month from now: months under a year, else years and months ("In 1 year, 3 months"). */
      monthLabel: (month: number) => {
        const years = Math.floor(month / 12);
        const months = month % 12;
        const m = months === 1 ? '1 month' : `${months} months`;
        if (months === 0) return years === 0 ? NOW : years === 1 ? 'In 1 year' : `In ${years} years`;
        if (years === 0) return `In ${m}`;
        return `${years === 1 ? 'In 1 year' : `In ${years} years`}, ${m}`;
      },
      tableCaption: 'Chart data by year',
      tableYear: 'When',
      tableMid: 'Most likely',
      tableRange: 'Range',
      /** "low to high" for one range cell. */
      range: (low: string, high: string) => `${low} to ${high}`,
    },
    breakdown: {
      total: 'Total',
    },
    houseScene: {
      /** Accessible name of the illustrated house, e.g. "2-bedroom home". */
      house: (layout: string) => `${layout} home`,
      /** Screen-reader summary of the always-visible decor. */
      decor: (items: string) => `Around the house: ${items}.`,
      back: 'Back to the house',
      /** Accessible name of the close-up panel of one room. */
      closeUp: (room: string) => `${room} close-up`,
      /** Heading over the revealed props in a close-up. */
      inside: 'Inside',
      retry: 'Try again',
    },
  },
} as const;
