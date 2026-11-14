// Puts every in-memory fixture store of the planner screens back to its demo state. For tests, so a
// hook test starts clean; not used by the app.
import { resetAccountsStore } from '@/features/accounts/model/accountsStore';
import { resetBudgetStore } from '@/features/budget/model/budgetStore';
import { resetGoalsStore } from '@/features/goals/model/goalsStore';
import { resetRecurringStore } from '@/features/recurring/model/recurringStore';
import { resetTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { resetDashboardStore } from './dashboardStore';

export function resetFixtureStores(): void {
  resetAccountsStore();
  resetTransactionsStore();
  resetBudgetStore();
  resetRecurringStore();
  resetGoalsStore();
  resetDashboardStore();
}
