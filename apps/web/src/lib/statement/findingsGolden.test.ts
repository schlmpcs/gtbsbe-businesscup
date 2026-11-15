// JF7 golden test: the engine's income and debt detection (findIncomeAndDebts) run the way the
// browser runs it, on statements read by the real CSV reader and masked by the real mask. It lives
// here, like subscriptionsGolden.test.ts, because the reader and the mask are browser code the
// engine package cannot import. The engine's own tests (packages/engine/findings.test.ts) use small
// statements written inline.
//
// 1. The sample statement (statement.sample.csv) must give exactly `statementFindings.sample.json`:
//    the biweekly ACME paycheck, the Capital One card and the Toyota car loan.
// 2. The 50 synthetic household statements (packages/data/fixtures/synthetic-statements) have an
//    answer key for every row, and a brief per household (earners, pay schedule, debts). We measure
//    against them and hold a floor, so a change that makes detection worse fails here:
//    - pay rows: precision against rows the key calls income; recall against the income that comes
//      from an employer or a platform (the key's income minus interest, cash deposits and P2P);
//    - debt rows: precision and recall against rows the key files under debtPayments;
//    - per household: the debts the brief lists, by kind, found or not; and the take-home found vs
//      the brief's estimate for salaried and hourly households (gig and freelance briefs give gross).
// The numbers printed by the last test are the ones quoted in the PR. They are accuracy on
// synthetic data and should be reported that way (synthetic-statements/README.md).
import {
  listSyntheticStatements, readStatementSampleCsv, readSyntheticAnswerKey, readSyntheticStatement,
} from '@lifeguessr/data/fixtures/node';
import { statementFindingsSample } from '@lifeguessr/data/fixtures';
import { detectStatementFindings, findIncomeAndDebts, type FindingLine } from '@lifeguessr/engine';
import { StatementFindingsSchema, type Transaction } from '@lifeguessr/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { syntheticStatementsDir } from '@lifeguessr/data/fixtures/node';
import { describe, expect, it } from 'vitest';
import { numberedRowsOf } from './csv';
import { maskLabel } from './mask';
import { parseDate, readStatementCsv } from './read';

/** What the browser hands the engine (features/upload/model/readStatementFile does the same). */
const findingLines = (transactions: readonly Transaction[]): FindingLine[] =>
  transactions.map((t) => ({ date: t.date, amount: t.amount, text: t.description, label: maskLabel(t.description) }));

describe('findIncomeAndDebts on the sample statement', () => {
  const lines = findingLines(readStatementCsv(readStatementSampleCsv()).transactions);

  it('finds the paycheck, the card and the car loan, exactly as the fixture says', () => {
    const findings = findIncomeAndDebts(lines);
    expect(StatementFindingsSchema.safeParse(findings).success).toBe(true);
    expect(findings).toEqual(statementFindingsSample);
  });

  it('shows no raw-only text: every name is a lender from the list or comes from a masked label', () => {
    const shown = JSON.stringify(findIncomeAndDebts(lines));
    expect(shown).not.toMatch(/Tom Becker|Maria Lopez|Daniel Kim|PRIYA SHAH|Jake Morris|PPD ID|WEB ID|\d{6,}/i);
  });
});

// ----- the 50 synthetic statements ---------------------------------------------------------------

type Truth = { category: string; kind: string };

const keyByFile = new Map<string, Truth[]>();
for (const line of readSyntheticAnswerKey().trim().split('\n').slice(1)) {
  const [file, , category, kind] = line.split(',');
  if (!keyByFile.has(file!)) keyByFile.set(file!, []);
  keyByFile.get(file!)!.push({ category: category!, kind: kind! });
}

type Household = { earners: string; takeHome: number; debts: string };
const households = new Map<string, Household>();
{
  const rows = numberedRowsOf(readFileSync(join(syntheticStatementsDir, 'labels', 'households.csv'), 'utf8')).map((r) => r.cells);
  const h = rows[0]!;
  for (const r of rows.slice(1)) {
    households.set(r[h.indexOf('file')]!, {
      earners: r[h.indexOf('earners')]!,
      takeHome: Number(r[h.indexOf('est_monthly_take_home')]),
      debts: r[h.indexOf('debts')]!,
    });
  }
}

/**
 * The reader sorts transactions by date, the key follows the file's row order: pair them by date
 * and description (rows with the same date and description have the same truth in the key).
 */
