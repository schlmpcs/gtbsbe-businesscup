// How the budget table groups the eight cost categories (also the Cash Flow "Group" breakdown).
// Labels: copy.planner.budgetGroups[id].
import type { CostCategory } from '@lifeguessr/types';

export type BudgetGroupId = 'essentials' | 'lifestyle' | 'debt';

export const BUDGET_GROUPS: readonly { id: BudgetGroupId; categories: readonly CostCategory[] }[] = [
  { id: 'essentials', categories: ['rentUtilities', 'groceries', 'car', 'childcare'] },
  { id: 'lifestyle', categories: ['eatingOut', 'subscriptions', 'other'] },
  { id: 'debt', categories: ['debtPayments'] },
];

export const groupOf = (category: CostCategory): BudgetGroupId => BUDGET_GROUPS.find((g) => g.categories.includes(category))!.id;
