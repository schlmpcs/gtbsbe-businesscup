// Fixed data of the subscription audit (M5): the survey it quotes, the quick picks and two caps. The
// thresholds (where a guess lands against the total) are the engine's: `subsMissEdges` in assumptions.ts.
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
