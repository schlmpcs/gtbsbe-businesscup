// Fixed numbers of the subscription audit (M5). Thresholds say why they have the value they have.
import type { Money, Source } from '@lifeguessr/types';

/**
 * The survey the reveal quotes: in a C+R Research survey of 1,000 consumers, quick guesses averaged
 * $86 a month on subscriptions against $219 when itemized (docs/research/4-user-pain.md). The study is
 * from 2022, so the year is on the source line. It is a survey, not the person's data, and the screen
 * says so.
 */
export const SURVEY = {
  guessed: 86 satisfies Money,
  itemized: 219 satisfies Money,
  source: {
    name: 'C+R Research survey of 1,000 consumers',
    year: 2022,
    url: 'https://www.crresearch.com/blog/true-cost-of-subscriptions',
  } satisfies Source,
} as const;

/** Quick-pick guesses under the guess box (docs/design/08-subscription-audit.md). */
export const GUESS_PRESETS = [25, 50, 100, 200] as const satisfies readonly Money[];

/** Services on the tick-list: the catalogue's own cap for an editable cold-start list (M4 `tickList()`). */
export const TICK_LIST_MAX = 40;

/** Most services one person can tick: a bound for what is read back from local storage. */
export const TICKS_MAX = 200;

/**
 * A statement of fewer months than this cannot show a pattern: most findings are `medium`
 * confidence and the screen says why ("needs at least 2 months for best results", design brief 08).
 */
export const SHORT_STATEMENT_MONTHS = 2;

/**
 * Where a guess lands against the actual total, as guess ÷ actual. Each bucket takes its lower
 * edge: under 0.5, 0.5 up to 0.8, 0.8 up to 1.25, 1.25 up to 2, 2 and over. 0.8 and 1.25 are
 * reciprocals (a fifth under, a fifth over: "about right"); 0.5 and 2 are half and double.
 * Written as [numerator, denominator] pairs so the edges are compared in whole cents without floating point.
 */
export const MISS_EDGES = [
  { edge: [1, 2], bucket: 'under0.5' },
  { edge: [4, 5], bucket: '0.5to0.8' },
  { edge: [5, 4], bucket: '0.8to1.25' },
  { edge: [2, 1], bucket: '1.25to2' },
] as const;