function truthOf(file: string, transactions: readonly Transaction[]): Truth[] {
  const rows = numberedRowsOf(readSyntheticStatement(file)).map((r) => r.cells);
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  const dateCol = header.findIndex((c) => c.includes('date'));
  const descCol = header.indexOf('description');
  const key = keyByFile.get(file)!;
  const byLine = new Map<string, Truth[]>();
  rows.slice(1).forEach((r, i) => {
    const d = parseDate(r[dateCol]!)!;
    const k = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}|${r[descCol]!.trim()}`;
    byLine.set(k, [...(byLine.get(k) ?? []), key[i]!]);
  });
  return transactions.map((t) => byLine.get(`${t.date}|${t.description}`)!.shift()!);
}

/** Income that comes from someone paying for work: not interest, a cash deposit or a friend. */
const isEarned = (text: string, t: Truth) =>
  t.kind === 'income' && !/interest|cash deposit|zelle|venmo|paypal|pay friends|cash app/i.test(text);

/** The debts a household brief lists, as engine kinds ("auto lease" is a car payment). */
function briefDebtKinds(debts: string): string[] {
  return debts
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d !== '')
    .map((d) => (d.startsWith('card') ? 'card' : d.startsWith('auto') ? 'auto' : d));
}

type Counts = { tp: number; fp: number; fn: number };
const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);

function measure() {
  const pay: Counts = { tp: 0, fp: 0, fn: 0 };
  const debt: Counts = { tp: 0, fp: 0, fn: 0 };
  const kinds = { listed: 0, found: 0, extra: 0 };
  const takeHomeErrors: { file: string; error: number }[] = [];
  const misses: string[] = [];
  for (const file of listSyntheticStatements()) {
    const transactions = readStatementCsv(readSyntheticStatement(file)).transactions;
    const truth = truthOf(file, transactions);
    const { findings, lines } = detectStatementFindings(findingLines(transactions));
    const payLines = new Set(findings.income.flatMap((f) => lines[f.id]!));
    const debtLines = new Set(findings.debts.flatMap((f) => lines[f.id]!));
    transactions.forEach((t, i) => {
      const earned = isEarned(t.description, truth[i]!);
      if (payLines.has(i)) {
        if (truth[i]!.kind === 'income') pay.tp++;
        else {
          pay.fp++;
          misses.push(`${file} pay FP: ${t.description}`);
        }
      } else if (earned) {
        pay.fn++;
        misses.push(`${file} pay FN: ${t.description}`);
      }
      const isDebt = truth[i]!.category === 'debtPayments';
      if (debtLines.has(i)) {
        if (isDebt) debt.tp++;
        else {
          debt.fp++;
          misses.push(`${file} debt FP: ${t.description}`);
        }
      } else if (isDebt) {
        debt.fn++;
        misses.push(`${file} debt FN: ${t.description}`);
      }
    });
    const h = households.get(file)!;
    const want = briefDebtKinds(h.debts);
    const got = findings.debts.map((d) => d.kind as string);
    for (const k of new Set([...want, ...got])) {
      const w = want.filter((x) => x === k).length;
      const g = got.filter((x) => x === k).length;
      kinds.listed += w;
      kinds.found += Math.min(w, g);
      kinds.extra += Math.max(0, g - w);
    }
    if (!/gig|freelance/.test(h.earners)) {
      const found = findings.income.reduce((s, f) => s + f.monthly, 0);
      takeHomeErrors.push({ file, error: Math.abs(found - h.takeHome) / h.takeHome });
    }
  }
  const errors = takeHomeErrors.map((e) => e.error).sort((a, b) => a - b);
  return {
    pay: { precision: ratio(pay.tp, pay.tp + pay.fp), recall: ratio(pay.tp, pay.tp + pay.fn), ...pay },
    debt: { precision: ratio(debt.tp, debt.tp + debt.fp), recall: ratio(debt.tp, debt.tp + debt.fn), ...debt },
    debtKinds: { recall: ratio(kinds.found, kinds.listed), ...kinds },
    takeHome: {
      households: errors.length,
      medianError: errors[Math.floor(errors.length / 2)]!,
      within10: errors.filter((e) => e <= 0.1).length,
      worst: takeHomeErrors.sort((a, b) => b.error - a.error).slice(0, 3),
    },
    misses,
  };
}

describe('findIncomeAndDebts on the 50 synthetic statements', () => {
  const m = measure();

  it('finds pay deposits: precision ≥ 99%, recall ≥ 90% of employer and platform income', () => {
    expect(m.pay.precision).toBeGreaterThanOrEqual(0.99);
    expect(m.pay.recall).toBeGreaterThanOrEqual(0.9);
  });

  it('finds debt payments: precision ≥ 99%, recall ≥ 95%', () => {
    expect(m.debt.precision).toBeGreaterThanOrEqual(0.99);
    expect(m.debt.recall).toBeGreaterThanOrEqual(0.95);
  });

  it('finds the debts each household brief lists, by kind (≥ 90%)', () => {
    expect(m.debtKinds.recall).toBeGreaterThanOrEqual(0.9);
  });

  it('gets salaried and hourly take-home pay close to the brief (median error ≤ 5%)', () => {
    expect(m.takeHome.medianError).toBeLessThanOrEqual(0.05);
  });

  it('reports the measured accuracy', () => {
    const { misses, ...summary } = m;
    if (process.env.FINDINGS_REPORT) console.log(JSON.stringify(summary, null, 2), '\n', misses.join('\n'));
    expect(summary.pay.tp).toBeGreaterThan(0);
  });
});
