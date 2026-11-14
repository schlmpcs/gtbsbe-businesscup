import { statementItemsSample } from '@lifeguessr/data/fixtures/tools';
import { MAX_STATEMENT_FOLLOW_UPS, StatementFollowUpSchema, type StatementClass } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { statementFollowUpMinMonthly } from './assumptions';
import { applyFollowUpAnswers, followUpKey, statementFollowUps } from './followUps';
import { statementTotals, type ClassifiedStatementItem } from './statement';

const line = (month: string, label: string, amount: number, cls: StatementClass, day = 5): ClassifiedStatementItem =>
  ({ month, day, label, amount, cls, oneOffHint: false });

/** A plain household's month: rent, groceries and a few charges at an unclear store, first to last day. */
const month = (mo: string, extra: ClassifiedStatementItem[] = []) => [
  line(mo, 'OAKWOOD APTS WEB PMTS', 1720, 'rentUtilities', 1),
  line(mo, 'KROGER #', 450, 'groceries', 12),
  line(mo, 'ACME PAYROLL PPD ID: #', -2400, 'pay', 28),
  ...extra,
];

describe('statementFollowUps', () => {
  it('asks about the biggest unclear merchants, with their monthly amount computed in code', () => {
    const items = ['2026-08', '2026-09', '2026-10'].flatMap((mo) => month(mo, [
      line(mo, 'TARGET # DALLAS TX', 90, 'other', 3),
      line(mo, 'CVS/PHARMACY # DALLAS TX', 30, 'other', 9),
      line(mo, 'HOME DEPOT #', 10, 'other', 20), // $10 a month: not worth a question
    ]));
    const asked = statementFollowUps(items);
    expect(asked).toEqual([
      { id: 'merchant:TARGET DALLAS TX', kind: 'merchant', key: 'TARGET DALLAS TX', label: 'TARGET # DALLAS TX', monthly: 90 },
      { id: 'merchant:CVS PHARMACY DALLAS TX', kind: 'merchant', key: 'CVS PHARMACY DALLAS TX', label: 'CVS/PHARMACY # DALLAS TX', monthly: 30 },
    ]);
    for (const f of asked) expect(StatementFollowUpSchema.safeParse(f).success).toBe(true);
  });

  it('puts a missing essential category first, then cash, then merchants; never more than a few', () => {
    const items = ['2026-09', '2026-10'].flatMap((mo) => [
      line(mo, 'OAKWOOD APTS', 1720, 'rentUtilities', 1),
      line(mo, 'ACME PAYROLL', -2400, 'pay', 30),
      line(mo, 'TARGET #', 200, 'other', 4),
      line(mo, 'AMAZON MKTPL*[ref]', 150, 'other', 6),
      line(mo, 'Zelle to [name]', 300, 'other', 8),
      line(mo, 'ATM WITHDRAWAL #/# MAIN ST', 60, 'other', 10),
    ]);
    const asked = statementFollowUps(items);
    expect(asked.map((f) => f.id)).toEqual(['missing:groceries', 'cash:cash', 'merchant:ZELLE TO']);
    expect(asked).toHaveLength(MAX_STATEMENT_FOLLOW_UPS);
    expect(asked[0]).toEqual({ id: 'missing:groceries', kind: 'missing', key: 'groceries', category: 'groceries', monthly: 0 });
    expect(asked[1]).toMatchObject({ kind: 'cash', monthly: 60, label: 'ATM WITHDRAWAL #/# MAIN ST' });
  });

  it('groups every cash withdrawal into one question, whatever the machine', () => {
    expect(followUpKey('ATM WITHDRAWAL #/# GREENVILLE AVE')).toBe('cash');
    expect(followUpKey('CASH WITHDRAWAL BRANCH #')).toBe('cash');
    expect(followUpKey('TARGET #')).toBe('TARGET');
    const items = ['2026-09', '2026-10'].flatMap((mo) => month(mo, [
      line(mo, 'ATM WITHDRAWAL #/# GREENVILLE AVE', 40, 'other', 3),
      line(mo, 'ATM WITHDRAWAL #/# ELM ST', 20, 'other', 17),
    ]));
    expect(statementFollowUps(items)).toEqual([
      { id: 'cash:cash', kind: 'cash', key: 'cash', label: 'ATM WITHDRAWAL #/# ELM ST', monthly: 60 },
    ]);
  });

  it('averages over the full months only, and leaves one-offs and refunds out of the amount', () => {
    const items = [
      ...month('2026-09', [line('2026-09', 'TARGET #', 100, 'other', 3), { ...line('2026-09', 'DFW ANIMAL HOSPITAL', 900, 'other', 9), oneOffHint: true }]),
      ...month('2026-10', [line('2026-10', 'TARGET #', 100, 'other', 3), line('2026-10', 'TARGET #', -40, 'other', 6)]),
      // November runs to the 6th: not a full month, so its $300 at Target is not averaged in.
      line('2026-11', 'TARGET #', 300, 'other', 2),
      line('2026-11', 'KROGER #', 50, 'groceries', 6),
    ];
    const [target, ...rest] = statementFollowUps(items);
    expect(target).toMatchObject({ key: 'TARGET', monthly: 80 });
    expect(rest).toEqual([]); // the vet bill is a one-off: nothing to ask
  });

  it('asks nothing when every line has a clear category, and does not call housing missing in a two-week export', () => {
    expect(statementFollowUps(month('2026-10'))).toEqual([]);
    expect(statementFollowUps([line('2026-11', 'KROGER #', 80, 'groceries', 2), line('2026-11', 'KROGER #', 80, 'groceries', 14)])).toEqual([]);
    expect(statementFollowUps([])).toEqual([]);
  });

  it('skips groups under the minimum and labels that are nothing but masks', () => {
    const just = statementFollowUpMinMonthly.value;
    const items = month('2026-10', [line('2026-10', 'SHOP A', just, 'other'), line('2026-10', 'SHOP B', just - 0.01, 'other'), line('2026-10', '[name]', 500, 'other')]);
    expect(statementFollowUps(items).map((f) => f.key)).toEqual(['SHOP A']);
  });

  it('asks about the sample statement’s cash first, then its two biggest unclear stores', () => {
    // The sample's lines sorted as the keyword rules sort them (no API key): Target, CVS, Amazon
    // Marketplace, payments to people by Zelle and one ATM withdrawal end up in 'other'.
    const unclear = /TARGET|CVS|AMAZON MKTPL|Zelle to|ATM|HOME DEPOT|Venmo \[name\]$/;
    const housing = /APTS|ENERGY|SPECTRUM/;
    const clsOf = (label: string, amount: number): StatementClass =>
      amount < 0 ? 'transfer' : unclear.test(label) ? 'other' : housing.test(label) ? 'rentUtilities' : 'groceries';
    const items: ClassifiedStatementItem[] = statementItemsSample.map((i) => ({ ...i, cls: clsOf(i.label, i.amount), oneOffHint: false }));
    const asked = statementFollowUps(items);
    expect(asked.map((f) => f.id)).toEqual(['cash:cash', 'merchant:CVS PHARMACY DALLAS TX', 'merchant:TARGET DALLAS TX']);
    expect(asked[0]!.monthly).toBe(25); // one $100 withdrawal over the four full months (July to October)
  });
});

