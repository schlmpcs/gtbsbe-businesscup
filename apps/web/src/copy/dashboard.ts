// Strings for the Dashboard (MP11, /dashboard). The view-model returns ids and keys; the UI looks them up here.
// No math, no amounts: functions only slot in numbers the UI already formatted.
export const dashboard = {
  greeting: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
  title: 'Your money, this month',
  intro: (month: string) => `${month} so far: what you have, what you spent, and where it leads.`,
  loading: 'Loading your dashboard…',
  /** `labelKey` of each setup checklist item. */
  checklist: {
    playedDuel: 'Play today’s Duel',
    guessedOwnMonth: 'Guess your own month',
    addedAccounts: 'Add your accounts',
    importedCsv: 'Import a statement',
    setBudget: 'Set a budget',
    createdPlanEvent: 'Make the plan yours',
  },
  checklistTitle: 'Get set up',
  checklistIntro: 'A few steps and every card here shows your own numbers.',
  checklistProgress: (done: number, total: number) => `${done} of ${total} done`,
  checklistDone: 'Done',
  dismiss: 'Dismiss',
  dismissLabel: 'Hide the setup checklist',

  /** Card link to the full screen. */
  seeAll: 'See all',
  seeAllLabel: (screen: string) => `Open ${screen}`,
  periodLegend: 'Period',

  netWorth: 'Net worth',
  netWorthPeriods: { '1m': '1M', '3m': '3M', '6m': '6M', '12m': '1Y' },
  netWorthPeriodNames: { '1m': 'the last month', '3m': 'the last 3 months', '6m': 'the last 6 months', '12m': 'the last year' },
  netWorthChange: (amount: string, period: string) => `${amount} over ${period}`,
  netWorthNoChange: 'Not enough history yet for a change',
  netWorthChart: 'Net worth by month',
  netWorthTooFew: 'Update a balance next month and your line starts here.',
  netWorthEmpty: { title: 'No accounts yet', body: 'Add a few balances to see your net worth.', cta: 'Add an account' },

  spending: 'Spending',
  spendingThisMonth: 'This month',
  spendingLastMonth: 'Last month',
  spendingVs: (amount: string) => `${amount} vs last month by today`,
  spendingChart: (month: string, previous: string) => `Running spending by day of month: ${month} against ${previous}`,
  spendingDayAxis: 'Day of month',
  spendingEmpty: { title: 'No spending yet', body: 'Import a statement and your month draws itself.', cta: 'Import a statement' },

  budget: 'Budget this month',
  budgetLeft: (amount: string) => `${amount} left`,
  budgetOver: (amount: string) => `${amount} over`,
  budgetOf: (actual: string, planned: string) => `${actual} of ${planned}`,
  budgetToday: 'Line: where you should be today',
  budgetEmpty: { title: 'No budget yet', body: 'Start from your own month in one tap.', cta: 'Set a budget' },

  plan: 'Your plan',
  planChart: (endAge: number) => `Net worth by age, to ${endAge}`,
  planAge: (age: number) => `Age ${age}`,
  planAtRetirement: (age: number) => `At retirement (${age})`,
  planLasts: (age: number) => `Money lasts to ${age}`,
  planShortfall: (age: number) => `Runs short at ${age}`,
  planUnits: { today: 'In today’s dollars', future: 'In future dollars' },
  planSource: 'Rules-based',
  open: 'Open plan',
  chance: 'Chance of success',
  chanceRunning: 'Simulating your futures…',
  chanceError: 'The simulation failed. Open the plan to try again.',
  chanceGood: 'Your plan works in most futures',
  chanceBad: 'Your plan runs short in too many futures',
  chancePaths: (paths: string) => `Out of ${paths} simulated futures`,
  topMove: 'Your next best move',
  topMoveEffect: (amount: string) => `${amount} in 10 years`,

  recurring: 'Recurring',
  recurringRemaining: (amount: string) => `${amount} still due this month`,
  recurringAllPaid: 'Nothing else due this month.',
  recurringDue: (date: string) => `Due ${date}`,
  recurringEmpty: { title: 'No bills found yet', body: 'Import a statement and we spot what comes back.', cta: 'Import a statement' },

  recent: 'Recent transactions',
  recentEmpty: { title: 'No transactions yet', body: 'Your statement stays in this browser.', cta: 'Import a statement' },

  goals: 'Goals',
  goalsSaved: (saved: string, target: string) => `${saved} of ${target}`,
  goalsEmpty: { title: 'No goals yet', body: 'Name something worth saving for.', cta: 'Add a goal' },

  duel: 'Today’s game',
  duelQuestion: 'Which life costs more?',
  duelBody: 'Two lives, one bill. Five rounds a day.',
  duelProgress: (played: number, total: number) => `${played} of ${total} rounds played`,
  duelPlay: 'Play today',
  duelContinue: 'Keep playing',
  duelDone: 'Done for today. Come back tomorrow.',
  duelSeeResult: 'See your result',

  /** The "What if?" row: three decision tools as big tiles, then the hub (/tools). Art ids from public/art. */
  whatIf: {
    title: 'What if?',
    intro: 'Test a decision before you make it.',
    all: 'All tools',
    allLabel: 'Open all What if? tools',
    tiles: {
      afford: { title: 'Can I afford it?', line: 'A purchase against your month and your plan.', art: 'afford-crane', tone: 'primary' },
      loan: { title: 'Which loan costs less?', line: 'Offers side by side, in total dollars.', art: 'coins', tone: 'warm' },
      decide: { title: 'Keep the car or lease?', line: 'Two paths, ten years out.', art: 'loan', tone: 'positive' },
    },
  },

  /** Where each card's link goes (accessible names of the full screens). */
  screens: {
    plan: 'your plan',
    accounts: 'Accounts',
    cashFlow: 'Cash flow',
    budget: 'Budget',
    recurring: 'Recurring',
    transactions: 'Transactions',
    goals: 'Goals',
  },
} as const;
