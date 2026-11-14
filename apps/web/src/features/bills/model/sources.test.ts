import { describe, expect, it } from 'vitest';
import { cloneProfileDemo } from '@/fixtures';
import { subscriptionsExpected } from '@/fixtures/tools';
import { renewalsFromFindings } from '@/lib/ics';
import { billsToIcs, billsToRenewalItems } from './exportIcs';
import { billsFromSources, DEFAULT_DEBT_DUE_DAY, DEFAULT_RENT_DUE_DAY, paydaysFrom } from './sources';

const labels = { rent: 'Rent & utilities', debt: (k: string) => `debt ${k}` };
const renewals = renewalsFromFindings(subscriptionsExpected.findings);

describe('billsFromSources', () => {
  it('rent, each debt minimum and each subscription renewal, with assumed days for rent and debts', () => {
    const profile = cloneProfileDemo();
    const bills = billsFromSources({ profile, renewals, dueDays: {}, labels });
    const rent = bills.find((b) => b.id === 'rent')!;
    expect(rent).toMatchObject({ kind: 'rent', amount: 1950, amountIsEstimate: false, dueDay: DEFAULT_RENT_DUE_DAY, dueDayIsEstimate: true });
    const card = bills.find((b) => b.id === 'debt:card-1')!;
    expect(card).toMatchObject({ kind: 'debt', label: 'debt card', amount: 193.92, amountIsEstimate: true, dueDay: DEFAULT_DEBT_DUE_DAY, dueDayIsEstimate: true });
    const netflix = bills.find((b) => b.id === 'sub:netflix-com-ca')!;
    // The statement showed the 7th: measured, not an estimate.
    expect(netflix).toMatchObject({ kind: 'subscription', amount: 17.99, dueDay: 7, dueDayIsEstimate: false, cadence: 'monthly', anchorMonth: '2026-12' });
    expect(bills.filter((b) => b.kind === 'subscription')).toHaveLength(renewals.length);
  });

  it('the user’s due days win; broken ones are ignored', () => {
    const bills = billsFromSources({
      profile: cloneProfileDemo(),
      renewals,
      dueDays: { rent: 3, 'debt:card-1': 40, 'sub:netflix-com-ca': 12 },
      labels,
    });
    expect(bills.find((b) => b.id === 'rent')).toMatchObject({ dueDay: 3, dueDayIsEstimate: false });
    expect(bills.find((b) => b.id === 'debt:card-1')).toMatchObject({ dueDay: DEFAULT_DEBT_DUE_DAY, dueDayIsEstimate: true });
    expect(bills.find((b) => b.id === 'sub:netflix-com-ca')).toMatchObject({ dueDay: 12, dueDayIsEstimate: false });
  });

  it('skips a zero rent line and a debt with no payment; adds a done move’s extra payment', () => {
    const profile = cloneProfileDemo();
    profile.spending.rentUtilities = { value: 0, isEstimate: false };
    profile.debts[0]!.minPayment = { value: 0, isEstimate: false };
    profile.debts[1]!.extraPayment = 100;
    const bills = billsFromSources({ profile, renewals: [], dueDays: {}, labels });
    expect(bills.map((b) => b.id)).toEqual(['debt:auto-1']);
    expect(bills[0]!.amount).toBe(512);
  });
});

describe('paydaysFrom', () => {
  it('defaults to the 1st and 15th as an estimate', () => {
    expect(paydaysFrom(null)).toEqual({ days: [1, 15], isEstimate: true });
    expect(paydaysFrom([])).toEqual({ days: [1, 15], isEstimate: true });
    expect(paydaysFrom([0, 40])).toEqual({ days: [1, 15], isEstimate: true });
  });
  it('keeps the user’s valid days, sorted and unique', () => {
    expect(paydaysFrom([20, 5, 20])).toEqual({ days: [5, 20], isEstimate: false });
  });
});

describe('bills as an .ics file', () => {
  const bills = billsFromSources({ profile: cloneProfileDemo(), renewals, dueDays: { rent: 31 }, labels });
  const today = { year: 2026, month: 11, day: 14 };

  it('starts each bill on its next due date, keeping a month-end day as the billing day', () => {
    const items = billsToRenewalItems(bills, today);
    const rent = items.find((i) => i.id === 'bill-rent')!;
    expect(rent.next).toEqual({ month: '2026-11', day: 30 });
    expect(rent.billingDay).toBe(31);
    const netflix = items.find((i) => i.id === 'bill-sub:netflix-com-ca')!;
    expect(netflix.next).toEqual({ month: '2026-12', day: 7 });
    expect(netflix.billingDay).toBeUndefined();
    expect(items).toHaveLength(bills.length);
  });

  it('writes a calendar with one repeating event per bill', () => {
    const ics = billsToIcs(bills, today, new Date(Date.UTC(2026, 10, 14, 12)));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(bills.length);
    expect(ics).toContain('X-WR-CALNAME:Bills');
    expect(ics).toContain('SUMMARY:Due: Rent & utilities · $1\\,950.00');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261130');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(ics).not.toContain('Renews:');
  });
});
