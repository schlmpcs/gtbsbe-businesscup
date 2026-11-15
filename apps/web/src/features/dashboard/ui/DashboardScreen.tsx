// P1 Dashboard (/dashboard): a greeting, the setup checklist while something is missing, then a grid of
// widget cards (two columns on desktop, one on a phone): the plan with its Chance of success, net worth,
// the "What if?" row (three decision tools as illustrated tiles, then all tools), spending, budget,
// recurring bills, recent transactions, goals and today's game. Presentational: every number comes from
// useDashboard(); the route passes its Link.
import { dashboard as t, planner } from '@/copy';
import { formatMonthYear } from '@/ui-kit';
import type { DashboardVM } from '../model/types';
import { BudgetCard, ChecklistCard, GameCard, GoalsCard, NetWorthCard, PlanCard, RecentCard, RecurringCard, SpendingCard, WhatIfRow } from './Cards';
import type { DashLink } from './Widget';

export type { DashLink } from './Widget';

export type DashboardScreenProps = { vm: DashboardVM; Link: DashLink };

export function DashboardScreen({ vm, Link }: DashboardScreenProps) {
  const base = { Link, links: vm.links };
  return (
    <main className="page flex flex-col gap-xl" data-testid="dashboard">
      <header className="animate-enter flex flex-col gap-xs">
        {/* The greeting reads the browser's clock: shown once loaded, so the server render matches the first client one. */}
        <p className="section-label min-h-4">{vm.ready ? t.greeting[vm.greeting.part] : null}</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{t.title}</h1>
        <p className="text-text-muted">{t.intro(formatMonthYear(vm.spending.month))}</p>
      </header>
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="grid gap-lg lg:grid-cols-2">
          <span className="sr-only">{t.loading}</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {vm.checklist.visible && <ChecklistCard checklist={vm.checklist} onDismiss={vm.dismissChecklist} Link={Link} />}
          <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
            <PlanCard {...base} index={0} plan={vm.plan} topMove={vm.topMove} />
            <NetWorthCard {...base} index={1} netWorth={vm.netWorth} />
          </div>
          <WhatIfRow {...base} index={2} />
          <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
            <SpendingCard {...base} index={2} spending={vm.spending} />
            <BudgetCard {...base} index={3} budget={vm.budget} />
            <RecurringCard {...base} index={4} recurring={vm.recurring} />
            <RecentCard {...base} index={5} rows={vm.recentTransactions} />
            <GoalsCard {...base} index={6} goals={vm.goals} />
            <GameCard {...base} index={7} duel={vm.duel} />
          </div>
          <p className="text-xs text-text-muted">{planner.educational}</p>
        </>
      )}
    </main>
  );
}
