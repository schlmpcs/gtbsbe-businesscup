'use client';

// P5 Budget (/budget): planned vs actual per category, grouped, with a "where you should be today" marker.
// Presentational: every number comes from useBudget(); the route passes its Link and the empty-state links.
import type { ComponentType, ReactNode } from 'react';
import { budget as t, planner } from '@/copy';
import { Button, buttonClassName, Card, Choice, cx, formatMoney, NumberInput, PageHeader, Row, Stack, Stat } from '@/ui-kit';
import type { BudgetGroupVM, BudgetIncomeRowVM, BudgetMode, BudgetRowVM, BudgetStatus, BudgetVM } from '../model/types';

export type BudgetLinks = { guess: string; upload: string };

export type BudgetScreenProps = {
  vm: BudgetVM;
  links: BudgetLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const STATUS_TEXT: Record<BudgetStatus, string> = { under: 'text-positive', onPace: 'text-text-muted', over: 'text-negative' };

export function BudgetScreen({ vm, links, Link }: BudgetScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="xl">
        <PageHeader title={t.title} intro={t.intro} />
        <PeriodBar vm={vm} />
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.loading}</span>
          </div>
        ) : (
          <>
            {!vm.hasBudget && (
              <Card data-testid="budget-empty" title={t.emptyTitle}>
                <Stack gap="md">
                  <p className="text-text-muted">{t.empty}</p>
                  <Row gap="md">
                    <Button onClick={vm.createBudget}>{t.create}</Button>
                    <Link href={links.guess} className={buttonClassName({ variant: 'ghost' })}>
                      {t.emptyLinks.guess}
                    </Link>
                  </Row>
                </Stack>
              </Card>
            )}
            {vm.totals.actual === 0 && vm.income.actual === 0 && (
              <Card tone="muted" data-testid="budget-no-actuals">
                <Row gap="md" justify="between">
                  <p className="text-sm text-text-muted">{t.noActuals}</p>
                  <Link href={links.upload} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                    {t.emptyLinks.upload}
                  </Link>
                </Row>
              </Card>
            )}
            <Card data-testid="budget-totals">
              <div className="grid grid-cols-3 gap-md">
                <Stat label={t.columns.planned} value={formatMoney(vm.totals.planned)} size="md" />
                <Stat label={t.columns.actual} value={formatMoney(vm.totals.actual)} size="md" />
                <Stat
                  label={t.columns.remaining}
                  value={formatMoney(vm.totals.remaining)}
                  tone={vm.totals.remaining < 0 ? 'negative' : 'default'}
                  size="md"
                />
              </div>
            </Card>
            <Card title={t.income} headingLevel={2}>
              <IncomeLine row={vm.income} />
            </Card>
            {vm.groups.map((g) => (
              <GroupCard key={g.id} group={g} vm={vm} />
            ))}
            <p className="text-xs text-text-muted">
              {t.todayMarker} {vm.mode === 'year' && vm.hasBudget ? t.perMonthHint : null}
            </p>
            <p className="text-xs text-text-muted">{planner.educational}</p>
          </>
        )}
      </Stack>
    </main>
  );
}

function PeriodBar({ vm }: { vm: BudgetVM }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-md">
      <Choice<BudgetMode>
        legend={t.modeLegend}
        name="budget-mode"
        value={vm.mode}
        options={[
          { value: 'month', label: t.modes.month },
          { value: 'year', label: t.modes.year },
        ]}
        onChange={vm.setMode}
      />
      <Row gap="sm" wrap={false}>
        <Button variant="ghost" size="sm" aria-label={t.prev} onClick={vm.prev}>
          ‹
        </Button>
        <h2 data-testid="budget-period" className="min-w-0 text-center text-lg font-bold">
          {vm.monthLabel}
        </h2>
        <Button variant="ghost" size="sm" aria-label={t.next} onClick={vm.next}>
          ›
        </Button>
        {!vm.isCurrent && (
          <Button variant="secondary" size="sm" onClick={vm.today}>
            {t.today}
          </Button>
        )}
      </Row>
    </div>
  );
}

function GroupCard({ group, vm }: { group: BudgetGroupVM; vm: BudgetVM }) {
  const editable = vm.hasBudget && vm.mode === 'month';
  return (
    <Card
      title={planner.budgetGroups[group.id]}
      action={
        <span className="text-sm text-text-muted tabular-nums">
          {t.ofPlanned(formatMoney(group.totals.actual), formatMoney(group.totals.planned))}
        </span>
      }
    >
      <ul className="flex flex-col gap-lg" aria-label={planner.budgetGroups[group.id]}>
        {group.rows.map((row) => (
          <li key={row.category}>
            <BudgetLine row={row} editable={editable} onPlanned={(v) => vm.setPlanned(row.category, v)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BudgetLine({ row, editable, onPlanned }: { row: BudgetRowVM; editable: boolean; onPlanned: (v: number) => void }) {
  const name = planner.categories[row.category];
  return (
    <div data-testid={`budget-row-${row.category}`} className="flex flex-col gap-xs">
      <div className="flex items-baseline justify-between gap-md">
        <span className="min-w-0 font-medium">{name}</span>
        <span className={cx('shrink-0 text-xs font-semibold', STATUS_TEXT[row.status])}>{t.statuses[row.status]}</span>
      </div>
      <Bar progress={row.progress} marker={row.planned > 0 ? row.todayMarker : null} over={row.status === 'over'} />
      <div className="flex flex-wrap items-center justify-between gap-sm text-sm">
        <span className="tabular-nums text-text-muted">{t.ofPlanned(formatMoney(row.actual), formatMoney(row.planned))}</span>
        <span className={cx('tabular-nums font-semibold', row.remaining < 0 ? 'text-negative' : 'text-text')}>
          {row.remaining < 0 ? t.overBy(formatMoney(-row.remaining)) : t.left(formatMoney(row.remaining))}
        </span>
      </div>
      {editable && (
        <NumberInput
          aria-label={t.editPlanned(name)}
          value={row.planned}
          prefix="$"
          suffix="/mo"
          maxFractionDigits={0}
          className="sm:max-w-60"
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
    <div data-testid="budget-income" className="flex flex-col gap-xs">
      <Bar progress={row.progress} marker={row.planned > 0 ? row.todayMarker : null} over={false} />
      <div className="flex flex-wrap items-center justify-between gap-sm text-sm">
        <span className="tabular-nums text-text-muted">{t.ofPlanned(formatMoney(row.actual), formatMoney(row.planned))}</span>
        {row.remaining > 0 && <span className="tabular-nums font-semibold">{t.toCome(formatMoney(row.remaining))}</span>}
      </div>
    </div>
  );
}

/** Spent share of the plan; past 100% the bar is full and red. The thin line is "today". */
function Bar({ progress, marker, over }: { progress: number; marker: number | null; over: boolean }) {
  const width = `${Math.min(100, Math.max(0, progress * 100))}%`;
  return (
    <div aria-hidden="true" className="relative h-sm w-full overflow-hidden rounded-full bg-surface-strong">
      <div className={cx('h-full rounded-full', over && progress > 1 ? 'bg-negative' : 'bg-chart-1')} style={{ width }} />
      {marker !== null && marker > 0 && marker < 1 && (
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${marker * 100}%` }} />
      )}
    </div>
  );
}
