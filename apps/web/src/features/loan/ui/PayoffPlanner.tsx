'use client';

// S12 Loan Lab, the debt payoff planner section (M13). Replaces the single-method payoff order card once the
// planner is supplied. All numbers come from usePayoffPlanner(); nothing is computed here.
import { loan as t } from '@/copy';
import { Card, formatMoney } from '@/ui-kit';
import type { LinkComponent, PayoffPlannerVM } from '../model/types';
import { BalanceChart } from './BalanceChart';
import { ExtraControl } from './ExtraControl';
import { MethodToggle } from './MethodToggle';
import { PayoffCompare } from './PayoffCompare';
import { PayoffOrderList } from './PayoffOrderList';
import { TargetDate } from './TargetDate';

const PlainLink: LinkComponent = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

function EditDebts({ href, Link }: { href: string; Link: LinkComponent }) {
  return (
    <Link href={href} className="w-fit text-base font-semibold text-primary underline underline-offset-4">
      {t.planner.editDebts}
    </Link>
  );
}

function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.planner.loading}</span>
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-lg bg-surface-strong" />
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-lg bg-surface-strong" />
    </div>
  );
}

function NeverNotice({ fix }: { fix: NonNullable<PayoffPlannerVM['fix']> | null }) {
  return (
    <div className="flex flex-col gap-xs rounded-lg border-2 border-negative bg-surface p-md">
      <p className="text-base font-bold text-negative">{t.planner.never.title}</p>
      <p className="text-sm">{t.planner.never.body}</p>
      {fix && (
        <p className="text-sm font-semibold">
          {fix.extra === null ? t.planner.never.fixNone : t.planner.never.fix(formatMoney(fix.extra), fix.years)}
        </p>
      )}
    </div>
  );
}

/** The comparison, chart, order and target-date solver for the debts plus the selected offer. */
export function PayoffPlanner({ vm, selectedName, Link = PlainLink }: { vm: PayoffPlannerVM; selectedName: string | null; Link?: LinkComponent }) {
  const failed = vm.comparison?.status === 'error' ? vm.comparison.error : null;
  return (
    <Card title={t.planner.title} headingLevel={2} data-testid="payoff-planner" className="flex flex-col gap-xl">
      <p className="max-w-prose text-sm text-text-muted">{t.planner.intro}</p>
      {vm.hidden ? (
        <p className="text-base font-semibold">{t.planner.hidden}</p>
      ) : vm.status === 'loading' || vm.comparison?.status === 'loading' ? (
        <Loading />
      ) : !vm.hasDebts ? (
        <div className="flex flex-col gap-md">
          <p className="text-base font-semibold">{t.planner.noDebts}</p>
          <EditDebts href={vm.balanceSheetHref} Link={Link} />
        </div>
      ) : failed ? (
        <p role="alert" className="rounded-lg border-2 border-negative bg-surface p-md text-sm text-negative">
          {failed.kind === 'invalidResponse' ? t.planner.errors.invalidResponse : t.planner.errors.other}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-2">
            <ExtraControl
              extra={vm.extra}
              extraLimit={vm.extraLimit}
              setExtra={vm.setExtra}
              suggestion={vm.suggestion}
              extraIsSuggested={vm.extraIsSuggested}
            />
            <MethodToggle method={vm.method} setMethod={vm.setMethod} />
          </div>
          <PayoffCompare vm={vm} />
          {vm.selected?.monthsToDebtFree === null && <NeverNotice fix={vm.fix} />}
          {vm.isEstimate && <p className="text-xs text-text-muted">{t.planner.estimate}</p>}
          <p className="text-xs text-text-muted">{t.planner.assumptions}</p>
          {vm.chart && <BalanceChart chart={vm.chart} method={vm.method} />}
          <PayoffOrderList vm={vm} selectedName={selectedName} />
          <TargetDate vm={vm} />
          <EditDebts href={vm.balanceSheetHref} Link={Link} />
        </>
      )}
    </Card>
  );
}
