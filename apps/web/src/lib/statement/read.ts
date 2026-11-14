// A bank or card CSV export → Transaction[] (amount > 0 = money out), in the browser (T6).
// Spec: docs/ARCHITECTURE.md → Privacy design. Nothing here does I/O; the raw descriptions stay in
// the browser, and `toStatementItems` masks them before anything is sent.
//
// What it handles, because real exports differ:
// - Columns found by header name, wherever the header row is (some banks put a summary above it),
//   or inferred from the cells when there is no header at all (Wells Fargo).
// - Three amount layouts: separate Debit/Credit columns; one signed Amount column where money out is
//   negative (most bank accounts); one where money out is positive (most credit cards). The sign is
//   read from a Debit/Credit "type" column when there is one, else from pay deposits, else from
//   which sign most lines have (most lines are spending).
// - Dates as YYYY-MM-DD, MM/DD/YYYY, M/D/YY, YYYY/MM/DD or "Oct 1, 2026" (US order, never DD/MM).
// - Amounts like 1,234.50 · $1,234.50 · -$12.50 · ($12.50) · 12.50- · +12.50.
// - Pending lines (a Status column, a "Pending" date or description) are skipped: they show up
//   again once posted. Lines that aren't transactions (totals, notes) are skipped and counted.
// Ported from #55 (parseStatement in apps/web/src/lib/csv.ts), which needed the column mapping and
// the sign convention from the user.
import type { StatementItem, Transaction } from '@lifeguessr/types';
import { CsvSyntaxError, numberedRowsOf } from './csv';
import { maskLabel } from './mask';

export type StatementReadErrorCode =
  | 'empty'          // no rows at all
  | 'malformed'      // broken CSV (an unclosed quote)
  | 'noColumns'      // no date, description and amount columns could be found
  | 'noTransactions'; // columns found, but no line could be read as a transaction

export class StatementReadError extends Error {
  readonly code: StatementReadErrorCode;
  constructor(code: StatementReadErrorCode, message: string) {
    super(message);
    this.name = 'StatementReadError';
    this.code = code;
  }
}

/** How money out was told apart from money in. */
export type SignConvention =
  | 'debitCredit'      // separate Debit and Credit columns
  | 'typeColumn'       // unsigned amounts with a Debit/Credit type column
  | 'outflowNegative'  // signed: money out is negative (bank accounts)
  | 'outflowPositive'; // signed: money out is positive (most card exports)

export type SkipReason = 'pending' | 'notATransaction';

export type StatementRead = {
  /** Oldest first; amount > 0 = money out, < 0 = money in. Raw descriptions: never send these. */
  transactions: Transaction[];
  convention: SignConvention;
  /** The header names used (or "column N" for a file without a header). */
  columns: { date: string; description: string; amount: string[] };
  /** Lines left out; `row` = the 1-based line of the file. */
  skipped: { row: number; reason: SkipReason }[];
};

// ----- cells -----------------------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function validDate(y: number, m: number, d: number): { year: number; month: number; day: number } | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { year: y, month: m, day: d } : null;
}

/** A date cell → its calendar date, or null. US order for slashes (MM/DD), never DD/MM. */
export function parseDate(cell: string): { year: number; month: number; day: number } | null {
  const s = cell.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?: .*)?$/.exec(s);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    return validDate(y, +m[1]!, +m[2]!);
  }
  m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/.exec(s); // Oct 1, 2026 · October 01 2026
  if (m) return validDate(+m[3]!, MONTHS.indexOf(m[1]!.toLowerCase()) + 1, +m[2]!);
  m = /^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})$/.exec(s); // 01 Oct 2026 · 01-Oct-2026
  if (m) return validDate(+m[3]!, MONTHS.indexOf(m[2]!.toLowerCase()) + 1, +m[1]!);
  return null;
}

