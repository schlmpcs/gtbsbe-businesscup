// View-model contract of the Recurring screen (MP11, #171). ui/ may import only this file, @/ui-kit/**
// and @/copy (lint-enforced). Hook: useRecurring (./useRecurring.ts).
// Units: `amount` is US dollars per `cadence` (per charge or payment), `monthly` the same per month; a
// section's `total` adds up the `amount` of the items that fall in the month on screen. Names:
// copy.recurring. Statement lines are masked in the browser and never leave it (CLAUDE.md rule 6).
import type { Cadence, Money, SubscriptionFlag, YearMonth } from '@lifeguessr/types';
import type { VMError } from '@/lib/model/types';

export type { Cadence, Money, SubscriptionFlag, YearMonth } from '@lifeguessr/types';
export type { VMError } from '@/lib/model/types';

export type RecurringSectionId = 'income' | 'expenses' | 'creditCards';
/** Keys of copy.recurring.labels, for items that come from the profile or an account (they have no statement text). */
export type RecurringLabelKey = 'takeHomePay' | 'rent' | 'loan' | 'card';
/** Where the item comes from: a recurring statement charge, the profile (pay, rent) or an account (card or loan payment). */
export type RecurringOrigin = 'statement' | 'profile' | 'account';

export type RecurringItemVM = {
  /** Stable: the subscription finding id, 'income:take-home', 'rent', or 'account:<id>'. */
  id: string;
  section: RecurringSectionId;
  /** Text to show: the masked statement label, or the account's name; '' when `labelKey` names the item instead. */
  label: string;
  labelKey: RecurringLabelKey | null;
  origin: RecurringOrigin;
  amount: Money;
  cadence: Cadence;
  /** The amount per month (a yearly charge / 12). */
  monthly: Money;
  /** The day of the month it falls on; null when unknown (take-home pay), and then it is not on the calendar. */
  dayOfMonth: number | null;
  /** We assumed the day (rent, loan and card payments) instead of measuring it. */
  dayIsEstimate: boolean;
  /** The amount is an estimate (the profile's, or an account's defaulted minimum). */
  amountIsEstimate: boolean;
  /** Price rise, intro price ended, overlap, seen once: from the subscription audit (statement items only). */
  flags: SubscriptionFlag[];
};

export type RecurringSectionVM = {
  id: RecurringSectionId;
  /** The items that fall in the month on screen, by day of month. */
  items: RecurringItemVM[];
  total: Money;
};

export type RecurringCalendarCellVM = {
  /** Day of the month, or null for the padding before the 1st and after the last day. */
  day: number | null;
  /** 'YYYY-MM-DD', null for padding. */
  iso: string | null;
  isToday: boolean;
  items: RecurringItemVM[];
};

export type RecurringVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** 'YYYY-MM' on screen. */
  month: YearMonth;
  /** "November 2026". */
  monthLabel: string;
  isCurrent: boolean;
  /** Income, expenses, credit cards; a section with no item that month still appears (items: []). */
  sections: RecurringSectionVM[];
  /** Calendar weeks, Sunday first, 7 cells each. */
  calendar: { weeks: RecurringCalendarCellVM[][] };
  /** Nothing recurring at all (not just this month): show the empty state. */
  empty: boolean;
  /** The detector failed; the statement items are missing and the rest still shows. */
  error: VMError | null;
  /** Hides an item (a charge that only looks recurring). */
  markNotRecurring: (id: string) => void;
  prev: () => void;
  next: () => void;
  /** Back to the current month. */
  today: () => void;
};
