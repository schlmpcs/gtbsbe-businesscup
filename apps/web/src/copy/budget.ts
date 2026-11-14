// Strings for Budget (MP11). Category names are in planner.categories, group names in planner.budgetGroups.
export const budget = {
  title: 'Budget',
  modes: { month: 'Month', year: 'Year' },
  today: 'Today',
  income: 'Income',
  columns: { planned: 'Planned', actual: 'Actual', remaining: 'Remaining' },
  statuses: { under: 'Under', onPace: 'On pace', over: 'Over' },
  create: 'Create budget from my spending',
  emptyTitle: 'No budget yet',
  empty: 'Start from what you spend now. You can change every line.',
} as const;