/** A money cell → dollars (sign as written), null when blank, NaN when it isn't money. */
export function parseMoney(cell: string): number | null {
  let s = cell.trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  if (s === '') return null;
  let negative = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1]!;
  }
  s = s.replace(/^usd|usd$/i, '');
  const sign = /^([+-]?)\$?([+-]?)(.*?)(-?)$/.exec(s)!;
  const signs = [sign[1], sign[2], sign[4]].filter((x) => x !== '');
  if (signs.length > 1) return Number.NaN;
  if (signs[0] === '-') negative = !negative;
  const digits = sign[3]!.replace(/^\$/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$|^\.\d{1,2}$/.test(digits)) return Number.NaN;
  const value = Number(digits.replaceAll(',', ''));
  if (!Number.isFinite(value) || value > 1e9) return Number.NaN;
  return negative && value !== 0 ? -value : value;
}

const isPendingText = (s: string) => /^\s*pending\b/i.test(s);

// ----- columns ---------------------------------------------------------------------------------

type Columns = {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  type?: number;
  status?: number;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9#/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Best header match by priority (lower = better); -1 when none. */
function pick(headers: string[], rules: [RegExp, number][], taken: Set<number> = new Set()): number {
  let best = -1;
  let bestRank = Infinity;
  headers.forEach((h, i) => {
    if (taken.has(i)) return;
    for (const [re, rank] of rules) {
      if (re.test(h) && rank < bestRank) {
        best = i;
        bestRank = rank;
      }
    }
  });
  return best;
}

const DATE_HEADERS: [RegExp, number][] = [
  [/^(trans(action)?|trans) date$/, 1],
  [/^date$/, 2],
  [/^(posting|posted|post) date$|^date posted$/, 3],
  [/\bdate\b/, 4],
];
const DESCRIPTION_HEADERS: [RegExp, number][] = [
  [/^description$/, 1],
  [/^(transaction )?description\b|\bdescription$/, 2],
  [/^(merchant|payee|merchant name|payee name|name)$/, 3],
  [/^(memo|narrative|transaction|details|transaction details)$/, 4],
];
const AMOUNT_HEADERS: [RegExp, number][] = [
  [/^(transaction )?amount( usd)?$|^amt$|^amount \( ?\$? ?\)$/, 1],
  [/\bamount\b(?!.*\b(debit|credit|balance)\b)/, 2],
];
const DEBIT_HEADERS: [RegExp, number][] = [
  [/^(debit|debits|withdrawal|withdrawals|withdrawal amount|debit amount|amount debit|money out|paid out|outflow|charges?)$/, 1],
];
const CREDIT_HEADERS: [RegExp, number][] = [
  [/^(credit|credits|deposit|deposits|deposit amount|credit amount|amount credit|money in|paid in|inflow|payments?)$/, 1],
];
const TYPE_HEADERS: [RegExp, number][] = [
  [/^(type|transaction type|details|dr cr|cr dr|debit credit|credit debit|debit\/credit|credit\/debit)$/, 1],
];
const STATUS_HEADERS: [RegExp, number][] = [[/^(status|transaction status)$/, 1]];

function columnsFromHeader(raw: string[]): Columns | null {
  const headers = raw.map(norm);
  const taken = new Set<number>();
  const date = pick(headers, DATE_HEADERS);
  if (date < 0) return null;
  taken.add(date);
  const amount = pick(headers, AMOUNT_HEADERS, taken);
  if (amount >= 0) taken.add(amount);
  const debit = amount < 0 ? pick(headers, DEBIT_HEADERS, taken) : -1;
  if (debit >= 0) taken.add(debit);
  const credit = amount < 0 ? pick(headers, CREDIT_HEADERS, taken) : -1;
  if (credit >= 0) taken.add(credit);
  if (amount < 0 && debit < 0) return null;
  const description = pick(headers, DESCRIPTION_HEADERS, taken);
  if (description < 0) return null;
  taken.add(description);
  const type = pick(headers, TYPE_HEADERS, taken);
  const status = pick(headers, STATUS_HEADERS, taken);
  return {
    date, description,
    ...(amount >= 0 ? { amount } : { debit, ...(credit >= 0 ? { credit } : {}) }),
    ...(type >= 0 ? { type } : {}),
    ...(status >= 0 ? { status } : {}),
  };
}

/** No header: the date column is the one that parses as dates, the amount the first all-money column after it, the description the wordiest. */
function columnsFromCells(rows: string[][]): Columns | null {
  const sample = rows.slice(0, 200);
  const width = Math.max(...sample.map((r) => r.length));
  const share = (col: number, test: (c: string) => boolean) =>
    sample.filter((r) => test(r[col] ?? '')).length / sample.length;
  const cols = [...Array(width).keys()];
  const date = cols.find((c) => share(c, (v) => parseDate(v) !== null) >= 0.9);
  if (date === undefined) return null;
  const amount = cols.find((c) => c !== date && share(c, (v) => {
    const n = parseMoney(v);
    return n !== null && !Number.isNaN(n);
  }) >= 0.9);
  if (amount === undefined) return null;
  const letters = (c: number) => sample.reduce((s, r) => s + ((r[c] ?? '').match(/[a-z]/gi)?.length ?? 0), 0);
  const description = cols.filter((c) => c !== date && c !== amount).sort((a, b) => letters(b) - letters(a))[0];
  if (description === undefined || letters(description) === 0) return null;
  return { date, description, amount };
}

/** The header row (searched in the first rows, below any summary) and its columns. */
function findColumns(rows: string[][]): { headerRow: number; columns: Columns; named: boolean } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const columns = columnsFromHeader(rows[i]!);
    if (columns) return { headerRow: i, columns, named: true };
  }
  const columns = columnsFromCells(rows);
  return columns ? { headerRow: -1, columns, named: false } : null;
}

