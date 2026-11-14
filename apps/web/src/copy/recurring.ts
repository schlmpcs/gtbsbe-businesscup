import type { Cadence, SubscriptionFlag } from '@lifeguessr/types';

// Strings for Recurring (MP11, MP17). `labels` are the keys of items that come from the profile or an
// account instead of a statement line (those carry their own text).
export const recurring = {
  title: 'Recurring',
  intro: 'Bills, subscriptions and pay that come back every month.',
  sections: { income: 'Income', expenses: 'Expenses', creditCards: 'Credit cards' },
  labels: { takeHomePay: 'Take-home pay', rent: 'Rent and utilities', loan: 'Loan payment', card: 'Card minimum payment' },
  views: { list: 'List', calendar: 'Calendar' },
  viewLegend: 'View',
  markNotRecurring: 'Not recurring',
  markNotRecurringLabel: (name: string) => `Mark ${name} as not recurring`,
  perMonth: 'per month',
  cadences: { monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' } satisfies Record<Cadence, string>,
  due: (day: number) => `Due on the ${ordinal(day)}`,
  dueUnknown: 'Day varies',
  dayEstimate: 'day assumed',
  noneThisMonth: 'Nothing due this month.',
  total: 'Total this month',
  today: 'Today',
  prev: 'Previous month',
  next: 'Next month',
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  calendarLabel: (month: string) => `Recurring items in ${month}`,
  more: (n: number) => `+${n}`,
  flags: { priceUp: 'price went up', introEnded: 'intro price ended', overlap: 'overlaps another', seenOnce: 'seen once' } satisfies Record<SubscriptionFlag, string>,
  empty: 'Nothing recurring found yet.',
  emptyBody: 'Import a statement and we find the bills and subscriptions that repeat.',
  emptyLinks: { upload: 'Import a statement', guess: 'Set up my numbers' },
  error: 'We could not read the recurring charges in your statement. Pay and account payments still show.',
  loading: 'Loading recurring items…',
} as const;

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
