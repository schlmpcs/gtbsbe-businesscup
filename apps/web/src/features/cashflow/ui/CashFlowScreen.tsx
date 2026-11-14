'use client';

// P4 Cash Flow (/cashflow): income, expenses, savings and savings rate per period, bars or a Sankey,
// and where the money went. Presentational: every number comes from useCashFlow(); the route passes Link.
import type { ComponentType, ReactNode } from 'react';
import { cashflow as t, planner } from '@/copy';
import { BarBreakdown, buttonClassName, Card, Choice, cx, formatMoney, formatMonth, formatRate, PageHeader, Row, Stack, Stat } from '@/ui-kit';
import type {
  CashFlowBarVM, CashFlowBreakdown, CashFlowKpiVM, CashFlowPeriodKind, CashFlowView, CashFlowVM,
} from '../model/types';
import { Sankey } from './Sankey';

export type CashFlowLinks = { guess: string; upload: string };

export type CashFlowScreenProps = {
  vm: CashFlowVM;
  links: CashFlowLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const PERIODS: CashFlowPeriodKind[] = ['monthly', 'quarterly', 'yearly'];
const VIEWS: CashFlowView[] = ['bars', 'sankey'];
const BREAKDOWNS: CashFlowBreakdown[] = ['category', 'group'];

export function CashFlowScreen({ vm, links, Link }: CashFlowScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="xl">
        <PageHeader title={t.title} intro={t.intro} />
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.loading}</span>
          </div>
        ) : vm.empty ? (
          <Card data-testid="cashflow-empty" title={t.emptyTitle}>
            <Stack gap="md">
              <p className="text-text-muted">{t.empty}</p>
              <Row gap="md">
                <Link href={links.upload} className={buttonClassName()}>
                  {t.emptyLinks.upload}
                </Link>
                <Link href={links.guess} className={buttonClassName({ variant: 'ghost' })}>
                  {t.emptyLinks.guess}
                </Link>
              </Row>
            </Stack>
          </Card>
        ) : (
          <Ready vm={vm} />
        )}
        <p className="text-xs text-text-muted">
          {t.transfersNote} {planner.educational}
        </p>
      </Stack>
    </main>
  );
}

function Ready({ vm }: { vm: CashFlowVM }) {
  return (
    <>
      <div className="flex flex-wrap gap-xl">
        <Choice<CashFlowPeriodKind>
          legend={t.periodLegend}
          name="cashflow-period"
          value={vm.period}
          options={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
          onChange={vm.setPeriod}
        />
        <Choice<CashFlowView>
          legend={t.viewLegend}
          name="cashflow-view"
          value={vm.view}
          options={VIEWS.map((v) => ({ value: v, label: t.views[v] }))}
          onChange={vm.setView}
        />
      </div>
      <div data-testid="cashflow-kpis" className="grid grid-cols-2 gap-md sm:grid-cols-4">
        {vm.kpis.map((k) => (
          <Card key={k.id} className="p-lg">
            <Kpi kpi={k} />
          </Card>
        ))}
      </div>
      {vm.view === 'bars' ? (
        <Card title={t.barsTitle}>
          <PeriodBars bars={vm.bars} />
        </Card>
      ) : (
        <Card title={t.sankeyTitle}>
          <Sankey summary={vm.summary} />
        </Card>
      )}
      <Card title={t.breakdownTitle}>
        <Choice<CashFlowBreakdown>
          legend={t.breakdownLegend}
          name="cashflow-breakdown"
          value={vm.breakdown}
          options={BREAKDOWNS.map((b) => ({ value: b, label: t.breakdowns[b] }))}
          onChange={vm.setBreakdown}
        />
        <BarBreakdown
          className="mt-lg"
          label={t.breakdownLabel}
          items={vm.breakdownRows.map((r) =>
            r.kind === 'category'
              ? { id: r.category, label: `${planner.categories[r.category]} · ${formatRate(r.share, 0)}`, amount: r.amount }
              : { id: r.group, label: `${planner.budgetGroups[r.group]} · ${formatRate(r.share, 0)}`, amount: r.amount },
          )}
        />
      </Card>
    </>
  );
}

function Kpi({ kpi }: { kpi: CashFlowKpiVM }) {
  if (kpi.id === 'savingsRate') {
    return (
      <Stat
        label={t.kpis.savingsRate}
        value={kpi.value === null ? t.noRate : formatRate(kpi.value)}
        tone={kpi.value !== null && kpi.value < 0 ? 'negative' : 'default'}
        hint={kpi.previous === null ? undefined : t.previous(formatRate(kpi.previous))}
        size="md"
      />
    );
  }
  return (
    <Stat
      label={t.kpis[kpi.id]}
      value={formatMoney(kpi.value)}
      tone={kpi.id === 'savings' && kpi.value < 0 ? 'negative' : 'default'}
      hint={kpi.previous === null ? undefined : t.previous(formatMoney(kpi.previous))}
      size="md"
    />
  );
}

function periodLabel(bar: CashFlowBarVM): string {
  if (bar.quarter !== null) return t.quarter(bar.quarter, bar.period.from.slice(0, 4));
  if (bar.period.from === bar.period.to) return formatMonth(bar.period.from);
  return bar.period.from.slice(0, 4);
}

/** One row per period: an income bar and an expenses bar on one shared scale, each with its value. */
function PeriodBars({ bars }: { bars: readonly CashFlowBarVM[] }) {
  const scale = Math.max(0, ...bars.flatMap((b) => [b.income, b.expenses]));
  const width = (v: number) => `${scale > 0 ? Math.max(0, Math.min(100, (v / scale) * 100)) : 0}%`;
  return (
    <Stack gap="lg">
      <ul aria-label={t.kpis.income + ' / ' + t.kpis.expenses} className="flex gap-lg text-xs text-text-muted">
        <li className="flex items-center gap-xs">
          <span aria-hidden="true" className="size-2 rounded-full bg-chart-1" />
          {t.kpis.income}
        </li>
        <li className="flex items-center gap-xs">
          <span aria-hidden="true" className="size-2 rounded-full bg-chart-2" />
          {t.kpis.expenses}
        </li>
      </ul>
      <ul aria-label={t.barsLabel} className="flex flex-col gap-lg">
        {bars.map((b) => (
          <li key={b.period.from} data-testid="cashflow-bar" className="flex flex-col gap-xs">
            <div className="flex items-baseline justify-between gap-md text-sm">
              <span className={cx(b.isCurrent ? 'font-bold' : 'font-medium')}>{periodLabel(b)}</span>
              <span className={cx('tabular-nums text-xs', b.savings < 0 ? 'text-negative' : 'text-text-muted')}>
                {b.savings < 0 ? t.overspent : t.saved} {formatMoney(Math.abs(b.savings))}
              </span>
            </div>
            <BarLine className="bg-chart-1" width={width(b.income)} value={b.income} label={t.kpis.income} />
            <BarLine className="bg-chart-2" width={width(b.expenses)} value={b.expenses} label={t.kpis.expenses} />
          </li>
        ))}
      </ul>
    </Stack>
  );
}

function BarLine({ className, width, value, label }: { className: string; width: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-sm" title={`${label}: ${formatMoney(value)}`}>
      <div className="h-sm min-w-0 flex-1">
        <div className={cx('h-full rounded-r-sm', className)} style={{ width }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums">
        <span className="sr-only">{label} </span>
        {formatMoney(value)}
      </span>
    </div>
  );
}
