// Strings for Cash Flow (MP11). Category names are in planner.categories, group names in planner.budgetGroups.
export const cashflow = {
  title: 'Cash flow',
  periods: { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' },
  views: { bars: 'Bars', sankey: 'Sankey' },
  breakdowns: { category: 'Category', group: 'Group' },
  kpis: { income: 'Income', expenses: 'Expenses', savings: 'Savings', savingsRate: 'Savings rate' },
  empty: 'Import a statement or add transactions to see your cash flow.',
} as const;
