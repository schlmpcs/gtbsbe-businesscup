// Shared user-facing strings (app shell, nav, disclaimers, UI kit). Feature strings live in their own file.
import type { CostCategory } from '@lifeguessr/types';

const NOW = 'Now';

export const common = {
  appName: 'LifeGuessr',
  tagline: 'Money apps forecast your accounts. We forecast your decisions, and rank which one to make next.',
  disclaimer: 'Educational simulation, not financial advice.',
  /** The site header (Figma: logo, five links, Go Pro). */
  siteNav: {
    label: 'Main',
    home: 'LifeGuessr home',
    links: [
      { href: '/', label: 'Home' },
      { href: '/play', label: 'Play' },
      { href: '/future', label: 'My future' },
      { href: '/tools', label: 'What if?', match: ['/afford', '/loan', '/decide', '/checkin'] },
    ],
    pro: 'Go Pro',
  },
  /** Shown on every screen while the sample life is on (Try with sample data). */
  sampleBanner: {
    text: 'You’re looking at a sample life.',
    cta: 'Use mine',
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
