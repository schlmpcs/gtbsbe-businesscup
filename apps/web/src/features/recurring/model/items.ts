// Pure parts of Recurring: the statement lines as the detector reads them, the items of each section,
// and which items fall in a month. The detection itself is the engine's `detectSubscriptions`, the same
// one the subscription audit (/tools/subscriptions) uses; nothing is detected here.
import { detectSubscriptions } from '@lifeguessr/engine';
import {
  CADENCE_MONTHS, type Account, type LedgerTransaction, type Profile, type StatementClass, type StatementItem, type SubscriptionFinding,
} from '@lifeguessr/types';
import { DEFAULT_DEBT_DUE_DAY, DEFAULT_RENT_DUE_DAY } from '@/features/bills/model/sources';
import { counted, isLiabilityGroup } from '@/features/accounts/model/series';
import type { RecurringItemVM } from './types';

/** The ledger as the masked statement lines the detector reads: money out is positive. */
export function toStatementItems(txs: readonly LedgerTransaction[]): { items: StatementItem[]; classOf: (label: string) => StatementClass | undefined } {
  const classes = new Map<string, StatementClass>();
  const items = txs.map((t) => {
    classes.set(t.label, t.cls);
    return { label: t.label, amount: -t.amount, month: t.date.slice(0, 7), day: Number(t.date.slice(8, 10)) };
  });
  return { items, classOf: (label) => classes.get(label) };
}

/** Findings that are active and not only a pattern (a `low` one waits for the person to confirm it). */
export function detectFindings(txs: readonly LedgerTransaction[]): SubscriptionFinding[] {
  const { items, classOf } = toStatementItems(txs);
  return detectSubscriptions(items, { classOf }).findings.filter((f) => f.status === 'active' && f.confidence !== 'low');
}

/** An item and the month of its last charge (the anchor of a quarterly or yearly cadence); null for those that are monthly. */
export type RecurringSource = { item: RecurringItemVM; anchor: string | null };

export function findingItem(f: SubscriptionFinding): RecurringSource {
  const item: RecurringItemVM = {
    id: f.id,
    section: 'expenses',
    label: f.label,
    labelKey: null,
    origin: 'statement',
    amount: f.amount,
    cadence: f.cadence,
    monthly: f.monthly,
    dayOfMonth: f.lastCharge?.day ?? null,
    dayIsEstimate: false,
    amountIsEstimate: f.isEstimate,
    flags: f.flags,
  };
  return { item, anchor: f.lastCharge?.month ?? null };
}

/** Take-home pay, rent and the accounts' payments: what recurs without a statement. */
export function planItems(profile: Profile, accounts: readonly Account[]): RecurringItemVM[] {
  const base = { cadence: 'monthly' as const, flags: [] };
  const items: RecurringItemVM[] = [
    { ...base, id: 'income:take-home', section: 'income', label: '', labelKey: 'takeHomePay', origin: 'profile', amount: profile.takeHomePay.value, monthly: profile.takeHomePay.value, dayOfMonth: null, dayIsEstimate: false, amountIsEstimate: profile.takeHomePay.isEstimate },
  ];
  const rent = profile.spending.rentUtilities;
  if (rent.value > 0) {
    items.push({ ...base, id: 'rent', section: 'expenses', label: '', labelKey: 'rent', origin: 'profile', amount: rent.value, monthly: rent.value, dayOfMonth: DEFAULT_RENT_DUE_DAY, dayIsEstimate: true, amountIsEstimate: rent.isEstimate });
  }
  for (const a of counted(accounts)) {
    if (!isLiabilityGroup(a.group) || !a.minPayment || a.minPayment.value <= 0) continue;
    const card = a.group === 'creditCard';
    items.push({
      ...base,
      id: `account:${a.id}`,
      section: card ? 'creditCards' : 'expenses',
      label: a.name,
      labelKey: card ? 'card' : 'loan',
      origin: 'account',
      amount: a.minPayment.value,
      monthly: a.minPayment.value,
      dayOfMonth: DEFAULT_DEBT_DUE_DAY,
      dayIsEstimate: true,
      amountIsEstimate: a.minPayment.isEstimate,
    });
  }
  return items;
}

const monthNumber = (month: string): number => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

/** Does the item fall in `month`? Monthly: always. Quarterly and yearly: every 3 or 12 months from the month of its last charge. */
export function occursIn({ item, anchor }: RecurringSource, month: string): boolean {
  if (item.cadence === 'monthly' || anchor === null) return true;
  const step = CADENCE_MONTHS[item.cadence];
  return (((monthNumber(month) - monthNumber(anchor)) % step) + step) % step === 0;
}