// ----- sign convention -------------------------------------------------------------------------

const DEBIT_TYPE = /^(debit|dr|d|sale|purchase|withdrawal|fee|charge|check|atm|pos|ach debit|debit card)\b/i;
const CREDIT_TYPE = /^(credit|cr|c|deposit|refund|return|payment|ach credit|direct deposit|interest)\b/i;
const PAY_LABEL = /\b(payroll|direct dep|dir dep|salary|paycheck)\b/i;

type RawLine = { row: number; date: { year: number; month: number; day: number }; description: string; value: number; type: string };

function signConvention(lines: RawLine[]): 'typeColumn' | 'outflowNegative' | 'outflowPositive' {
  // 1. A Debit/Credit type column.
  const typed = lines.filter((l) => l.value !== 0 && (DEBIT_TYPE.test(l.type) || CREDIT_TYPE.test(l.type)));
  if (typed.length >= Math.max(3, lines.length * 0.5)) {
    if (typed.every((l) => l.value > 0)) return 'typeColumn'; // unsigned amounts: the type gives the sign
    const debitNegative = typed.filter((l) => DEBIT_TYPE.test(l.type) === l.value < 0).length;
    if (debitNegative >= typed.length * 0.8) return 'outflowNegative';
    if (debitNegative <= typed.length * 0.2) return 'outflowPositive';
  }
  // 2. Pay deposits come in.
  const pay = lines.filter((l) => l.value !== 0 && PAY_LABEL.test(l.description));
  if (pay.length > 0) {
    const negative = pay.filter((l) => l.value < 0).length;
    if (negative === pay.length) return 'outflowPositive';
    if (negative === 0) return 'outflowNegative';
  }
  // 3. Most lines are spending.
  const negative = lines.filter((l) => l.value < 0).length;
  const positive = lines.filter((l) => l.value > 0).length;
  return positive > negative ? 'outflowPositive' : 'outflowNegative';
}

// ----- main ------------------------------------------------------------------------------------

