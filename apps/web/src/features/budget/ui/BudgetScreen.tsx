'use client';

// P5 Budget (/budget), reports layout: a KPI strip (planned / spent / left), the income line, one card
// per budget group with bars that grow in (red past the plan, a thin "today" marker), and a donut of
// spending by group. Presentational: every number comes from useBudget(); the route passes its Link and
// the empty-state links.
import type { ComponentType, ReactNode } from 'react';
import { budget as t, planner } from '@/copy';
import { Button, buttonClassName, cx, formatMoney, NumberInput, PageHeader } from '@/ui-kit';
import { CountUp, Donut, EmptyState, GROUP_TONE, KpiStrip, Meter, Panel, Segmented, TONE_BG, type ChartTone } from '@/ui-kit/reports';
import type { BudgetGroupVM, BudgetIncomeRowVM, BudgetMode, BudgetRowVM, BudgetStatus, BudgetVM } from '../model/types';

export type BudgetLinks = { guess: string; upload: string };

export type BudgetScreenProps = {
  vm: BudgetVM;
  links: BudgetLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const STATUS_CHIP: Record<BudgetStatus, string> = {
  under: 'bg-positive-soft text-positive',
  onPace: 'bg-surface-strong text-text-muted',
  over: 'bg-negative/10 text-negative',
};

const money = (v: number) => formatMoney(v);

export function BudgetScreen({ vm, links, Link }: BudgetScreenProps) {
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader title={t.title} intro={t.intro} aside={<PeriodBar vm={vm} />} />
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-lg">
          <div className="h-28 animate-pulse rounded-(--card-radius) bg-surface" />
          <div className="h-96 animate-pulse rounded-(--card-radius) bg-surface" />
          <span className="sr-only">{t.loading}</span>
        </div>
      ) : (
        <>
          {!vm.hasBudget && (
            <EmptyState
              data-testid="budget-empty"
              art="house-blueprint"
              title={t.emptyTitle}
              body={t.empty}
              actions={
                <>
                  <Button onClick={vm.createBudget}>{t.create}</Button>
                  <Link href={links.guess} className={buttonClassName({ variant: 'ghost' })}>
                    {t.emptyLinks.guess}
                  </Link>
                </>
              }
            />
          )}
          {vm.totals.actual === 0 && vm.income.actual === 0 && (
            <div data-testid="budget-no-actuals" className="card flex flex-wrap items-center justify-between gap-md px-lg py-md">
              <p className="min-w-0 flex-1 text-sm text-text-muted">{t.noActuals}</p>
              <Link href={links.upload} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                {t.emptyLinks.upload}
              </Link>
            </div>
          )}
          <KpiStrip
            data-testid="budget-totals"
            aria-label={t.kpisLabel}
            items={[
              { id: 'planned', label: t.kpis.planned, value: <CountUp value={vm.totals.planned} format={money} /> },
              { id: 'spent', label: t.kpis.spent, value: <CountUp value={vm.totals.actual} format={money} /> },
              {
                id: 'left',
                label: vm.totals.remaining < 0 ? t.kpis.over : t.kpis.left,
                value: <CountUp value={vm.totals.remaining < 0 ? -vm.totals.remaining : vm.totals.remaining} format={money} />,
                tone: vm.totals.remaining < 0 ? 'negative' : 'positive',
              },
            ]}
          />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-xl lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-xl">
              <Panel title={t.income} delay={60}>
                <IncomeLine row={vm.income} />
              </Panel>
              {vm.groups.map((g, i) => (
                <GroupCard key={g.id} group={g} vm={vm} delay={120 + i * 60} />
              ))}
            </div>
            <SpendingDonut vm={vm} />
          </div>
          <p className="text-xs text-text-muted">
            {t.todayMarker} {vm.mode === 'year' && vm.hasBudget ? t.perMonthHint : null} {planner.educational}
          </p>
        </>
      )}
    </main>
  );
}

function PeriodBar({ vm }: { vm: BudgetVM }) {
  return (
    <div className="flex flex-wrap items-center gap-md">
      <Segmented<BudgetMode>
        legend={t.modeLegend}
        name="budget-mode"
        value={vm.mode}
        options={[
          { value: 'month', label: t.modes.month },
          { value: 'year', label: t.modes.year },
        ]}
        onChange={vm.setMode}
      />
      <div className="flex items-center gap-xs" role="group" aria-label={t.periodLabel}>
        <Button variant="ghost" size="sm" className="min-h-11 min-w-11" aria-label={t.prev} onClick={vm.prev}>
          ‹
        </Button>
        <h2 data-testid="budget-period" className="min-w-32 text-center text-lg font-bold">
          {vm.monthLabel}
        </h2>
        <Button variant="ghost" size="sm" className="min-h-11 min-w-11" aria-label={t.next} onClick={vm.next}>
          ›
        </Button>
        {!vm.isCurrent && (
          <Button variant="secondary" size="sm" onClick={vm.today}>
            {t.today}
          </Button>
        )}
      </div>
    </div>
  );
}

