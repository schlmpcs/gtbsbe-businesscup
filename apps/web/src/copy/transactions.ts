// Strings for the Transactions page (MP11). Category names are in planner.categories.
export const transactions = {
  title: 'Transactions',
  search: 'Search',
  allCategories: 'All categories',
  allAccounts: 'All accounts',
  directions: { all: 'All', in: 'Money in', out: 'Money out' },
  summary: { count: 'Transactions', income: 'Income', spending: 'Spending', largest: 'Largest' },
  import: 'Import CSV',
  importStates: {
    idle: '',
    reading: 'Reading your file…',
    done: 'Imported',
    error: 'We could not read that file.',
  },
  add: 'Add transaction',
  export: 'Export CSV',
  empty: 'No transactions match.',
  applyAll: 'Apply to every transaction from this merchant',
  localOnly: 'Your transactions stay in this browser.',
} as const;
