'use client';

// P7 Goals (/goals): "Save up" goals with their saved share, target date and the engine's on-track
// reading; "Pay down" hands over to the Loan Lab. Presentational: everything comes from useGoals(); the
// route passes Link and the hrefs.
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { goals as t } from '@/copy';
import { Button, buttonClassName, cx, EstimateTag, Field, formatMoney, formatRate, NumberInput, PageHeader, Tabs } from '@/ui-kit';
import { EmptyState, Panel, Ring } from '@/ui-kit/reports';
import type { GoalsVM, SaveUpGoalStatus, SaveUpGoalVM } from '../model/types';

export type GoalsLinks = { loan: string; guess: string; upload: string };

export type GoalsScreenProps = {
  vm: GoalsVM;
  links: GoalsLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const STATUS_CHIP: Record<SaveUpGoalStatus, string> = {
  onTrack: 'bg-positive-soft text-positive',
  atRisk: 'bg-warning/20 text-text',
  completed: 'bg-positive text-on-primary',
};

export function GoalsScreen({ vm, links, Link }: GoalsScreenProps) {
  return (
    <main className="page flex flex-col gap-xl">
        <PageHeader title={t.title} intro={t.intro} />
        <Tabs
          label={t.tabsLabel}
          fullWidth
          tabs={[
            {
              id: 'saveUp',
              label: t.tabs.saveUp,
              panel: !vm.ready ? (
                <div role="status" aria-live="polite" className="h-64 animate-pulse rounded-xl bg-surface">
                  <span className="sr-only">{t.loading}</span>
                </div>
              ) : (
                <SaveUp vm={vm} links={links} Link={Link} />
              ),
            },
            {
              id: 'payDown',
              label: t.tabs.payDown,
              panel: (
                <EmptyState
                  data-testid="goals-paydown"
                  art="loan"
                  title={t.payDown.title}
                  body={t.payDown.body}
                  actions={
                    <Link href={links.loan} className={buttonClassName()}>
                      {t.payDown.cta}
                    </Link>
                  }
                />
              ),
            },
          ]}
        />
        <p className="text-xs text-text-muted">{t.estimate}</p>
    </main>
  );
}

function SaveUp({ vm, links, Link }: GoalsScreenProps) {
  return (
    <div className="flex flex-col gap-xl">
      {vm.goals.length === 0 ? (
        <EmptyState
          data-testid="goals-empty"
          art="coins"
          headingLevel={3}
          title={t.emptyTitle}
          body={t.empty}
          actions={
            <>
              <Link href={links.guess} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                {t.emptyLinks.guess}
              </Link>
              <Link href={links.upload} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>
                {t.emptyLinks.upload}
              </Link>
            </>
          }
        />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-xl md:grid-cols-2">
          {vm.goals.map((g, i) => (
            <li key={g.id} className="flex">
              <GoalCard goal={g} onRemove={() => vm.remove(g.id)} delay={i * 60} />
            </li>
          ))}
        </ul>
      )}
      <AddGoalForm onAdd={vm.addGoal} invalid={vm.inputError} />
    </div>
  );
}

function AddGoalForm({ onAdd, invalid }: { onAdd: GoalsVM['addGoal']; invalid: boolean }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [years, setYears] = useState<number | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = onAdd({ name, target: target ?? 0, years: years ?? 0 });
    if (id !== null) {
      setName('');
      setTarget(null);
      setYears(null);
    }
  };
  return (
    <Panel title={t.form.title} headingLevel={3} className="border-dashed">
      <form onSubmit={submit} aria-label={t.add} className="flex flex-col gap-md" noValidate>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-md sm:grid-cols-3">
          <Field label={t.form.name} id="goal-name">
            <input
              id="goal-name"
              type="text"
              value={name}
              maxLength={60}
              placeholder={t.form.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-md py-md text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
          </Field>
          <Field label={t.form.target}>
            <NumberInput value={target} onValueChange={setTarget} prefix="$" maxFractionDigits={0} />
          </Field>
          <Field label={t.form.years}>
            <NumberInput value={years} onValueChange={setYears} min={1} max={30} maxFractionDigits={0} suffix={t.form.yearsSuffix} />
          </Field>
        </div>
        {invalid && (
          <p role="alert" className="text-sm text-negative">
            {t.invalid}
          </p>
        )}
        <Button type="submit" className="self-start">
          {t.add}
        </Button>
      </form>
    </Panel>
  );
}

function GoalCard({ goal, onRemove, delay }: { goal: SaveUpGoalVM; onRemove: () => void; delay: number }) {
  const projection = goal.projection.status === 'ready' ? goal.projection.data : null;
  const tone = goal.status === 'completed' || goal.status === 'onTrack' ? 'positive' : goal.status === 'atRisk' ? 'warning' : 'primary';
  return (
    <Panel headingLevel={3} data-testid="goal-card" delay={delay} className="flex w-full flex-col gap-lg">
      <div className="flex items-center gap-lg">
        <Ring value={goal.savedShare} tone={tone} className="w-24 sm:w-28">
          <span className="font-display text-xl font-extrabold tabular-nums">{formatRate(goal.savedShare, 0)}</span>
          <span className="text-xs text-text-muted">{t.savedLabel}</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h3 className="min-w-0 break-words text-lg font-bold leading-tight">{goal.name}</h3>
            {goal.status && (
              <span className={cx('rounded-full px-sm py-0.5 text-xs font-semibold', STATUS_CHIP[goal.status])}>{t.statuses[goal.status]}</span>
            )}
          </div>
          <p className="text-sm tabular-nums">
            <span className="sr-only">{t.saved(formatMoney(goal.saved), formatMoney(goal.target))}</span>
            <span aria-hidden="true">
              <span className="font-display text-2xl font-extrabold">{formatMoney(goal.saved)}</span>{' '}
              <span className="text-text-muted">{t.ofTarget(formatMoney(goal.target))}</span>
            </span>
          </p>
          <p className="text-sm text-text-muted">{t.eta(goal.years)}</p>
          {goal.transactions.length > 0 && <p className="text-xs text-text-muted">{t.transactions(goal.transactions.length)}</p>}
        </div>
      </div>
      {goal.projection.status === 'error' && <p className="text-sm text-text-muted">{t.projectionError}</p>}
      {projection && (
        <div className="flex flex-col gap-xs rounded-lg bg-surface-strong p-md text-sm">
          <span className="flex flex-wrap items-center gap-sm text-text-muted">
            {t.monthlyToStayOnTrack}
            <EstimateTag />
          </span>
          <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(projection.monthlyToStayOnTrack)}</span>
          {!projection.reachable && <span className="text-negative">{t.unreachable}</span>}
          <span className="text-text-muted">
            {t.projected}: <span className="tabular-nums text-text">{formatMoney(projection.projected.mid)}</span>
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {t.projectedRange(formatMoney(projection.projected.low), formatMoney(projection.projected.high))}
          </span>
        </div>
      )}
      <Button variant="ghost" size="sm" className="mt-auto self-start" aria-label={t.removeLabel(goal.name)} onClick={onRemove}>
        {t.remove}
      </Button>
    </Panel>
  );
}
