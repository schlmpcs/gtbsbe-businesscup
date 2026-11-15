// Bills calendar: where the bills come from. Pure: the hook passes in the profile, the renewals of the
// subscription audit (lib/ics `renewalsFromFindings`), the user's due days and the labels (from copy).
//
//   - rent & utilities: the profile's monthly rentUtilities line, one bill (its estimate flag is kept);
//   - each debt: its monthly minimum payment (plus any extra payment a done move set);
//   - each subscription the audit found with a next date: its charge and cadence, on its billing day.
//
// Due days: the user's own (from the store) win. Otherwise a subscription is due on the day the
// statement showed (measured); rent and debts get an assumed day, tagged as an estimate.
import type { Debt, Profile } from '@lifeguessr/types';
import type { RenewalItem } from '@/lib/ics';
import { validDueDay, type BillDef } from './calendar';

/** Assumption: rent is due on the 1st (the usual US lease term). Shown with an estimate tag. */
export const DEFAULT_RENT_DUE_DAY = 1;
/** Assumption: loan and card payments on the 20th (statements close mid-month, due about 3 weeks later). */
export const DEFAULT_DEBT_DUE_DAY = 20;
/** Assumption when the user has not said: paid on the 1st and the 15th (semi-monthly pay). */
export const DEFAULT_PAYDAYS: readonly number[] = [1, 15];

export const RENT_BILL_ID = 'rent';
export const debtBillId = (debtId: string): string => `debt:${debtId}`;
export const subscriptionBillId = (findingId: string): string => `sub:${findingId}`;

export type BillLabels = {
  rent: string;
  debt: (kind: Debt['kind']) => string;
};

export type BillSources = {
  profile: Profile;
  renewals: readonly RenewalItem[];
  /** The user's due days by bill id. */
  dueDays: Readonly<Record<string, number>>;
  labels: BillLabels;
};

function withDay(def: Omit<BillDef, 'dueDay' | 'dueDayIsEstimate'>, dueDays: BillSources['dueDays'], fallback: number, fallbackIsEstimate: boolean): BillDef {
  const own = validDueDay(dueDays[def.id]);
  return own !== null
    ? { ...def, dueDay: own, dueDayIsEstimate: false }
    : { ...def, dueDay: fallback, dueDayIsEstimate: fallbackIsEstimate };
}

/** Every bill we know of, rent first, then debts, then subscriptions (the calendar sorts by date). */
export function billsFromSources({ profile, renewals, dueDays, labels }: BillSources): BillDef[] {
  const bills: BillDef[] = [];
  const rent = profile.spending.rentUtilities;
  if (Number.isFinite(rent.value) && rent.value > 0) {
    bills.push(
      withDay(
        { id: RENT_BILL_ID, kind: 'rent', label: labels.rent, amount: rent.value, amountIsEstimate: rent.isEstimate, cadence: 'monthly' },
        dueDays,
        DEFAULT_RENT_DUE_DAY,
        true,
      ),
    );
  }
  for (const debt of profile.debts) {
    const amount = debt.minPayment.value + (debt.extraPayment ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    bills.push(
      withDay(
        { id: debtBillId(debt.id), kind: 'debt', label: labels.debt(debt.kind), amount, amountIsEstimate: debt.minPayment.isEstimate, cadence: 'monthly' },
        dueDays,
        DEFAULT_DEBT_DUE_DAY,
        true,
      ),
    );
  }
  for (const r of renewals) {
    if (!Number.isFinite(r.amount) || r.amount <= 0) continue;
    const measured = validDueDay(r.billingDay) ?? validDueDay(r.next.day) ?? 1;
    bills.push(
      withDay(
        { id: subscriptionBillId(r.id), kind: 'subscription', label: r.label, amount: r.amount, amountIsEstimate: false, cadence: r.cadence, anchorMonth: r.next.month },
        dueDays,
        measured,
        false,
      ),
    );
  }
  return bills;
}

/**
 * The paydays to use: the user's (valid days, deduplicated, in order), else the default 1st and 15th
 * with `isEstimate: true`.
 */
export function paydaysFrom(saved: readonly number[] | null | undefined): { days: number[]; isEstimate: boolean } {
  const days = [...new Set((saved ?? []).filter((d) => validDueDay(d) !== null))].sort((a, b) => a - b);
  return days.length > 0 ? { days, isEstimate: false } : { days: [...DEFAULT_PAYDAYS], isEstimate: true };
}

// ----- the same items as Recurring (/recurring) -------------------------------------------------------

/** One item of Recurring (features/recurring/model/items) the calendar can place, with the name to show. */
export type RecurringBillSource = {
  /** Recurring's item id: 'rent', 'account:<id>' or a subscription finding id. */
  id: string;
  origin: 'statement' | 'profile' | 'account';
  section: 'income' | 'expenses' | 'creditCards';
  label: string;
  amount: number;
  cadence: BillDef['cadence'];
  /** The month of the last charge (anchors a quarterly or yearly one); null for monthly ones. */
  anchor: string | null;
  dayOfMonth: number | null;
  dayIsEstimate: boolean;
  amountIsEstimate: boolean;
};

/** The calendar's id of a Recurring item: rent stays 'rent', an account payment 'account:<id>', a finding 'sub:<id>'. */
export const billIdOfRecurring = (item: Pick<RecurringBillSource, 'id' | 'origin'>): string =>
  item.origin === 'statement' ? subscriptionBillId(item.id) : item.id;

/**
 * Recurring's bills (not income) as calendar bills, so /tools/bills and /recurring show the same items
 * and amounts: rent and the accounts' payments (assumed days), the charges the statement detector found
 * (their own day). The user's due days win, as in billsFromSources.
 */
export function billsFromRecurring(items: readonly RecurringBillSource[], dueDays: BillSources['dueDays']): BillDef[] {
  const bills: BillDef[] = [];
  for (const item of items) {
    if (item.section === 'income' || !Number.isFinite(item.amount) || item.amount <= 0) continue;
    const kind: BillDef['kind'] = item.origin === 'statement' ? 'subscription' : item.origin === 'account' ? 'debt' : 'rent';
    const fallback = validDueDay(item.dayOfMonth) ?? (kind === 'debt' ? DEFAULT_DEBT_DUE_DAY : DEFAULT_RENT_DUE_DAY);
    const def: Omit<BillDef, 'dueDay' | 'dueDayIsEstimate'> = {
      id: billIdOfRecurring(item),
      kind,
      label: item.label,
      amount: item.amount,
      amountIsEstimate: item.amountIsEstimate,
      cadence: item.cadence,
      ...(item.anchor ? { anchorMonth: item.anchor } : {}),
    };
    bills.push(withDay(def, dueDays, fallback, item.dayOfMonth === null || item.dayIsEstimate));
  }
  return bills;
}
