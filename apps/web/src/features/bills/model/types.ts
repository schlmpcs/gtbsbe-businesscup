// View-model contract of the bills calendar (/tools/bills). The ui/ files import only this file,
// @/ui-kit and @/copy: every date, total and flag is worked out in the model.
import type { Money } from '@lifeguessr/types';

export type BillCadenceVM = 'monthly' | 'quarterly' | 'yearly';
export type BillKindVM = 'rent' | 'debt' | 'subscription';
export type ExportOutcomeVM = 'downloaded' | 'opened' | 'failed';

/** A date to show: `iso` 'YYYY-MM-DD', `weekday` 0 = Sunday. */
export type DayVM = { iso: string; day: number; weekday: number };

export type BillVM = {
  id: string;
  kind: BillKindVM;
  label: string;
  amount: Money;
  amountIsEstimate: boolean;
  cadence: BillCadenceVM;
  /** The due day as set (1-31). */
  dueDay: number;
  /** We assumed the day: rent and debts until the user picks one. */
  dueDayIsEstimate: boolean;
  /** The user picked this day (they can go back to our guess). */
  dueDaySetByUser: boolean;
};

export type ChargeVM = { bill: BillVM; date: DayVM; isToday: boolean; /** Due before today. */ isPast: boolean };

export type CalendarCellVM = {
  /** Day of the month, or null for the padding before the 1st and after the last day. */
  day: number | null;
  iso: string | null;
  isToday: boolean;
  /** Before today. */
  isPast: boolean;
  charges: ChargeVM[];
  total: Money;
};

export type MonthVM = {
  /** 'YYYY-MM' of the month on screen. */
  month: string;
  year: number;
  isCurrent: boolean;
  /** Calendar weeks, Sunday first, 7 cells each. */
  weeks: CalendarCellVM[][];
  /** Every charge in the month, by date. */
  charges: ChargeVM[];
  total: Money;
  /** At least one amount in the total is an estimate. */
  totalIsEstimate: boolean;
  /** Due before today (gone out, by due date), and due today or later. A past month is all paid. */
  paid: { total: Money; count: number };
  toPay: { total: Money; count: number };
  /** The month's total by kind (only kinds with a charge), `share` of the total 0–1, for the split bar. */
  byKind: { kind: BillKindVM; total: Money; count: number; share: number }[];
  /**
   * The plain answer: toPay (current month, something still due), clear (current month, all gone out),
   * future / past (another month), nothing (no bill falls in it).
   */
  verdict: 'toPay' | 'clear' | 'future' | 'past' | 'nothing';
  /** Take-home pay a month minus the month's bills; null without a take-home pay. */
  leftAfter: { takeHome: Money; amount: Money; isEstimate: boolean } | null;
};

export type BillsVM =
  | { status: 'loading' }
  | { status: 'empty'; uploadHref: string }
  | {
      status: 'ready';
      today: DayVM;
      month: MonthVM;
      prevMonth: () => void;
      nextMonth: () => void;
      thisMonth: () => void;
      /** Due today and in the six days after it (spans into next month). */
      soon: { charges: ChargeVM[]; total: Money; totalIsEstimate: boolean };
      beforePayday: { payday: DayVM; charges: ChargeVM[]; total: Money; totalIsEstimate: boolean } | null;
      paydays: { days: number[]; isEstimate: boolean };
      setPaydays: (days: number[]) => void;
      /** Every bill we know of, for the due-day editor. */
      bills: BillVM[];
      /** Set a bill's due day (1-31); null goes back to our default. */
      setDueDay: (billId: string, day: number | null) => void;
      exportCalendar: () => void;
      exportOutcome: ExportOutcomeVM | null;
    };

/** S1 Home: the next charge, or null when none is known. */
export type NextBillVM = { label: string; amount: Money; inDays: number; date: DayVM } | null;
