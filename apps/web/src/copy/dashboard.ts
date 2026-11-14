// Strings for the Dashboard (MP11). The view-model returns ids and keys; the UI looks them up here.
export const dashboard = {
  greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  /** `labelKey` of each setup checklist item. */
  checklist: {
    playedDuel: 'Play today’s Duel',
    guessedOwnMonth: 'Guess your own month',
    addedAccounts: 'Add your accounts',
    importedCsv: 'Import a statement',
    createdPlanEvent: 'Add an event to your plan',
  },
  checklistTitle: 'Get set up',
  dismiss: 'Dismiss',
  netWorth: 'Net worth',
  spending: 'Spending this month',
  budget: 'Budget',
  plan: 'Plan',
  planRun: 'Run',
  topMove: 'Your next best move',
  duel: 'Today’s Duel',
  recent: 'Recent transactions',
} as const;
