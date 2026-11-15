// @vitest-environment jsdom
// A connected demo bank fills every screen from one read of its statement: the ledger, the profile
// (the plan), the checking account, the budget and a goal. No network: the categorizer is faked.
import hh02 from '@lifeguessr/data/fixtures/synthetic-statements/hh02-queens-retail-roommates.csv?raw';
import hh09 from '@lifeguessr/data/fixtures/synthetic-statements/hh09-agoura-hills-two-kid-homeowners.csv?raw';
import hh13 from '@lifeguessr/data/fixtures/synthetic-statements/hh13-elk-grove-single-income-family.csv?raw';
import hh21 from '@lifeguessr/data/fixtures/synthetic-statements/hh21-chandler-young-family.csv?raw';
import { COST_CATEGORIES, type CategoryTotals, type StatementItem } from '@lifeguessr/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bankDemo as t } from '@/copy';
import { useBudgetStore } from '@/features/budget/model/budgetStore';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useGoalsStore } from '@/features/goals/model/goalsStore';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { useAccountsStore } from '@/lib/model/accounts';
import { useAppStore } from '@/state/store';
import { DEMO_GOAL_MONTHS, DEMO_GOAL_YEARS, fillFromDemoBank, fillFromStatement } from './model/fillAll';
import { statementFile } from './model/useBankDemo';
import { latestBalance } from './model/preview';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

/** The month the fake categorizer sums: groceries only, so the profile change is easy to see. */
const MONTH: CategoryTotals = {
  month: '2026-10',
  totals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, c === 'groceries' ? 612 : 0])) as CategoryTotals['totals'],
  oneOffs: [],
};
/** One class per line sent, in order, as the real route answers. No model, no network. */
const fakeCategorize = async (items: readonly StatementItem[]) => ({
  months: [MONTH],
  categorizedBy: 'rules' as const,
  lines: items.map((i) => ({ cls: i.amount < 0 ? ('pay' as const) : ('groceries' as const), oneOffHint: false })),
});
const readDeps = { categorize: fakeCategorize as never, remember: false };

describe('latestBalance', () => {
  it('reads the newest line of the Balance column, in either file order', () => {
    expect(latestBalance(hh13)).toBe(4192.09); // Posting Date … Balance, newest first
    expect(latestBalance(hh21)).toBe(1536.76); // Details, Posting Date … Balance
    expect(latestBalance(hh09)).not.toBeNull(); // "Running Bal."
    expect(latestBalance('Date,Description,Amount\n2026-01-02,A,1\n2026-01-03,B,2\n')).toBeNull();
    expect(latestBalance(hh02)).toBeNull(); // no balance column
    expect(latestBalance('Date,Description,Amount,Balance\n2026-01-02,A,-1,10\n2026-01-03,B,-2,8\n2026-01-03,C,-1,7\n')).toBe(7);
  });
});

describe('fillFromDemoBank', () => {
  it('fills the ledger, the plan profile, the checking account, the budget and a goal', async () => {
    const before = ledger().list().length;
    const { imported } = await fillFromDemoBank(statementFile('maple', hh13), 'maple', readDeps);

    expect(imported.added).toBeGreaterThan(100);
    expect(ledger().list().length).toBe(before + imported.added);

    const { profile, statementMonths } = useAppStore.getState();
    expect(statementMonths.map((m) => m.month)).toContain('2026-10');
    expect(profile.spending.groceries).toEqual({ value: 612, isEstimate: false });

    const checking = useAccountsStore.getState().accounts.find((a) => a.id === 'checking-1')!;
    expect(checking.name).toBe(t.fill.checkingName(t.banks.maple));
    expect(checking.balance).toEqual({ value: 4192.09, isEstimate: false });

    const budget = useBudgetStore.getState();
    expect(budget.planned?.groceries).toBe(612);
    expect(budget.incomePlanned).toBe(profile.takeHomePay.value);

    const spending = COST_CATEGORIES.reduce((s, c) => s + profile.spending[c].value, 0);
    expect(useGoalsStore.getState().goals).toEqual([
      expect.objectContaining({ name: t.fill.goalName, target: Math.round(DEMO_GOAL_MONTHS * spending), years: DEMO_GOAL_YEARS }),
    ]);
  });

  it('connecting again adds no lines and keeps the budget and goals the person has', async () => {
    useBudgetStore.getState().create({ ...useBudgetStore.getState().planned!, ...Object.fromEntries(COST_CATEGORIES.map((c) => [c, 1])) }, 1000);
    useGoalsStore.getState().addGoal({ name: 'Trip', target: 3000, years: 1 });
    await fillFromDemoBank(statementFile('maple', hh13), 'maple', readDeps);
    const again = await fillFromDemoBank(statementFile('maple', hh13), 'maple', readDeps);

    expect(again.imported.added).toBe(0);
    expect(useBudgetStore.getState()).toMatchObject({ incomePlanned: 1000, planned: expect.objectContaining({ groceries: 1 }) });
    expect(useGoalsStore.getState().goals.map((g) => g.name)).toEqual(['Trip']);
  });

  it('returns the statement’s last balance; with keepTyped (the /start form confirms balances) it writes none', async () => {
    const before = useAccountsStore.getState().accounts.find((a) => a.id === 'checking-1')!.balance;
    const typed = await fillFromStatement(statementFile('maple', hh13), 'Chase', readDeps, { keepTyped: { takeHomePay: 6100 } });
    expect(typed.balance).toBe(4192.09);
    const checking = useAccountsStore.getState().accounts.find((a) => a.id === 'checking-1')!;
    expect(checking.name).toBe(t.fill.checkingName('Chase'));
    expect(checking.balance).toEqual(before);
    expect(useAppStore.getState().profile.takeHomePay.value).toBe(6100);
    expect((await fillFromDemoBank(statementFile('pebble', hh02), 'pebble', readDeps)).balance).toBeNull();
  });

  it('keeps the checking balance when the statement has no Balance column', async () => {
    const before = useAccountsStore.getState().accounts.find((a) => a.id === 'checking-1')!.balance; // the fixture's first cash account
    await fillFromDemoBank(statementFile('pebble', hh02), 'pebble', readDeps);
    const checking = useAccountsStore.getState().accounts.find((a) => a.id === 'checking-1')!;
    expect(checking.name).toBe(t.fill.checkingName(t.banks.pebble));
    expect(checking.balance).toEqual(before);
  });
});
