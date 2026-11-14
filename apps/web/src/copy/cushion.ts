// Strings for the emergency cushion card on Home (S1): months your cash lasts with no income.
// Functions take numbers already formatted by the UI.

type Band = 'under1' | '1to3' | '3to6' | '6plus';

const monthsWord = (m: string) => (m === '1' ? 'month' : 'months');

export const cushion = {
  title: 'Cushion',
  /** The big number: `m` = months, formatted ("2.3"). */
  months: (m: string) => `${m} ${monthsWord(m)}`,
  label: 'of essentials your cash covers if your income stopped',
  /** At full spending (`m` formatted). */
  full: (m: string) => `${m} ${monthsWord(m)} at your full spending.`,
  meterLabel: 'Months of essentials covered',
  bands: {
    under1: 'Under 1 month',
    '1to3': '1 to 3 months',
    '3to6': '3 to 6 months',
    '6plus': '6 months or more',
  } satisfies Record<Band, string>,
  /** What the next band takes: `extra` formatted dollars, `months` its lower edge. */
  next: (extra: string, months: number) => `Reaching ${months} ${months === 1 ? 'month' : 'months'} takes ${extra} more in cash.`,
  top: 'That’s at the top of the common guideline.',
  noEssentials: 'No essential spending entered yet, so there is nothing to cover.',
  essentials: 'Essentials: rent and utilities, groceries, childcare, car costs and minimum debt payments.',
  guideline: 'A common rule of thumb is 3 to 6 months. Educational simulation, not financial advice.',
} as const;
