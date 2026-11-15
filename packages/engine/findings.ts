// JF7: take-home pay and debts found in a statement, for the person to confirm instead of typing
// them (S9 "We found: paycheck $5,200/mo, Capital One card payments, Toyota Financial").
// Pure and deterministic, and no model is involved: the text rules, the schedules and every dollar
// are code here, with each threshold named in assumptions.ts (payCadences, payMinDeposits, …).
//
// It runs in the browser on the statement just read (features/upload/model/readStatementFile), on
// each line's date, amount, raw description and masked label. The raw description is only read
// (to group a payer's deposits and to recognise a lender, see lenders.ts); a finding shows either a
// lender name from our list or text from the masked label, never the raw text. Nothing here is
// sent anywhere or stored.
//
// Income. Money in that is not a person (Zelle, Venmo…), a move between the person's own accounts,
// interest, a refund or a cash deposit, grouped by payer. A payer's deposits are a paycheck when they
// follow one pay schedule (weekly, every two weeks, twice a month, monthly; `payCadences`), at least
// `payMinDeposits` of them, the last one recent enough to still be coming in. Monthly take-home from
// that payer = the typical (median) deposit × paydays a year ÷ 12, so a month with three biweekly
// paychecks does not inflate it, and a statement that ends mid-month does not shrink it. A payroll
// word in the label ("PAYROLL", "DIR DEP") is reported but not required: gig payouts and child
// support come on a schedule too, and the person decides.
//
// Debts. Money out to a lender (lenders.ts), at least `debtMinPayments` payments, the last one
// recent. Two loans with one lender are told apart by their fixed payment (`debtSameLoanTolerance`);
// a card's or BNPL account's payments vary, so they stay one debt per lender. The monthly payment is
// measured: the average paid per calendar month over the full months between the first and the last
// payment. The APR is the kind's typical rate (`debtAprByKind`), always an estimate.
//
// Money is worked in whole cents until the end. The engine may not use `Date`, so days are counted
// with a civil-date formula.
import type { DebtFinding, IncomeFinding, Money, PayCadence, StatementFindings } from '@lifeguessr/types';
import {
  debtAprByKind, debtMinPayments, debtSameLoanTolerance, findingsStaleAfter, payCadences, payMinDeposits, payMissedShare,
} from './assumptions';
import { lenderOf, type DebtKind } from './lenders';
import { merchantKey } from './statement';

