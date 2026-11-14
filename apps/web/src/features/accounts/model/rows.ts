// Pure parts of the Accounts view-models: rows, groups, summary bars and the CSV text.
import { netWorthSummary } from '@lifeguessr/engine';
import type { Account, AccountGroup, Money, NetWorthSummary } from '@lifeguessr/types';
import { csvLine } from '@/features/transactions/model/rows';
import { counted, GROUP_ORDER, isLiabilityGroup, kindOf } from './series';
import type { AccountGroupVM, AccountRowVM, SummaryBarVM } from './types';

export const ACCOUNTS_CSV_FILE = 'lifeguessr-accounts.csv';

/**
 * The change in `accounts`' balances over the last month, by the engine's `netWorthSummary` (net worth
 * moves the other way for a liability, so a liability group's change is turned back into a balance change).
 */
function balanceChange(accounts: readonly Account[], kind: 'asset' | 'liability'): Money | null {
  const change = netWorthSummary(accounts).change1m;
  return change !== null && kind === 'liability' ? 0 - change : change;
}

export function toAccountRow(a: Account): AccountRowVM {
  return {
    id: a.id,
    name: a.name,
    group: a.group,
    kind: kindOf(a.group),
    balance: a.balance.value,
    isEstimate: a.balance.isEstimate,
    excluded: a.excluded === true,
    change1m: balanceChange([a], kindOf(a.group)),
    href: `/accounts/${a.id}`,
  };
}

/** Groups in display order (assets, then liabilities); a group with no account is left out. */
export function toGroups(accounts: readonly Account[]): AccountGroupVM[] {
  return GROUP_ORDER.flatMap((group): AccountGroupVM[] => {
    const inGroup = accounts.filter((a) => a.group === group);
    if (inGroup.length === 0) return [];
    const live = counted(inGroup);
    const kind = kindOf(group);
    const summary = netWorthSummary(live);
    const sums = (kind === 'asset' ? summary.assets.byGroup : summary.liabilities.byGroup) as Partial<Record<AccountGroup, Money>>;
    return [
      {
        group,
        kind,
        total: sums[group] ?? 0,
        change1m: balanceChange(live, kind),
        accounts: inGroup.map(toAccountRow),
      },
    ];
  });
}

const share = (part: Money, whole: Money): number => (whole > 0 ? part / whole : 0);

function bar(kind: 'asset' | 'liability', total: Money, whole: Money, byGroup: Partial<Record<AccountGroup, Money>>): SummaryBarVM {
  const segments = (Object.entries(byGroup) as [AccountGroup, Money][])
    .filter(([, amount]) => amount > 0)
    .sort(([ga, a], [gb, b]) => b - a || GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb))
    .map(([group, amount]) => ({ group, amount, share: share(amount, total) }));
  return { kind, total, share: share(total, whole), segments };
}

export function toSummary(s: NetWorthSummary): { assets: SummaryBarVM; liabilities: SummaryBarVM } {
  const whole = s.assets.total + s.liabilities.total;
  return {
    assets: bar('asset', s.assets.total, whole, s.assets.byGroup),
    liabilities: bar('liability', s.liabilities.total, whole, s.liabilities.byGroup),
  };
}

export function accountsCsv(accounts: readonly Account[]): string {
  const lines = [csvLine(['name', 'type', 'kind', 'balance', 'balance_is_estimate', 'excluded', 'apr', 'min_payment'])];
  for (const a of accounts) {
    lines.push(
      csvLine([a.name, a.group, isLiabilityGroup(a.group) ? 'liability' : 'asset', a.balance.value, String(a.balance.isEstimate), String(a.excluded === true), a.apr ?? '', a.minPayment?.value ?? '']),
    );
  }
  return `${lines.join('\n')}\n`;
}
