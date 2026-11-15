'use client';

// P4 Cash Flow (/cashflow), reports layout: four KPI tiles (income, expenses, net income, savings rate),
// one big chart card with a chart-type picker (Sankey / trend bars) and a grouping picker, then the
// period's latest transactions and a summary (largest category, change vs last period, where it went).
// Presentational: every number comes from useCashFlow(); the route passes Link and the hrefs.
import type { ComponentType, ReactNode } from 'react';
import { cashflow as t, planner } from '@/copy';
import { buttonClassName, cx, formatMoney, formatMonth, formatRate, PageHeader, Tag } from '@/ui-kit';
import {
  CategoryChip, CLASS_TONE, CountUp, EmptyState, GROUP_TONE, Initials, KpiStrip, Meter, Panel, Segmented, type ChartTone, type KpiItem,
} from '@/ui-kit/reports';
import type {
  CashFlowBreakdown, CashFlowBreakdownRowVM, CashFlowKpiVM, CashFlowPeriodKind, CashFlowView, CashFlowVM, TransactionRowVM,
} from '../model/types';
import { GhostSankey, Sankey } from './Sankey';
import { BarsThumb, periodLabel, SankeyThumb, TrendBars } from './TrendBars';

export type CashFlowLinks = { guess: string; upload: string; transactions: string };

export type CashFlowScreenProps = {
  vm: CashFlowVM;
  links: CashFlowLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const PERIODS: CashFlowPeriodKind[] = ['monthly', 'quarterly', 'yearly'];
const BREAKDOWNS: CashFlowBreakdown[] = ['category', 'group'];

export function CashFlowScreen({ vm, links, Link }: CashFlowScreenProps) {
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader
        title={t.title}
        intro={t.intro}
        aside={
          vm.ready && !vm.empty ? (
            <Segmented<CashFlowPeriodKind>
              legend={t.periodLegend}
              name="cashflow-period"
              value={vm.period}
              options={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
              onChange={vm.setPeriod}
            />
          ) : undefined
        }
      />
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-lg">
          <div className="h-28 animate-pulse rounded-(--card-radius) bg-surface" />
          <div className="h-96 animate-pulse rounded-(--card-radius) bg-surface" />
          <span className="sr-only">{t.loading}</span>
        </div>
      ) : vm.empty ? (
        <EmptyState
          data-testid="cashflow-empty"
          art="coins"
          title={t.emptyTitle}
          body={t.empty}
          ghost={<GhostSankey className="max-h-80" />}
          className="min-h-96"
          actions={
            <>
              <Link href={links.upload} className={buttonClassName()}>
                {t.emptyLinks.upload}
              </Link>
              <Link href={links.guess} className={buttonClassName({ variant: 'ghost' })}>
                {t.emptyLinks.guess}
              </Link>
            </>
          }
        />
      ) : (
        <Ready vm={vm} links={links} Link={Link} />
      )}
      <p className="text-xs text-text-muted">
        {t.transfersNote} {t.source} {planner.educational}
      </p>
    </main>
  );
}

const currentLabel = (vm: CashFlowVM) => {
  const bar = vm.bars[vm.bars.length - 1];
  return bar ? t.periodNow(periodLabel(bar)) : '';
};

function Ready({ vm, links, Link }: CashFlowScreenProps) {
  return (
    <>
      <KpiStrip data-testid="cashflow-kpis" aria-label={currentLabel(vm)} items={vm.kpis.map(kpiItem)} />
      <Panel
        title={t.chartTitles[vm.view]}
        subtitle={currentLabel(vm)}
        delay={60}
        action={
          <>
            <Segmented<CashFlowView>
              legend={t.viewLegend}
              name="cashflow-view"
              value={vm.view}
              options={[
                { value: 'sankey', label: t.views.sankey, preview: <SankeyThumb /> },
                { value: 'bars', label: t.views.bars, preview: <BarsThumb /> },
              ]}
              onChange={vm.setView}
            />
            {vm.view === 'sankey' && <BreakdownPicker vm={vm} name="cashflow-breakdown" />}
          </>
        }
      >
        <div key={`${vm.view}-${vm.period}-${vm.breakdown}`} className="animate-fade">
          {vm.view === 'sankey' ? <Sankey flow={vm.flow} /> : <TrendBars bars={vm.bars} />}
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <LinesCard vm={vm} links={links} Link={Link} />
        <SummaryCard vm={vm} />
      </div>
    </>
  );
}

function BreakdownPicker({ vm, name }: { vm: CashFlowVM; name: string }) {
  return (
    <Segmented<CashFlowBreakdown>
      legend={t.breakdownLegend}
      name={name}
      value={vm.breakdown}
      options={BREAKDOWNS.map((b) => ({ value: b, label: t.breakdowns[b] }))}
      onChange={vm.setBreakdown}
    />
  );
}

const KPI_DOT: Record<CashFlowKpiVM['id'], ChartTone | undefined> = { income: 'positive', expenses: 'c2', savings: undefined, savingsRate: undefined };

function kpiItem(k: CashFlowKpiVM): KpiItem {
  if (k.id === 'savingsRate') {
    return {
      id: k.id,
      label: t.kpis.savingsRate,
      value: k.value === null ? t.noRate : <CountUp value={k.value} format={(v) => formatRate(v, 0)} />,
      tone: k.value !== null && k.value < 0 ? 'negative' : 'default',
      hint: k.change === null ? t.noChange : t.change(signedRate(k.change)),
    };
  }
  return {
    id: k.id,
    label: t.kpis[k.id],
    dot: KPI_DOT[k.id],
    value: <CountUp value={k.value} format={(v) => formatMoney(v)} />,
    tone: k.id === 'income' ? 'positive' : k.id === 'savings' && k.value < 0 ? 'negative' : 'default',
    hint: k.change === null ? t.noChange : t.change(formatMoney(k.change, { signed: true })),
  };
}

