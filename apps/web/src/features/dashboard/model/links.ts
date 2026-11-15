// Where the planner screens live, in one place, so the Dashboard's deep links (and later the nav) never
// disagree. The routes are not created by MP11; MP14 owns routing and may change these paths.
export const PLANNER_ROUTES = {
  dashboard: '/dashboard',
  accounts: '/accounts',
  addAccount: '/accounts?add=1',
  transactions: '/transactions',
  importCsv: '/transactions?import=1',
  cashFlow: '/cashflow',
  budget: '/budget',
  recurring: '/recurring',
  goals: '/goals',
  plan: '/plan',
  duel: '/play',
  guessOwnMonth: '/me/guess',
} as const;

export type PlannerLinks = typeof PLANNER_ROUTES;
