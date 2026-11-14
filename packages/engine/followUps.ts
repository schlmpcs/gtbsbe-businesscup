// What a statement can't settle by itself, as a few questions for S9 (JF6), and what the answers do
// to the lines. Everything here is code: which merchants are unclear, how much goes through them a
// month, and how an answer re-sorts their lines. The LLM may only word a question (the server's
// statement/followUps.ts); the user's answer is a category or a monthly amount they type.
//
// Three kinds, asked in this order and at most MAX_STATEMENT_FOLLOW_UPS in all:
// 1. 'missing': an essential category (housing, groceries) with nothing in any full month. Most
//    likely paid from another account or card, so we ask what it costs rather than believe $0.
// 2. 'cash': cash withdrawals. The statement shows the cash leaving, never what it bought.
// 3. 'merchant': money out the categorizer could only call 'other', grouped by merchant, biggest
//    first. A store that sells everything (Target, Amazon) or a payment to a person (Zelle to
//    [name]) could be groceries, rent or a babysitter: only the user knows.
// Cash and merchants are asked only from `statementFollowUpMinMonthly` a month up: below it the
// answer would not move a number anyone would notice. One-off charges are left out of every amount,
// as they are left out of the totals.
import {
  COST_CATEGORIES, MAX_STATEMENT_FOLLOW_UPS, type CostCategory, type Money, type StatementFollowUp,
} from '@lifeguessr/types';
import { statementEssentialCategories, statementFollowUpMinMonthly } from './assumptions';
import {
  averagedStatementMonths, isFullStatementMonth, merchantKey, oneOffFlags, statementTotals, type ClassifiedStatementItem,
} from './statement';

/** Cash taken out of the account: an ATM, a teller or a cash-back withdrawal. */
const CASH = /\b(?:ATM|CASH\s+(?:WITHDRAWAL|WDL|WD)|WITHDRAWAL\s+CASH|CASH\s+DISBURSEMENT)\b/i;

/** The id of the cash group: every withdrawal is one question, whichever machine it came from. */
const CASH_KEY = 'cash';

/** The group a line belongs to for a follow-up: 'cash' for withdrawals, else its merchant. */
export function followUpKey(label: string): string {
  return CASH.test(label) ? CASH_KEY : merchantKey(label);
}

/** The categories a merchant or cash answer may name (debt payments are found, never assigned). */
export const FOLLOW_UP_CATEGORIES: readonly CostCategory[] = COST_CATEGORIES.filter((c) => c !== 'debtPayments');

const toCents = (dollars: Money) => Math.round(dollars * 100);

/**
 * The follow-up questions for a classified statement, most important first. `monthly` is the
 * group's money out per month (refunds from it subtracted) over the months the averages use.
 */
export function statementFollowUps(items: readonly ClassifiedStatementItem[]): StatementFollowUp[] {
  if (items.length === 0) return [];
  const months = statementTotals(items);
  const full = months.filter(isFullStatementMonth);
  // The months the amounts are averaged over, as for the profile: the full ones, else all of them.
  const averaged = averagedStatementMonths(months);
  const averagedSet = new Set(averaged.map((m) => m.month));

  // Only a statement that covers at least one month in full can say a category is missing: in a
  // two-week export the rent may simply not have come up yet.
  const missing: StatementFollowUp[] = full.length === 0 ? [] : statementEssentialCategories.value
    .filter((category) => full.every((m) => (m.totals[category] ?? 0) === 0))
    .map((category) => ({ id: `missing:${category}`, kind: 'missing', key: category, category, monthly: 0 }));

  // Money out per group over the averaged months, in cents, and the label of its latest line.
  const oneOff = oneOffFlags(items);
  const groups = new Map<string, { cents: number; label: string; at: string }>();
  items.forEach((item, i) => {
    if (item.cls !== 'other' || oneOff[i] || !averagedSet.has(item.month)) return;
    const key = followUpKey(item.label);
    if (key === '') return; // a label that is nothing but masks: there is nothing to ask about
    const at = `${item.month}-${String(item.day).padStart(2, '0')}`;
    const g = groups.get(key) ?? { cents: 0, label: item.label, at: '' };
    g.cents += toCents(item.amount); // a refund (money in) comes off
    if (item.amount > 0 && at >= g.at) {
      g.label = item.label;
      g.at = at;
    }
    groups.set(key, g);
  });

  const min = statementFollowUpMinMonthly.value;
  const asked = [...groups]
    .map(([key, g]) => ({ key, label: g.label, monthly: Math.max(0, g.cents) / 100 / averaged.length }))
    .filter((g) => g.monthly >= min)
    .map((g): StatementFollowUp => {
      const kind = g.key === CASH_KEY ? 'cash' : 'merchant';
      return { id: `${kind}:${g.key}`, kind, key: g.key, label: g.label, monthly: g.monthly };
    })
    // Cash first (it is money we can't see at all), then the biggest merchants; ties by key, so the
    // order never depends on the order of the lines.
    .sort((a, b) => Number(b.kind === 'cash') - Number(a.kind === 'cash') || b.monthly - a.monthly || a.key.localeCompare(b.key));

  return [...missing, ...asked].slice(0, MAX_STATEMENT_FOLLOW_UPS);
}

/** The user's answer to a merchant or cash question: the category that money mostly is. */
export type FollowUpCategoryAnswers = Readonly<Record<string, CostCategory>>;

/**
 * The lines with the answers applied: every line of an answered group that was sorted as 'other'
 * now counts toward the category the user named. `answers` is keyed by follow-up id; ids that are
 * not a merchant or cash question of `followUps`, and answers naming debt payments, change nothing.
 */
export function applyFollowUpAnswers(
  items: readonly ClassifiedStatementItem[],
  followUps: readonly StatementFollowUp[],
  answers: FollowUpCategoryAnswers,
): ClassifiedStatementItem[] {
  const byKey = new Map<string, CostCategory>();
  for (const f of followUps) {
    const category = answers[f.id];
    if (f.kind === 'missing' || category === undefined || !FOLLOW_UP_CATEGORIES.includes(category)) continue;
    byKey.set(f.key, category);
  }
  if (byKey.size === 0) return [...items];
  return items.map((item) => {
    if (item.cls !== 'other') return item;
    const category = byKey.get(followUpKey(item.label));
    return category === undefined ? item : { ...item, cls: category };
  });
}