/** A change of a rate in percentage points, signed: +4%, −12%. */
const signedRate = (v: number) => (v > 0 ? `+${formatRate(v, 0)}` : formatRate(v, 0));

const dayLabel = (iso: string) => formatMonth(iso.slice(0, 7), Number(iso.slice(8, 10)));

function LinesCard({ vm, links, Link }: CashFlowScreenProps) {
  return (
    <Panel
      title={t.linesTitle}
      delay={120}
      action={
        vm.lineCount > 0 ? (
          <Link href={links.transactions} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>
            {t.linesAll(vm.lineCount)}
          </Link>
        ) : undefined
      }
    >
      {vm.lines.length === 0 ? (
        <p className="py-lg text-sm text-text-muted">{t.linesNone}</p>
      ) : (
        <ul aria-label={t.linesLabel} data-testid="cashflow-lines" className="-my-sm flex flex-col divide-y divide-border">
          {vm.lines.map((l) => (
            <Line key={l.id} line={l} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Line({ line }: { line: TransactionRowVM }) {
  return (
    <li className="flex min-h-14 items-center gap-md py-sm">
      <Initials name={line.label} />
      <div className="flex min-w-0 flex-1 flex-col gap-xs">
        <span className="truncate font-medium" title={line.label}>
          {line.label}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-sm text-xs text-text-muted">
          <span>{dayLabel(line.date)}</span>
          <CategoryChip category={line.category} name={planner.categories[line.category]} />
        </span>
      </div>
      <span className={cx('shrink-0 font-semibold tabular-nums', line.amount > 0 ? 'text-positive' : 'text-text')}>
        {formatMoney(line.amount, { cents: true, signed: line.amount > 0 })}
      </span>
    </li>
  );
}

function rowName(r: CashFlowBreakdownRowVM) {
  return r.kind === 'category' ? planner.categories[r.category] : planner.budgetGroups[r.group];
}

const rowTone = (r: CashFlowBreakdownRowVM): ChartTone => (r.kind === 'group' ? GROUP_TONE[r.group] : CLASS_TONE[r.category]);

function SummaryCard({ vm }: { vm: CashFlowVM }) {
  const largest = vm.breakdownRows[0];
  const [income, expenses, , rate] = vm.kpis;
  return (
    <Panel title={t.summaryTitle} delay={180} data-testid="cashflow-summary">
      <div className="flex flex-col gap-xl">
        {largest && (
          <div className="flex flex-col gap-xs rounded-lg bg-surface-strong p-lg">
            <span className="section-label">{t.largest}</span>
            <span className="text-lg font-bold">{rowName(largest)}</span>
            <span className="flex flex-wrap items-baseline gap-sm">
              <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(largest.amount)}</span>
              <span className="text-sm text-text-muted">{t.shareOf(formatRate(largest.share, 0))}</span>
            </span>
          </div>
        )}
        <div className="flex flex-col gap-sm">
          <span className="section-label">{t.vsPrevious}</span>
          <dl className="flex flex-col divide-y divide-border text-sm">
            {income && income.id !== 'savingsRate' && <ChangeRow label={t.changeRows.income} change={income.change} format={(v) => formatMoney(v, { signed: true })} goodWhenUp />}
            {expenses && expenses.id !== 'savingsRate' && (
              <ChangeRow label={t.changeRows.expenses} change={expenses.change} format={(v) => formatMoney(v, { signed: true })} goodWhenUp={false} />
            )}
            {rate && <ChangeRow label={t.changeRows.savingsRate} change={rate.change} format={signedRate} goodWhenUp />}
          </dl>
        </div>
        <div className="flex flex-col gap-md">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <span className="section-label">{t.breakdownTitle}</span>
            {vm.view !== 'sankey' && <BreakdownPicker vm={vm} name="cashflow-breakdown-list" />}
          </div>
          <ul aria-label={t.breakdownLabel} className="flex flex-col gap-md">
            {vm.breakdownRows.map((r) => (
              <li key={r.kind === 'category' ? r.category : r.group} className="flex flex-col gap-xs">
                <span className="flex items-baseline justify-between gap-md text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {rowName(r)} <span className="text-text-muted">· {formatRate(r.share, 0)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(r.amount)}</span>
                </span>
                <Meter value={r.share} tone={rowTone(r)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function ChangeRow({ label, change, format, goodWhenUp }: { label: string; change: number | null; format: (v: number) => string; goodWhenUp: boolean }) {
  const good = change === null || change === 0 ? null : change > 0 === goodWhenUp;
  return (
    <div className="flex items-center justify-between gap-md py-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="flex items-center gap-sm">
        {change === null ? (
          <span className="text-text-muted">{t.noChange}</span>
        ) : (
          <>
            <span className={cx('font-semibold tabular-nums', good === null ? 'text-text' : good ? 'text-positive' : 'text-negative')}>{format(change)}</span>
            <Tag>{change > 0 ? t.up : change < 0 ? t.down : t.same}</Tag>
          </>
        )}
      </dd>
    </div>
  );
}