/** Reads a CSV statement. Throws StatementReadError when nothing usable is in it. */
export function readStatementCsv(text: string): StatementRead {
  let numbered: { line: number; cells: string[] }[];
  try {
    numbered = numberedRowsOf(text);
  } catch (err) {
    if (err instanceof CsvSyntaxError) throw new StatementReadError('malformed', err.message);
    throw err;
  }
  if (numbered.length === 0) throw new StatementReadError('empty', 'The file has no rows.');
  const rows = numbered.map((r) => r.cells);

  const found = findColumns(rows);
  if (!found) throw new StatementReadError('noColumns', 'No date, description and amount columns found.');
  const { headerRow, columns: c, named } = found;
  const header = headerRow >= 0 ? rows[headerRow]! : [];
  const nameOf = (i: number) => (named ? header[i]!.trim() : `column ${i + 1}`);

  const skipped: StatementRead['skipped'] = [];
  const lines: RawLine[] = [];

  numbered.slice(headerRow + 1).forEach(({ line: row, cells: r }) => {
    const cell = (i: number | undefined) => (i === undefined ? '' : (r[i] ?? '').trim());
    const description = cell(c.description);
    if (c.status !== undefined && /pending/i.test(cell(c.status))) return skipped.push({ row, reason: 'pending' });
    if (isPendingText(cell(c.date)) || isPendingText(description)) return skipped.push({ row, reason: 'pending' });
    const date = parseDate(cell(c.date));
    if (!date || description === '') return skipped.push({ row, reason: 'notATransaction' });

    if (c.amount !== undefined) {
      const value = parseMoney(cell(c.amount));
      if (value === null || Number.isNaN(value)) return skipped.push({ row, reason: 'notATransaction' });
      lines.push({ row, date, description, value, type: cell(c.type) });
      return;
    }
    const debit = parseMoney(cell(c.debit));
    const credit = parseMoney(cell(c.credit));
    if (Number.isNaN(debit) || Number.isNaN(credit) || (debit === null && credit === null)) {
      return skipped.push({ row, reason: 'notATransaction' });
    }
    const out = Math.abs(debit ?? 0);
    const inn = Math.abs(credit ?? 0);
    if (out > 0 && inn > 0) return skipped.push({ row, reason: 'notATransaction' }); // which one?
    lines.push({ row, date, description, value: out - inn, type: '' });
  });

  if (lines.length === 0) throw new StatementReadError('noTransactions', 'No line could be read as a transaction.');

  let convention: SignConvention;
  let outflow: (l: RawLine) => number;
  if (c.amount === undefined) {
    convention = 'debitCredit';
    outflow = (l) => l.value;
  } else {
    convention = signConvention(lines);
    if (convention === 'typeColumn') outflow = (l) => (CREDIT_TYPE.test(l.type) ? -l.value : l.value);
    else if (convention === 'outflowNegative') outflow = (l) => -l.value;
    else outflow = (l) => l.value;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const transactions: Transaction[] = lines
    .map((l) => ({
      date: `${l.date.year}-${pad(l.date.month)}-${pad(l.date.day)}`,
      description: l.description,
      amount: outflow(l) + 0, // + 0 turns -0 into 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const amountColumns = c.amount !== undefined
    ? [nameOf(c.amount)]
    : [nameOf(c.debit!), ...(c.credit !== undefined ? [nameOf(c.credit)] : [])];
  return {
    transactions,
    convention,
    columns: { date: nameOf(c.date), description: nameOf(c.description), amount: amountColumns },
    skipped,
  };
}

/** The only statement data that leaves the browser: masked label, amount, month and day. */
export function toStatementItems(transactions: readonly Transaction[]): StatementItem[] {
  return transactions
    .filter((t) => t.amount !== 0)
    .map((t) => ({
      label: maskLabel(t.description),
      amount: t.amount,
      month: t.date.slice(0, 7),
      day: Number(t.date.slice(8, 10)),
    }));
}
