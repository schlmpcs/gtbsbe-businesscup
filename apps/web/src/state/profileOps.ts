// Pure Profile updates the client makes on the user's behalf. Values the user states are measured
// (`isEstimate: false`); values we fill in stay estimates. None of these invent a number: they
// copy user input or measured statement totals, and averages of those totals.
import { applyPatch, cardMinPaymentFor } from '@lifeguessr/engine';
import {
  COST_CATEGORIES,
  type CategoryTotals, type CostCategory, type Debt, type Money, type Profile, type ProfilePatch, type Rate,
} from '@lifeguessr/types';

/** Scalar Profile fields the balance sheet edits. */
export type ProfileField = 'age' | 'takeHomePay' | 'cash' | 'retirement' | 'retirementShare';

const measured = <T>(value: T) => ({ value, isEstimate: false });

/** A spending category set by the user (slider or form): measured from now on. */
export function setSpending(p: Profile, category: CostCategory, value: Money): Profile {
  return { ...p, spending: { ...p.spending, [category]: measured(value) } };
}

/**
 * The subscription audit's monthly total as the subscriptions line (M5). Measured when it comes from
 * a statement; an estimate while any ticked service (a catalogue price) is in it.
 */
export function setSubscriptionsLine(p: Profile, monthly: Money, measuredFromStatement: boolean): Profile {
  return { ...p, spending: { ...p.spending, subscriptions: { value: monthly, isEstimate: !measuredFromStatement } } };
}

/** A balance-sheet field set by the user: measured. */
export function setField(p: Profile, field: ProfileField, value: number): Profile {
  return { ...p, [field]: measured(value) };
}

/** The user skipped a field: keep today's value but mark it as an estimate. */
export function skipField(p: Profile, field: ProfileField): Profile {
  return { ...p, [field]: { value: p[field].value, isEstimate: true } };
}

/**
 * A patch the user confirmed (e.g. parsed from their own words). Applied with the engine's
 * `applyPatch`; the spending categories and retirementShare it sets become measured, because the
 * user stated them. (A Next Move's patch keeps the flags instead: see `applyPatch`.)
 */
export function applyUserPatch(p: Profile, patch: ProfilePatch): Profile {
  const next = applyPatch(p, patch);
  const spending = { ...next.spending };
  for (const c of Object.keys(patch.spending ?? {}) as CostCategory[]) {
    if (patch.spending?.[c] !== undefined) spending[c] = measured(spending[c].value);
  }
  return {
    ...next,
    spending,
    retirementShare: patch.retirementShare !== undefined ? measured(next.retirementShare.value) : next.retirementShare,
  };
}

/**
 * Today's estimate of a skipped minimum payment: the card issuer formula (interest + 1% of the
 * balance, floor $25; engine `cardMinPaymentFor`). It is the only payment assumption the engine
 * has, so other loan kinds use it too until the user types their payment; it stays an estimate.
 */
export function estimatedMinPayment(balance: Money, apr: Rate): Money {
  return cardMinPaymentFor(balance, apr);
}

/** A new debt id for a kind that is unique in the profile: 'card-2', 'student-1', ... */
export function newDebtId(p: Profile, kind: Debt['kind']): string {
  const used = new Set(p.debts.map((d) => d.id));
  for (let n = 1; ; n++) {
    const id = `${kind}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** Debt fields the balance sheet edits. `minPayment: null` = the user skipped it (estimate). */
export type DebtInput = { kind: Debt['kind']; balance: Money; apr: Rate; minPayment: Money | null };

function debtFrom(id: string, input: DebtInput, extraPayment?: Money): Debt {
  const minPayment =
    input.minPayment === null
      ? { value: estimatedMinPayment(input.balance, input.apr), isEstimate: true }
      : measured(input.minPayment);
  return { id, kind: input.kind, balance: input.balance, apr: input.apr, minPayment, ...(extraPayment ? { extraPayment } : {}) };
}

/** Add a debt; returns the new profile and the debt's id. */
export function addDebt(p: Profile, input: DebtInput): { profile: Profile; id: string } {
  const id = newDebtId(p, input.kind);
  return { profile: { ...p, debts: [...p.debts, debtFrom(id, input)] }, id };
}

/** Replace a debt's fields (unknown ids are ignored). Keeps the debt's extraPayment. */
export function updateDebt(p: Profile, id: string, input: DebtInput): Profile {
  return { ...p, debts: p.debts.map((d) => (d.id === id ? debtFrom(id, input, d.extraPayment) : d)) };
}

export function removeDebt(p: Profile, id: string): Profile {
  return { ...p, debts: p.debts.filter((d) => d.id !== id) };
}

/** Months merged into the stored history: one entry per month (the newest upload wins), oldest first. */
export function mergeStatementHistory(existing: readonly CategoryTotals[], incoming: readonly CategoryTotals[]): CategoryTotals[] {
  const byMonth = new Map<string, CategoryTotals>();
  for (const m of existing) byMonth.set(m.month, m);
  for (const m of incoming) byMonth.set(m.month, m);
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Statement totals → Profile: each category becomes the mean of its monthly totals (measured).
 * One-off charges are not in `totals`, so they don't inflate the monthly figures. Pay detected in
 * the statement (mean over the months that have it) becomes take-home pay. Categories missing from
 * every month keep their current value and flag.
 */
export function mergeStatementTotals(p: Profile, months: readonly CategoryTotals[]): Profile {
  if (months.length === 0) return p;
  const spending = { ...p.spending };
  for (const c of COST_CATEGORIES) {
    const values = months.map((m) => m.totals[c]).filter((v): v is Money => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    spending[c] = measured(Math.max(0, mean));
  }
  const pays = months.map((m) => m.detectedPay).filter((v): v is Money => typeof v === 'number' && v > 0);
  const takeHomePay = pays.length > 0 ? measured(pays.reduce((s, v) => s + v, 0) / pays.length) : p.takeHomePay;
  return { ...p, spending, takeHomePay };
}
