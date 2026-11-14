// Shared user-facing strings (app shell, nav, disclaimers, UI kit). Feature strings live in their own file.
import type { CostCategory } from '@lifeguessr/types';

const NOW = 'Now';

export const common = {
  appName: 'LifeGuessr',
  tagline: 'Money apps forecast your accounts. We forecast your decisions, and rank which one to make next.',
  disclaimer: 'Educational simulation, not financial advice.',
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
  },
} as const;
