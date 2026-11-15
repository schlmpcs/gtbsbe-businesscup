// Pure view shaping of the Cash Flow Sankey: sources → Income → where it went. By category it is the
// engine's own Sankey (summary.sankey, thin categories already merged into "Other"); by group the
// engine's exact category sums (summary.byCategory) are added up into their budget group, one-offs are
// what the engine counted in expenses beyond the categories, and savings is the engine's savings link.
// Sums run in whole cents so no float noise reaches the screen.
import type { CashFlowSummary, CostCategory } from '@lifeguessr/types';
import { BUDGET_GROUPS, groupOf } from '@/features/budget/model/groups';
import type { CashFlowBreakdown, CashFlowFlowTargetVM, CashFlowFlowVM } from './types';

const COST = new Set<string>(BUDGET_GROUPS.flatMap((g) => g.categories));
const isCost = (id: string): id is CostCategory => COST.has(id);
const cents = (dollars: number) => Math.round(dollars * 100);

export function toFlow(summary: CashFlowSummary, breakdown: CashFlowBreakdown): CashFlowFlowVM {
  const { links } = summary.sankey;
  const sources = links
    .filter((l) => l.target === 'income' && (l.source === 'pay' || l.source === 'fromSavings'))
    .map((l) => ({ id: l.source as 'pay' | 'fromSavings', value: l.value }));
  const total = sources.reduce((sum, s) => sum + cents(s.value), 0) / 100;
  const savings: CashFlowFlowTargetVM[] = links
    .filter((l) => l.source === 'income' && l.target === 'savings')
    .map((l) => ({ kind: 'savings', id: 'savings', group: null, value: l.value }));

  if (breakdown === 'category') {
    const spend = links
      .filter((l) => l.source === 'income' && l.target !== 'savings')
      .map((l): CashFlowFlowTargetVM =>
        isCost(l.target)
          ? { kind: 'category', id: l.target, group: groupOf(l.target), value: l.value }
          : { kind: 'oneOffs', id: l.target, group: null, value: l.value },
      );
    return { sources, total, targets: [...spend, ...savings] };
  }

  const spend: CashFlowFlowTargetVM[] = [];
  let categorized = 0;
  for (const { id, categories } of BUDGET_GROUPS) {
    const sum = summary.byCategory.filter((c) => categories.includes(c.category)).reduce((s, c) => s + cents(c.amount), 0);
    categorized += sum;
    if (sum > 0) spend.push({ kind: 'group', id, group: id, value: sum / 100 });
  }
  const oneOffs = cents(summary.expenses) - categorized;
  if (oneOffs > 0) spend.push({ kind: 'oneOffs', id: 'oneOffs', group: null, value: oneOffs / 100 });
  spend.sort((a, b) => b.value - a.value);
  return { sources, total, targets: [...spend, ...savings] };
}
