// Bills calendar → an .ics file (lib/ics, the renewals writer): one repeating all-day event per bill,
// starting on its next due date, with a reminder the day before. Built and saved in the browser.
import { bills as t } from '@/copy';
import { downloadTextFile, type DownloadOutcome } from '@/lib/download';
import { renewalsToIcs, type RenewalItem } from '@/lib/ics';
import { monthKey, nextOccurrence, type BillDef, type CalDate } from './calendar';

export const BILLS_FILE_NAME = 'lifeguessr-bills.ics';

/**
 * Each bill as a calendar item from `today`: its next charge, and its due day as the billing day when
 * that charge was moved to the end of a short month (due on the 31st, next charge 30 November), so
 * the repeat keeps the month's last day. A bill that never falls (no usable anchor) is left out.
 */
export function billsToRenewalItems(bills: readonly BillDef[], today: CalDate): RenewalItem[] {
  const items: RenewalItem[] = [];
  for (const bill of bills) {
    const next = nextOccurrence(bill, today);
    if (!next) continue;
    const item: RenewalItem = {
      id: `bill-${bill.id}`,
      label: bill.label,
      amount: bill.amount,
      cadence: bill.cadence,
      next: { month: monthKey(next.year, next.month), day: next.day },
    };
    if (bill.dueDay > next.day) item.billingDay = bill.dueDay;
    items.push(item);
  }
  return items;
}

export function billsToIcs(bills: readonly BillDef[], today: CalDate, now: Date): string {
  return renewalsToIcs(billsToRenewalItems(bills, today), {
    now,
    calendarName: t.export.calendarName,
    summaryPrefix: t.export.summaryPrefix,
  });
}

/** Saves the bills as an .ics file. Never throws. */
export function downloadBillsCalendar(bills: readonly BillDef[], today: CalDate, now: Date = new Date()): DownloadOutcome {
  return downloadTextFile(BILLS_FILE_NAME, 'text/calendar', billsToIcs(bills, today, now));
}