/** One statement line as the browser has it. */
export type FindingLine = {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** > 0 = money out, < 0 = money in (Transaction's sign). */
  amount: Money;
  /** The raw description. Read here, never returned. */
  text: string;
  /** The masked label (lib/statement/mask): the only text a finding may show. */
  label: string;
};

/** The findings, and which input lines (by index) each one is made of: for tests and accuracy reports. */
export type StatementFindingsDetail = {
  findings: StatementFindings;
  lines: Record<string, readonly number[]>;
};

// ----- days ------------------------------------------------------------------------------------

type Day = { n: number; year: number; month: number; day: number };

/** Days since 1970-01-01 (Hinnant's days_from_civil). */
function civilDays(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function dayOf(date: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { n: civilDays(year, month, day), year, month, day };
}

const monthIndex = (d: Pick<Day, 'year' | 'month'>) => d.year * 12 + d.month - 1;
const daysInMonth = (index: number) => {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return civilDays(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - civilDays(year, month, 1);
};

const toCents = (dollars: Money) => Math.round(dollars * 100);
const toDollars = (cents: number): Money => cents / 100;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ----- text ------------------------------------------------------------------------------------

/** Masked labels of lines that are never pay or a debt payment: people, own accounts, checks. */
const PERSON_OR_OWN_ACCOUNT = /^(?:Zelle|Venmo|PayPal|Cash App|Apple Cash|Popmoney|Pay Anyone|Pay Friends|Transfer|Wire|Check to)\b/;
/** Masked labels the mask emptied of their counterparty: kept only if the raw text says payroll. */
const MASKED_COUNTERPARTY = /^(?:Deposit from|ACH credit|ACH debit|Bill payment to|Online payment to)\b/;
/** Money in that is not take-home pay even when it recurs. */
const NOT_PAY = new RegExp(
  [
    String.raw`\binterest\b`, String.raw`\bdividends?\b`, String.raw`\brefunds?\b`, String.raw`\breturn(?:ed)?\b`, String.raw`\breversal\b`,
    String.raw`\bcash ?back\b`, String.raw`\brewards?\b`, String.raw`\badjustment\b`, String.raw`\bthank you\b`, String.raw`\bpayment received\b`,
    String.raw`\bauto ?pay\b`, String.raw`\bcash deposit\b`, String.raw`\batm\b`, String.raw`\bbranch deposit\b`,
  ].join('|'),
  'i',
);
const PAYROLL = /\b(?:payroll|pay ?roll|direct ?dep(?:osit)?|dir ?dep|salary|paycheck|mil ?pay|net ?pay)\b/i;
/** NACHA fields that follow the company name; the payer is what comes before them. */
const ACH_FIELDS = /\s(?:DES:|ID:|INDN:|CO ID|CO NAME|PPD\b|WEB ID|WEB\b|CCD\b|TRACE|TRN\b|REF\b)/i;
const LEADING_TYPE = /^(?:ACH (?:DEPOSIT|CREDIT|DEBIT)|POS PURCHASE|CHECKCARD|DEBIT CARD PURCHASE|PURCHASE|DEPOSIT)\s+/i;

/** Groups one payer's lines: the company part of the description, letters only. */
function payerKey(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  const cut = t.search(ACH_FIELDS);
  if (cut > 0) t = t.slice(0, cut);
  return merchantKey(t.replace(LEADING_TYPE, ''));
}

/** Words that say what kind of line it is, not who: dropped from a shown name. */
const NOISE_WORDS = new Set([
  'PAYROLL', 'DIR', 'DIRECT', 'DEP', 'DEPOSIT', 'PPD', 'ACH', 'PMT', 'PYMT', 'PYMNTS', 'PAYMT', 'PAYMENT', 'PAYMENTS',
  'EDI', 'MIL', 'WEB', 'ONLINE', 'MOBILE', 'AUTOPAY', 'AUTO', 'PAY', 'ID', 'CREDIT', 'DEBIT', 'POS', 'PURCHASE', 'CHECKCARD',
]);
/** Small words written in lower or title case when a bank prints the name in capitals. */
const TITLE_WORDS = new Map([['INC', 'Inc'], ['CO', 'Co'], ['AND', 'and'], ['OF', 'of'], ['THE', 'the'], ['FOR', 'for']]);
/** Acronyms that have a vowel, so the no-vowel rule below would not keep them in capitals. */
const ACRONYMS = new Set(['ISD', 'USA', 'IBEW', 'DFAS', 'HVAC', 'SDU', 'IRS', 'ADP', 'UPS', 'USAA', 'AT&T', 'CU', 'FCU']);

/** "PACIFIC RIM DISTRIBUTION LLC" → "Pacific Rim Distribution LLC"; "MIAMI-DADE" → "Miami-Dade". */
function titleCase(word: string): string {
  return word
    .split('-')
    .map((part) => {
      const bare = part.replace(/\.+$/, '');
      const dots = part.slice(bare.length);
      if (TITLE_WORDS.has(bare)) return TITLE_WORDS.get(bare)! + dots;
      if (ACRONYMS.has(bare) || !/[AEIOUY]/.test(bare)) return part; // LLC, GRP, SVC
      return bare[0] + bare.slice(1).toLowerCase() + dots;
    })
    .join('-');
}

/**
 * A payer or lender name from the masked label: the part before the NACHA fields, without the
 * masks, numbers and words like PAYROLL or PMT, title-cased when the bank prints all capitals. Null
 * when nothing is left (the mask removed the counterparty).
 */
export function nameFromLabel(label: string): string | null {
  if (PERSON_OR_OWN_ACCOUNT.test(label) || MASKED_COUNTERPARTY.test(label)) return null;
  let t = label.replace(/\[(?:name|ref|email)\]|#/gi, ' ');
  const cut = t.search(ACH_FIELDS);
  if (cut > 0) t = t.slice(0, cut);
  const words = t
    .replace(LEADING_TYPE, '')
    .replace(/[^A-Za-z&.,'\- ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z]+|[^A-Za-z.]+$/g, ''))
    .filter((w) => w !== '');
  while (words.length > 0 && NOISE_WORDS.has(words.at(-1)!.toUpperCase().replace(/\.$/, ''))) words.pop();
  if (words.length === 0 || !words.some((w) => /[A-Za-z]{2}/.test(w))) return null;
  const allCaps = !/[a-z]/.test(words.join(''));
  const shown = allCaps ? words.map(titleCase).join(' ') : words.join(' ');
  return shown.slice(0, 200);
}

// ----- income ----------------------------------------------------------------------------------

type Deposit = { n: number; cents: number; lines: number[] };

type Fit = { cadence: PayCadence; spread: number };

/**
 * Does this run of paydays follow the cadence? Each deposit gets the payday slot nearest to it
 * (days since the first ÷ the cadence's gap); after centring, every deposit must sit within the
 * cadence's slack of its slot, no two in one slot, and only a few slots may be empty. `spread` is
 * the worst distance from a slot, to pick between two cadences that both fit a short run.
 */
function fitCadence(days: readonly number[], cadence: PayCadence): Fit | null {
  const { days: gap, slack } = payCadences.value[cadence];
  const first = days[0]!;
  const slots = days.map((d) => Math.round((d - first) / gap));
  for (let i = 1; i < slots.length; i++) if (slots[i]! <= slots[i - 1]!) return null;
  const residuals = days.map((d, i) => d - first - slots[i]! * gap);
  const centre = median(residuals);
  const spread = Math.max(...residuals.map((r) => Math.abs(r - centre)));
  if (spread > slack) return null;
  const span = slots.at(-1)! + 1;
  const missed = span - days.length;
  if (missed > Math.max(1, Math.floor(payMissedShare.value * span))) return null;
  return { cadence, spread };
}

function payCadenceOf(days: readonly number[]): PayCadence | null {
  const fits = (Object.keys(payCadences.value) as PayCadence[])
    .map((c) => fitCadence(days, c))
    .filter((f): f is Fit => f !== null)
    .sort((a, b) => a.spread / payCadences.value[a.cadence].slack - b.spread / payCadences.value[b.cadence].slack);
  return fits[0]?.cadence ?? null;
}

type IncomeCandidate = Omit<IncomeFinding, 'id'> & { lines: number[] };

function findIncome(lines: readonly FindingLine[], days: readonly (Day | null)[], end: number): IncomeCandidate[] {
  const byPayer = new Map<string, { label: string; payroll: boolean; deposits: Map<number, Deposit> }>();
  lines.forEach((line, i) => {
    const day = days[i];
    if (!day || toCents(line.amount) >= 0) return;
    if (PERSON_OR_OWN_ACCOUNT.test(line.label) || NOT_PAY.test(line.text) || NOT_PAY.test(line.label)) return;
    const payroll = PAYROLL.test(line.text);
    if (MASKED_COUNTERPARTY.test(line.label) && !payroll) return;
    const key = payerKey(line.text);
    if (key === '') return;
    const payer = byPayer.get(key) ?? { label: line.label, payroll: false, deposits: new Map() };
    payer.payroll ||= payroll;
    // Two deposits from one payer on one day (pay split across two transfers) are one paycheck.
    const deposit = payer.deposits.get(day.n) ?? { n: day.n, cents: 0, lines: [] };
    deposit.cents += -toCents(line.amount);
    deposit.lines.push(i);
    payer.deposits.set(day.n, deposit);
    payer.label = line.label; // the latest label: masks and reference numbers differ line to line
    byPayer.set(key, payer);
  });

  const found: IncomeCandidate[] = [];
  for (const payer of byPayer.values()) {
    const deposits = [...payer.deposits.values()].sort((a, b) => a.n - b.n);
    if (deposits.length < payMinDeposits.value) continue;
    const cadence = payCadenceOf(deposits.map((d) => d.n));
    if (!cadence) continue;
    const { days: gap, perYear, slack } = payCadences.value[cadence];
    // A job that ended before the statement did is not today's pay.
    if (end - deposits.at(-1)!.n > findingsStaleAfter.value.payPeriods * gap + slack) continue;
    const perDepositCents = Math.round(median(deposits.map((d) => d.cents)));
    found.push({
      payer: nameFromLabel(payer.label),
      payroll: payer.payroll,
      cadence,
      deposits: deposits.length,
      perDeposit: toDollars(perDepositCents),
      monthly: toDollars(Math.round((perDepositCents * perYear) / 12)),
      lines: deposits.flatMap((d) => d.lines).sort((a, b) => a - b),
    });
  }
  return found;
}

// ----- debts -----------------------------------------------------------------------------------

/** Kinds paid in a fixed amount: two different fixed amounts to one lender are two loans. */
const FIXED_PAYMENT_KINDS: ReadonlySet<DebtKind> = new Set(['auto', 'student', 'mortgage', 'personal']);

type Payment = { line: number; day: Day; cents: number };
type DebtCandidate = Omit<DebtFinding, 'id' | 'apr' | 'aprSource'> & { lines: number[] };

/** Payments of one lender split into loans by their fixed amount; each loan's payments oldest first. */
function loansOf(payments: readonly Payment[], kind: DebtKind): Payment[][] {
  if (!FIXED_PAYMENT_KINDS.has(kind)) return [[...payments]];
  const { share, dollars } = debtSameLoanTolerance.value;
  const lanes: Payment[][] = [];
  for (const p of [...payments].sort((a, b) => a.cents - b.cents)) {
    const lane = lanes.find((l) => {
      const typical = median(l.map((x) => x.cents));
      return Math.abs(p.cents - typical) <= Math.max(toCents(dollars), share * typical);
    });
    if (lane) lane.push(p);
    else lanes.push([p]);
  }
  return lanes.map((l) => l.sort((a, b) => a.day.n - b.day.n));
}

/**
 * The average paid per calendar month: over the statement's full months between this debt's first
 * and last payment (a month with no payment in that range counts as $0). A statement's first month
 * is full if it starts by the 5th, its last if it runs to within 4 days of the month's end. With no
 * full month in range, the total over the months that have a payment.
 */
function monthlyPaymentCents(payments: readonly Payment[], start: Day, end: Day): number {
  const firstFull = monthIndex(start) + (start.day <= 5 ? 0 : 1);
  const lastFull = monthIndex(end) - (end.day >= daysInMonth(monthIndex(end)) - 4 ? 0 : 1);
  const from = Math.max(firstFull, monthIndex(payments[0]!.day));
  const to = Math.min(lastFull, monthIndex(payments.at(-1)!.day));
  if (from <= to) {
    let total = 0;
    for (const p of payments) {
      const m = monthIndex(p.day);
      if (m >= from && m <= to) total += p.cents;
    }
    return Math.round(total / (to - from + 1));
  }
  const months = new Set(payments.map((p) => monthIndex(p.day)));
  return Math.round(payments.reduce((s, p) => s + p.cents, 0) / months.size);
}

function findDebts(lines: readonly FindingLine[], days: readonly (Day | null)[], start: Day, end: Day): DebtCandidate[] {
  const byLender = new Map<string, { kind: DebtKind; name: string | null; label: string; payments: Payment[] }>();
  lines.forEach((line, i) => {
    const day = days[i];
    if (!day || toCents(line.amount) <= 0) return;
    if (/\batm\b/i.test(line.text)) return;
    const lender = lenderOf(line.text);
    if (!lender) return;
    // A payment to a person or to one of the person's own accounts is never a lender, even when the
    // text happens to match one ("Zelle payment to Ally …"). PayPal's own pay-later plan is the
    // exception: the mask files every PayPal line under P2P.
    if (PERSON_OR_OWN_ACCOUNT.test(line.label) && lender.id !== 'paypal-pay-later') return;
    // A lender from the list is one group; a generic match ("MORTGAGE") is grouped by its payee.
    const key = lender.name !== null ? lender.id : `${lender.id}:${payerKey(line.text)}`;
    const group = byLender.get(key) ?? { kind: lender.kind, name: lender.name, label: line.label, payments: [] };
    group.payments.push({ line: i, day, cents: toCents(line.amount) });
    group.label = line.label;
    byLender.set(key, group);
  });

  const found: DebtCandidate[] = [];
  for (const group of byLender.values()) {
    for (const loan of loansOf(group.payments, group.kind)) {
      if (loan.length < debtMinPayments.value) continue;
      // A loan paid off, or a BNPL plan finished, before the statement ends is not a debt today.
      if (end.n - loan.at(-1)!.day.n > findingsStaleAfter.value.debtDays) continue;
      found.push({
        kind: group.kind,
        creditor: group.name ?? nameFromLabel(group.label),
        payments: loan.length,
        monthlyPayment: toDollars(monthlyPaymentCents(loan, start, end)),
        lines: loan.map((p) => p.line).sort((a, b) => a - b),
      });
    }
  }
  return found;
}

// ----- main ------------------------------------------------------------------------------------

/** Income and debts found in a statement, with the input lines behind each finding. */
export function detectStatementFindings(lines: readonly FindingLine[]): StatementFindingsDetail {
  const days = lines.map((l) => dayOf(l.date));
  const dated = days.filter((d): d is Day => d !== null).sort((a, b) => a.n - b.n);
  if (dated.length === 0) return { findings: { income: [], debts: [] }, lines: {} };
  const start = dated[0]!;
  const end = dated.at(-1)!;

  const linesById: Record<string, readonly number[]> = {};
  // Largest first, then by name, so ids and order are the same on every run of the same statement.
  const byName = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');
  const income = findIncome(lines, days, end.n)
    .sort((a, b) => b.monthly - a.monthly || byName(a.payer, b.payer))
    .map(({ lines: used, ...f }, i): IncomeFinding => {
      const id = `income-${i + 1}`;
      linesById[id] = used;
      return { id, ...f };
    });
  const debts = findDebts(lines, days, start, end)
    .sort((a, b) => b.monthlyPayment - a.monthlyPayment || byName(a.creditor, b.creditor))
    .map(({ lines: used, ...f }, i): DebtFinding => {
      const id = `debt-${i + 1}`;
      linesById[id] = used;
      const apr = debtAprByKind[f.kind];
      return { id, ...f, apr: apr.value, aprSource: { ...apr.source } };
    });
  return { findings: { income, debts }, lines: linesById };
}

/** Income and debts found in a statement (see the top of this file). */
export function findIncomeAndDebts(lines: readonly FindingLine[]): StatementFindings {
  return detectStatementFindings(lines).findings;
}
