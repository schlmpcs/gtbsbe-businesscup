// MP10 (#170): the browser-only Transactions store. Node has no IndexedDB, so every store here runs on
// the memory fallback (memoryRecordStore), the same code path a browser without IndexedDB takes.
import { readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { transactionsDemo } from '@lifeguessr/data/fixtures/plan';
import { merchantKey, statementTotals, type ClassifiedStatementItem } from '@lifeguessr/engine';
import { COST_CATEGORIES, type CostCategory, type LedgerTransaction, type StatementItem } from '@lifeguessr/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategorizeOptions } from '@/lib/api/statement';
import { memoryRecordStore } from './idb';
import { createTransactionStore, transactionTotals, type StoredTransaction } from './transactions';

const zeros = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;

/** A categorizer stand-in: one class per line sent, in order (as the real route answers). No model. */
const fakeCategorize = async (items: readonly StatementItem[], _opts?: CategorizeOptions) => ({
  months: [...new Set(items.map((i) => i.month))].sort().map((month) => ({ month, totals: zeros, oneOffs: [] })),
  categorizedBy: 'rules' as const,
  lines: items.map((i) => ({ cls: i.amount < 0 ? ('pay' as const) : ('other' as const), oneOffHint: false })),
});

const csvFile = (text: string, name = 'activity.csv') => new File([text], name, { type: 'text/csv' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transactions store: CSV import', () => {
  it('imports the sample statement twice without duplicates', async () => {
    const store = createTransactionStore({ db: memoryRecordStore() });

    const first = await store.importFile(csvFile(readStatementSampleCsv()), { categorize: fakeCategorize, remember: false });
    // statement.sample.csv has 170 transaction lines, none with a zero amount (readStatementFile.test.ts).
    expect(first.added).toBe(170);
    expect(store.list()).toHaveLength(170);

    const second = await store.importFile(csvFile(readStatementSampleCsv()), { categorize: fakeCategorize, remember: false });
    expect(second).toMatchObject({ added: 0, duplicates: 170 });
    expect(store.list()).toHaveLength(170);
    expect(new Set(store.list().map((t) => t.id)).size).toBe(170);

    // Two identical lines in one file (two $5.00 coffees the same day) are two purchases: both are kept,
    // and importing that file again still adds nothing.
    const twice = 'Date,Description,Amount\n2026-11-14,BLUE BOTTLE COFFEE,-5.00\n2026-11-14,BLUE BOTTLE COFFEE,-5.00\n';
    expect((await store.importFile(csvFile(twice), { categorize: fakeCategorize, remember: false })).added).toBe(2);
    expect((await store.importFile(csvFile(twice), { categorize: fakeCategorize, remember: false })).added).toBe(0);
    expect(store.list()).toHaveLength(172);
  });

  it('sends only { label (masked), amount, month, day } per line, and nothing else', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { items } = JSON.parse(init.body as string) as { items: StatementItem[] };
      return new Response(JSON.stringify({
        ok: true,
        months: [{ month: '2026-10', totals: zeros, oneOffs: [] }],
        categorizedBy: 'rules',
        lines: items.map((i) => ({ cls: i.amount < 0 ? 'pay' : 'groceries', oneOffHint: false })),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const raw = [
      'Posting Date,Description,Amount,Balance',
      '10/01/2026,Zelle payment to Tom Becker JPM99K1L2M3N,-40.00,1000.00',
      '10/02/2026,ACME CORP DES:PAYROLL ID:XXXXX12345 INDN:JOHN A DOE CO ID:1234567890 PPD,2400.00,3400.00',
      '10/03/2026,ALDI 75216 DALLAS TX,-101.70,3298.30',
    ].join('\n');
    const store = createTransactionStore({ db: memoryRecordStore() });
    await store.importFile(csvFile(raw, 'Chase1234_Activity.CSV'), { anonId: 'anon-12345678', remember: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/statement/categorize');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['items']);
    // The existing contract (toStatementItems): amount > 0 = money out; the CSV's -40.00 is 40 out.
    expect(body.items).toEqual([
      { label: 'Zelle to [name]', amount: 40, month: '2026-10', day: 1 },
      { label: 'ACME CORP DES:PAYROLL ID:# INDN:[name] CO ID:# PPD', amount: -2400, month: '2026-10', day: 2 },
      { label: 'ALDI # DALLAS TX', amount: 101.7, month: '2026-10', day: 3 },
    ]);
    for (const item of body.items as object[]) expect(Object.keys(item).sort()).toEqual(['amount', 'day', 'label', 'month']);
    expect(init.body as string).not.toMatch(/Tom Becker|JOHN A DOE|JPM99K1L2M3N|12345|1234567890|75216|3298\.30|Chase1234|2026-10-0/);

    // The stored lines hold the masked label too, with the ledger's sign (+ in, − out) and the full date.
    expect(store.list().map(({ date, label, amount, cls }) => ({ date, label, amount, cls }))).toEqual([
      { date: '2026-10-03', label: 'ALDI # DALLAS TX', amount: -101.7, cls: 'groceries' },
      { date: '2026-10-02', label: 'ACME CORP DES:PAYROLL ID:# INDN:[name] CO ID:# PPD', amount: 2400, cls: 'pay' },
      { date: '2026-10-01', label: 'Zelle to [name]', amount: -40, cls: 'groceries' },
    ]);
  });
});

describe('transactions store: category override', () => {
  it('"apply to all from this merchant" changes only the lines with the same merchantKey', async () => {
    const store = createTransactionStore({ db: memoryRecordStore<StoredTransaction>(transactionsDemo) });
    await store.load();

    // tx-003 is 'TOM THUMB # DALLAS TX' (groceries); the demo has 7 lines whose merchantKey is 'TOM THUMB DALLAS TX'.
    const key = merchantKey('TOM THUMB # DALLAS TX');
    const sameMerchant = transactionsDemo.filter((t) => merchantKey(t.label) === key).map((t) => t.id);
    expect(sameMerchant).toHaveLength(7);

    const changed = await store.setCategory('tx-003', 'eatingOut', { applyToMerchant: true });
    expect(changed).toBe(7);

    const after = new Map(store.list().map((t) => [t.id, t]));
    for (const before of transactionsDemo) {
      const now = after.get(before.id)!;
      if (sameMerchant.includes(before.id)) {
        expect(now).toEqual({ ...before, cls: 'eatingOut', categoryOverridden: true });
      } else {
        expect(now).toEqual(before);
      }
    }

    // Without "apply to all" only the one line changes.
    expect(await store.setCategory('tx-013', 'other')).toBe(1);
    expect(store.list().filter((t) => t.cls === 'other' && merchantKey(t.label) === 'ALDI DALLAS TX').map((t) => t.id))
      .toEqual(['tx-013']);
  });

  it('totals after an override match statementTotals on the edited lines', async () => {
    const lines: LedgerTransaction[] = [
      { id: 'a', date: '2026-10-01', label: 'TOM THUMB # DALLAS TX', amount: -100, cls: 'groceries', categoryOverridden: false },
      { id: 'b', date: '2026-10-02', label: 'TOM THUMB #2 DALLAS TX', amount: -50.25, cls: 'groceries', categoryOverridden: false },
      { id: 'c', date: '2026-10-03', label: 'ALDI # DALLAS TX', amount: -30, cls: 'groceries', categoryOverridden: false },
      { id: 'd', date: '2026-10-04', label: 'ACME PAYROLL', amount: 2000, cls: 'pay', categoryOverridden: false },
    ];
    const store = createTransactionStore({ db: memoryRecordStore<StoredTransaction>(lines) });
    await store.load();
    await store.setCategory('a', 'eatingOut', { applyToMerchant: true }); // a and b: both 'TOM THUMB DALLAS TX'

    // The same lines edited by hand, as statement items (amount > 0 = money out).
    const edited: ClassifiedStatementItem[] = [
      { label: 'TOM THUMB # DALLAS TX', amount: 100, month: '2026-10', day: 1, cls: 'eatingOut', oneOffHint: false },
      { label: 'TOM THUMB #2 DALLAS TX', amount: 50.25, month: '2026-10', day: 2, cls: 'eatingOut', oneOffHint: false },
      { label: 'ALDI # DALLAS TX', amount: 30, month: '2026-10', day: 3, cls: 'groceries', oneOffHint: false },
      { label: 'ACME PAYROLL', amount: -2000, month: '2026-10', day: 4, cls: 'pay', oneOffHint: false },
    ];
    const totals = transactionTotals(store.list());
    expect(totals).toEqual(statementTotals(edited));

    // By hand: eatingOut = 100 + 50.25 = 150.25; groceries = 30 (only ALDI is left); pay in = 2,000;
    // one month only, so nothing is a one-off; lines run from the 1st to the 4th.
    expect(totals).toEqual([{
      month: '2026-10',
      totals: { ...zeros, eatingOut: 150.25, groceries: 30 },
      oneOffs: [],
      detectedPay: 2000,
      firstDay: 1,
      lastDay: 4,
    }]);
  });
});
