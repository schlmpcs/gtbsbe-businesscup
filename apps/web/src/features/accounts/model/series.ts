// Pure balance-sheet reads for Accounts and the Dashboard: totals by group, the net worth history and
// the 1-month change. Arithmetic over `Account.balance` and `Account.history` only.
//
// MP11b: `summarizeAccounts` is `netWorthSummary` (MP8) with a like-for-like `change1m` here; wire the
// summary to the engine and keep only `netWorthSeries` / `balanceSeries` (history for the chart) if MP8
// does not provide them.
import { addMonths } from '@lifeguessr/engine';
import {
  ASSET_GROUPS, LIABILITY_GROUPS, type Account, type AccountGroup, type AssetGroup, type LiabilityGroup, type Money, type NetWorthSummary,
  type YearMonth,
} from '@lifeguessr/types';

export type AccountKind = 'asset' | 'liability';
export type BalancePoint = { month: YearMonth; value: Money };

export const isLiabilityGroup = (group: AccountGroup): group is LiabilityGroup => (LIABILITY_GROUPS as readonly string[]).includes(group);
export const kindOf = (group: AccountGroup): AccountKind => (isLiabilityGroup(group) ? 'liability' : 'asset');
/** +1 for an asset, -1 for a liability: net worth = Σ sign × balance. */
const signOf = (group: AccountGroup): 1 | -1 => (isLiabilityGroup(group) ? -1 : 1);

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

/** Totals by group (excluded accounts left out) and the change over the month before `month`, like for like. */
export function summarizeAccounts(accounts: readonly Account[], month: YearMonth): NetWorthSummary {
  const live = counted(accounts);
  const byAsset: Partial<Record<AssetGroup, Money>> = {};
  const byLiability: Partial<Record<LiabilityGroup, Money>> = {};
  let assets = 0;
  let liabilities = 0;
  for (const a of live) {
    if (isLiabilityGroup(a.group)) {
      byLiability[a.group] = (byLiability[a.group] ?? 0) + a.balance.value;
      liabilities += a.balance.value;
    } else {
      byAsset[a.group as AssetGroup] = (byAsset[a.group as AssetGroup] ?? 0) + a.balance.value;
      assets += a.balance.value;
    }
  }
  return {
    netWorth: assets - liabilities,
    assets: { total: assets, byGroup: byAsset },
    liabilities: { total: liabilities, byGroup: byLiability },
    change1m: changeOver(live, month),
  };
}

/**
 * Net worth change since the month before `month`, over the accounts that already had a balance then
 * (an account added this month does not count as growth). Null when none did.
 */
export function changeOver(accounts: readonly Account[], month: YearMonth): Money | null {
  const before = addMonths(month, -1);
  let change = 0;
  let any = false;
  for (const a of accounts) {
    const was = balanceAt(a, before);
    if (was === null) continue;
    any = true;
    change += signOf(a.group) * (a.balance.value - was);
  }
  return any ? change : null;
}

/** One account's change over the last month (null without a balance a month back). */
export function accountChange(account: Account, month: YearMonth): Money | null {
  const was = balanceAt(account, addMonths(month, -1));
  return was === null ? null : account.balance.value - was;
}

/** Net worth at the end of each month with an edit, oldest first; the current month is added from today's balances. */
export function netWorthSeries(accounts: readonly Account[], month: YearMonth): BalancePoint[] {
  const live = counted(accounts);
  if (live.length === 0) return [];
  const months = [...new Set(live.flatMap((a) => a.history.map((p) => p.month)))].sort();
  const points: BalancePoint[] = months.map((m) => {
    let value = 0;
    for (const a of live) {
      const b = balanceAt(a, m);
      if (b !== null) value += signOf(a.group) * b;
    }
    return { month: m, value };
  });
  const now = live.reduce((sum, a) => sum + signOf(a.group) * a.balance.value, 0);
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
