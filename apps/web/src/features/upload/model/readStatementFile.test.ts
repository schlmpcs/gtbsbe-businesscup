import { readStatementFixtureCsv, readStatementSampleCsv } from '@lifeguessr/data/fixtures/node';
import { COST_CATEGORIES, type StatementItem } from '@lifeguessr/types';
import { describe, expect, it, vi } from 'vitest';
import type { CategorizeOptions } from '@/lib/api/statement';
import { MAX_STATEMENT_FILE_BYTES, readStatementFile, StatementFileError } from './readStatementFile';

const zeros = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<(typeof COST_CATEGORIES)[number], number>;
const fakeCategorize = vi.fn(async (items: readonly StatementItem[], _opts?: CategorizeOptions) => ({
  months: [...new Set(items.map((i) => i.month))].sort().map((month) => ({ month, totals: zeros, oneOffs: [] })),
  categorizedBy: 'rules' as const,
}));

const problem = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (err) {
    return err instanceof StatementFileError ? err.problem : 'other';
  }
  return null;
};

describe('readStatementFile', () => {
  it('parses in the browser and sends only masked label, amount, month and day', async () => {
    const file = new File([readStatementSampleCsv()], 'Chase1234_Activity.CSV', { type: 'text/csv' });
    const result = await readStatementFile(file, { categorize: fakeCategorize, anonId: 'anon-12345678' });

    const [items, opts] = fakeCategorize.mock.calls.at(-1)!;
    expect(opts).toEqual({ anonId: 'anon-12345678' });
    expect(items).toHaveLength(170);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['amount', 'day', 'label', 'month']);
    const sent = JSON.stringify(items);
    expect(sent).not.toMatch(/Tom Becker|Maria Lopez|Daniel Kim|PRIYA SHAH|Jake Morris|7339\.80|DEBIT_CARD|2026-11-12/);
    expect(items).toContainEqual({ label: 'Zelle to [name]', amount: 40, month: '2026-11', day: 7 });

    expect(result.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(result.summary).toEqual({
      transactions: 170, skippedPending: 0, skippedOther: 0,
      from: '2026-07-01', to: '2026-11-12', convention: 'outflowNegative', categorizedBy: 'rules',
    });
  });

  it('keeps how each sent line was sorted, and the follow-ups, only when the server describes every line', async () => {
    const csv = 'Date,Description,Amount\n2026-10-01,TARGET 1234 DALLAS,-60\n2026-10-02,ACME PAYROLL,2400';
    const followUp = { id: 'merchant:TARGET DALLAS', kind: 'merchant' as const, key: 'TARGET DALLAS', label: 'TARGET # DALLAS', monthly: 60 };
    const categorize = vi.fn(async (items: readonly StatementItem[]) => ({
      ...(await fakeCategorize(items)),
      lines: [{ cls: 'other' as const, oneOffHint: false }, { cls: 'pay' as const, oneOffHint: false }],
      followUps: [followUp],
    }));
    const read = await readStatementFile(new File([csv], 'a.csv', { type: 'text/csv' }), { categorize });
    expect(read.classified).toEqual([
      { label: 'TARGET # DALLAS', amount: 60, month: '2026-10', day: 1, cls: 'other', oneOffHint: false },
      { label: 'ACME PAYROLL', amount: -2400, month: '2026-10', day: 2, cls: 'pay', oneOffHint: false },
    ]);
    expect(read.followUps).toEqual([followUp]);

    // A reply whose line classes don't line up with what was sent: nothing can be re-sorted, so no questions.
    categorize.mockImplementationOnce(async (items) => ({ ...(await fakeCategorize(items)), lines: [], followUps: [followUp] }));
    const odd = await readStatementFile(new File([csv], 'a.csv', { type: 'text/csv' }), { categorize });
    expect(odd).toMatchObject({ classified: null, followUps: [] });
  });

  it('counts skipped pending lines', async () => {
    const file = new File([readStatementFixtureCsv('credit-card')], 'card.csv', { type: '' });
    const { summary } = await readStatementFile(file, { categorize: fakeCategorize });
    expect(summary).toMatchObject({ transactions: 10, skippedPending: 2, skippedOther: 0, convention: 'outflowPositive' });
  });

  it('refuses files it cannot use, before sending anything', async () => {
    fakeCategorize.mockClear();
    const csv = (text: string, name = 'a.csv', type = 'text/csv') => readStatementFile(new File([text], name, { type }), { categorize: fakeCategorize });
    expect(await problem(csv('x', 'statement.pdf', 'application/pdf'))).toBe('notCsv');
    expect(await problem(readStatementFile(
      new File([new Uint8Array(MAX_STATEMENT_FILE_BYTES + 1)], 'big.csv', { type: 'text/csv' }), { categorize: fakeCategorize },
    ))).toBe('tooLarge');
    expect(await problem(csv(''))).toBe('empty');
    expect(await problem(csv('a,b\n"x'))).toBe('malformed');
    expect(await problem(csv('Name,Age\nAnn,30'))).toBe('noColumns');
    expect(await problem(csv('Date,Description,Amount\n2026-10-01,FREE,0.00'))).toBe('noTransactions');
    const many = ['Date,Description,Amount', ...Array.from({ length: 5_001 }, (_, i) => `2026-10-01,SHOP ${i},-1`)].join('\n');
    expect(await problem(csv(many))).toBe('tooMany');
    expect(fakeCategorize).not.toHaveBeenCalled();
  });
});
