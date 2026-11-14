// Strings for "price in work hours" (engine workTime): a price as time spent earning it.
// Amounts arrive already rounded by the engine (`best.amount`); units are the engine's.

type Unit = 'minutes' | 'hours' | 'days' | 'weeks';

const UNIT_WORDS: Record<Unit, [one: string, many: string]> = {
  minutes: ['min', 'min'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
  weeks: ['week', 'weeks'],
};

/** "14 min", "1 day", "2.5 weeks"; zero minutes reads "under a minute". */
const amount = (unit: Unit, n: number) =>
  unit === 'minutes' && n === 0 ? 'under a minute' : `${n} ${UNIT_WORDS[unit][n === 1 ? 0 : 1]}`;

export const workTime = {
  amount,
  /** "= 3 days of your work", with "each month" / "each year" for a recurring price. */
  ofYourWork: (unit: Unit, n: number, per: false | 'monthly' | 'yearly' = false) =>
    `= ${amount(unit, n)} of your work${per === 'monthly' ? ' each month' : per === 'yearly' ? ' each year' : ''}`,
  /** How it is computed (`hoursPerWeek` = the assumption, e.g. 40). */
  hint: (hoursPerWeek: number) =>
    `Your monthly take-home pay spread over ${hoursPerWeek}-hour weeks. A day is ${hoursPerWeek / 5} hours, a week ${hoursPerWeek}.`,
} as const;
