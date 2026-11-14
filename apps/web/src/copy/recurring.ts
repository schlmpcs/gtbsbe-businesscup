// Strings for Recurring (MP11). `labels` are the keys of items that come from the profile or an
// account instead of a statement line (those carry their own text).
export const recurring = {
  title: 'Recurring',
  sections: { income: 'Income', expenses: 'Expenses', creditCards: 'Credit cards' },
  labels: { takeHomePay: 'Take-home pay', rent: 'Rent and utilities', loan: 'Loan payment', card: 'Card minimum payment' },
  views: { list: 'List', calendar: 'Calendar' },
  markNotRecurring: 'Not recurring',
  perMonth: 'per month',
  empty: 'Nothing recurring found yet.',
} as const;