describe('applyFollowUpAnswers', () => {
  const items = ['2026-09', '2026-10'].flatMap((mo) => month(mo, [
    line(mo, 'TARGET #', 120, 'other', 3),
    line(mo, 'ATM WITHDRAWAL #/# MAIN ST', 60, 'other', 10),
  ]));
  const followUps = statementFollowUps(items);

  it('re-sorts the answered group, and the totals move with it, cent for cent', () => {
    const answered = applyFollowUpAnswers(items, followUps, { 'merchant:TARGET': 'groceries', 'cash:cash': 'eatingOut' });
    const [before, after] = [statementTotals(items)[1]!, statementTotals(answered)[1]!];
    expect(after.totals.groceries).toBe(before.totals.groceries + 120);
    expect(after.totals.eatingOut).toBe(60);
    expect(after.totals.other).toBe(0);
    expect(items.filter((i) => i.cls === 'other')).toHaveLength(4); // the input is left alone
  });

  it('changes nothing for skipped questions, unknown ids or a debt-payments answer', () => {
    expect(applyFollowUpAnswers(items, followUps, {})).toEqual(items);
    expect(applyFollowUpAnswers(items, followUps, { 'merchant:NOPE': 'groceries' })).toEqual(items);
    expect(applyFollowUpAnswers(items, followUps, { 'merchant:TARGET': 'debtPayments' })).toEqual(items);
  });
});