function SpendingDonut({ vm }: { vm: BudgetVM }) {
  const groups = vm.groups.filter((g) => g.totals.actual > 0);
  return (
    <Panel title={t.donutTitle} delay={120} className="lg:sticky lg:top-lg" data-testid="budget-donut">
      <div className="flex flex-col items-center gap-lg">
        <Donut
          label={t.donutLabel}
          className="max-w-56"
          segments={vm.groups.map((g) => ({ id: g.id, value: g.totals.actual, tone: GROUP_TONE[g.id] }))}
        >
          <span className="section-label">{t.donutCenter}</span>
          <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(vm.totals.actual)}</span>
        </Donut>
        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">{t.donutEmpty}</p>
        ) : (
          <ul className="flex w-full flex-col gap-sm text-sm">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-md">
                <span className="flex min-w-0 items-center gap-sm">
                  <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', TONE_BG[GROUP_TONE[g.id]])} />
                  {planner.budgetGroups[g.id]}
                </span>
                <span className="tabular-nums">{formatMoney(g.totals.actual)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function GroupCard({ group, vm, delay }: { group: BudgetGroupVM; vm: BudgetVM; delay: number }) {
  const editable = vm.hasBudget && vm.mode === 'month';
  const over = group.totals.remaining < 0;
  return (
    <Panel
      title={planner.budgetGroups[group.id]}
      delay={delay}
      action={
        <span className={cx('text-sm tabular-nums', over ? 'font-semibold text-negative' : 'text-text-muted')}>
          {t.ofPlanned(formatMoney(group.totals.actual), formatMoney(group.totals.planned))}
        </span>
      }
    >
      <ul className="-my-sm flex flex-col divide-y divide-border" aria-label={planner.budgetGroups[group.id]}>
        {group.rows.map((row) => (
          <li key={row.category} className="py-md">
            <BudgetLine row={row} tone={GROUP_TONE[group.id]} editable={editable} onPlanned={(v) => vm.setPlanned(row.category, v)} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function BudgetLine({
  row,
  tone,
  editable,
  onPlanned,
}: {
  row: BudgetRowVM;
  tone: ChartTone;
  editable: boolean;
  onPlanned: (v: number) => void;
}) {
  const name = planner.categories[row.category];
  const over = row.status === 'over' && row.progress > 1;
  return (
    <div
      data-testid={`budget-row-${row.category}`}
      className={cx('flex flex-col gap-sm', editable && 'sm:grid sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-center sm:gap-x-xl')}
    >
      <div className="flex min-w-0 flex-col gap-sm">
        <div className="flex items-center justify-between gap-md">
          <span className="min-w-0 truncate font-medium">{name}</span>
          <span className={cx('shrink-0 rounded-full px-sm py-0.5 text-xs font-semibold', STATUS_CHIP[row.status])}>{t.statuses[row.status]}</span>
        </div>
        <Meter value={row.progress} tone={over ? 'negative' : tone} marker={row.planned > 0 ? row.todayMarker : null} size="md" />
        <div className="flex flex-wrap items-center justify-between gap-sm text-sm">
          <span className="tabular-nums text-text-muted">{t.ofPlanned(formatMoney(row.actual), formatMoney(row.planned))}</span>
          <span className={cx('tabular-nums font-semibold', row.remaining < 0 ? 'text-negative' : 'text-text')}>
            {row.remaining < 0 ? t.overBy(formatMoney(-row.remaining)) : t.left(formatMoney(row.remaining))}
          </span>
        </div>
      </div>
      {editable && (
        <NumberInput
          aria-label={t.editPlanned(name)}
          value={row.planned}
          prefix="$"
          suffix="/mo"
          maxFractionDigits={0}
          onValueChange={(v) => {
            if (v !== null) onPlanned(v);
          }}
        />
      )}
    </div>
  );
}

function IncomeLine({ row }: { row: BudgetIncomeRowVM }) {
  return (
    <div data-testid="budget-income" className="flex flex-col gap-sm">
      <Meter value={row.progress} tone="positive" marker={row.planned > 0 ? row.todayMarker : null} size="md" />
      <div className="flex flex-wrap items-center justify-between gap-sm text-sm">
        <span className="tabular-nums text-text-muted">{t.ofPlanned(formatMoney(row.actual), formatMoney(row.planned))}</span>
        {row.remaining > 0 && <span className="tabular-nums font-semibold">{t.toCome(formatMoney(row.remaining))}</span>}
      </div>
    </div>
  );
}
