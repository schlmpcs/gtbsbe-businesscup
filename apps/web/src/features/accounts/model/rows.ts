// Pure parts of the Accounts view-models: rows, groups, summary bars and the CSV text.
import type { Account, AccountGroup, Money, NetWorthSummary, YearMonth } from '@lifeguessr/types';
import { csvLine } from '@/features/transactions/model/rows';
import { accountChange, counted, GROUP_ORDER, isLiabilityGroup, kindOf } from './series';
import type { AccountGroupVM, AccountRowVM, SummaryBarVM } from './types';

export const ACCOUNTS_CSV_FILE = 'lifeguessr-accounts.csv';

export function toAccountRow(a: Account, month: YearMonth): AccountRowVM {
  return {
    id: a.id,
    name: a.name,
    group: a.group,
    kind: kindOf(a.group),
    balance: a.balance.value,
    isEstimate: a.balance.isEstimate,
    excluded: a.excluded === true,
    change1m: accountChange(a, month),
    href: `/accounts/${a.id}`,
  };
}

/** Groups in display order (assets, then liabilities); a group with no account is left out. */
export function toGroups(accounts: readonly Account[], month: YearMonth): AccountGroupVM[] {
  return GROUP_ORDER.flatMap((group): AccountGroupVM[] => {
    const inGroup = accounts.filter((a) => a.group === group);
    if (inGroup.length === 0) return [];
    const live = counted(inGroup);
    const changes = live.map((a) => accountChange(a, month)).filter((c): c is Money => c !== null);
    return [
      {
        group,
        kind: kindOf(group),
        total: live.reduce((sum, a) => sum + a.balance.value, 0),
        change1m: changes.length === 0 ? null : changes.reduce((sum, c) => sum + c, 0),
        accounts: inGroup.map((a) => toAccountRow(a, month)),
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
