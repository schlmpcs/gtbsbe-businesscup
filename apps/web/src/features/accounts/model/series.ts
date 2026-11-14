// Balance history for the Accounts and Dashboard charts. The totals (net worth, groups, the 1-month
// change) are the engine's `netWorthSummary`; what stays here is reshaping `Account.history` into chart
// points, which no engine function does yet. Each point's value is the engine's net worth of the
// accounts as they stood that month.
import { addMonths, netWorthSummary } from '@lifeguessr/engine';
import { ASSET_GROUPS, LIABILITY_GROUPS, type Account, type AccountGroup, type Money, type YearMonth } from '@lifeguessr/types';
import { isLiabilityGroup } from '@/lib/model/addAccount';

export { isLiabilityGroup } from '@/lib/model/addAccount';

export type AccountKind = 'asset' | 'liability';
export type BalancePoint = { month: YearMonth; value: Money };

export const kindOf = (group: AccountGroup): AccountKind => (isLiabilityGroup(group) ? 'liability' : 'asset');

export const counted = (accounts: readonly Account[]): Account[] => accounts.filter((a) => !a.excluded);

/** The balance an account had in `month`: its last history point at or before it; null before its first point. */
export function balanceAt(account: Pick<Account, 'history'>, month: YearMonth): Money | null {
  let found: Money | null = null;
  let foundMonth = '';
  for (const p of account.history) {
    if (p.month <= month && p.month >= foundMonth) {
      found = p.balance;
      foundMonth = p.month;
    }
  }
  return found;
}

/** The accounts with the balances they had in `month`; those with no balance yet are left out. */
const asOf = (accounts: readonly Account[], month: YearMonth): Account[] =>
  accounts.flatMap((a) => {
    const balance = balanceAt(a, month);
    return balance === null ? [] : [{ ...a, balance: { value: balance, isEstimate: a.balance.isEstimate } }];
  });

/** Net worth at the end of each month with an edit, oldest first; the current month is added from today's balances. */
export function netWorthSeries(accounts: readonly Account[], month: YearMonth): BalancePoint[] {
  const live = counted(accounts);
  if (live.length === 0) return [];
  const months = [...new Set(live.flatMap((a) => a.history.map((p) => p.month)))].sort();
  const points: BalancePoint[] = months.map((m) => ({ month: m, value: netWorthSummary(asOf(live, m)).netWorth }));
  const now = netWorthSummary(live).netWorth;
  const last = points[points.length - 1];
  if (last === undefined || last.month < month) points.push({ month, value: now });
  else if (last.month === month) last.value = now;
  return points;
}

/** One account's balance history, oldest first, ending with today's balance in `month`. */
export function balanceSeries(account: Account, month: YearMonth): BalancePoint[] {
  const points = [...account.history].sort((a, b) => (a.month < b.month ? -1 : 1)).map((p) => ({ month: p.month, value: p.balance }));
  const last = points[points.length - 1];
  if (last === undefined || last.month < month) points.push({ month, value: account.balance.value });
  else if (last.month === month) last.value = account.balance.value;
  return points;
}

export const PERIOD_MONTHS = { '1m': 1, '3m': 3, '1y': 12 } as const;
export type AccountPeriod = keyof typeof PERIOD_MONTHS | 'all';

/** The points from `period` ago (counted from `month`) on; 'all' keeps every point. */
export function withinPeriod(points: readonly BalancePoint[], period: AccountPeriod, month: YearMonth): BalancePoint[] {
  if (period === 'all') return [...points];
  const from = addMonths(month, -PERIOD_MONTHS[period]);
  return points.filter((p) => p.month >= from);
}

export const GROUP_ORDER: readonly AccountGroup[] = [...ASSET_GROUPS, ...LIABILITY_GROUPS];
