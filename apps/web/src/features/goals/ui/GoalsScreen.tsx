'use client';

// P7 Goals (/goals): "Save up" goals with their saved share, target date and the engine's on-track
// reading; "Pay down" hands over to the Loan Lab. Presentational: everything comes from useGoals(); the
// route passes Link and the hrefs.
import { useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { goals as t } from '@/copy';
import { Button, buttonClassName, Card, cx, EstimateTag, Field, formatMoney, NumberInput, PageHeader, Row, Stack, Tabs } from '@/ui-kit';
import type { GoalsVM, SaveUpGoalStatus, SaveUpGoalVM } from '../model/types';

export type GoalsLinks = { loan: string; guess: string; upload: string };

export type GoalsScreenProps = {
  vm: GoalsVM;
  links: GoalsLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const STATUS_TEXT: Record<SaveUpGoalStatus, string> = { onTrack: 'text-positive', atRisk: 'text-warning', completed: 'text-positive' };

export function GoalsScreen({ vm, links, Link }: GoalsScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="xl">
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
                <Card title={t.payDown.title} data-testid="goals-paydown">
                  <Stack gap="md">
                    <p className="text-text-muted">{t.payDown.body}</p>
                    <Link href={links.loan} className={cx(buttonClassName(), 'self-start')}>
                      {t.payDown.cta}
                    </Link>
                  </Stack>
                </Card>
              ),
            },
          ]}
        />
        <p className="text-xs text-text-muted">{t.estimate}</p>
      </Stack>
    </main>
  );
}

function SaveUp({ vm, links, Link }: GoalsScreenProps) {
  return (
    <Stack gap="lg">
      <AddGoalForm onAdd={vm.addGoal} invalid={vm.inputError} />
      {vm.goals.length === 0 ? (
        <Card tone="muted" data-testid="goals-empty" title={t.emptyTitle} headingLevel={3}>
          <Stack gap="md">
            <p className="text-sm text-text-muted">{t.empty}</p>
            <Row gap="md">
              <Link href={links.guess} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                {t.emptyLinks.guess}
              </Link>
              <Link href={links.upload} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>
                {t.emptyLinks.upload}
              </Link>
            </Row>
          </Stack>
        </Card>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-lg md:grid-cols-2">
          {vm.goals.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} onRemove={() => vm.remove(g.id)} />
            </li>
          ))}
        </ul>
      )}
    </Stack>
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
    <Card title={t.form.title} headingLevel={3}>
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
    </Card>
  );
}

function GoalCard({ goal, onRemove }: { goal: SaveUpGoalVM; onRemove: () => void }) {
  const projection = goal.projection.status === 'ready' ? goal.projection.data : null;
  return (
    <Card
      title={goal.name}
      headingLevel={3}
      data-testid="goal-card"
      action={
        goal.status && (
          <span className={cx('text-sm font-semibold', STATUS_TEXT[goal.status])}>{t.statuses[goal.status]}</span>
        )
      }
    >
      <Stack gap="md">
        <div aria-hidden="true" className="h-sm w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className={cx('h-full rounded-full', goal.status === 'completed' ? 'bg-positive' : 'bg-chart-1')}
            style={{ width: `${Math.min(100, Math.max(0, goal.savedShare * 100))}%` }}
          />
        </div>
        <p className="text-sm tabular-nums">{t.saved(formatMoney(goal.saved), formatMoney(goal.target))}</p>
        <p className="text-sm text-text-muted">{t.eta(goal.years)}</p>
        {goal.transactions.length > 0 && <p className="text-xs text-text-muted">{t.transactions(goal.transactions.length)}</p>}
        {goal.projection.status === 'error' && <p className="text-sm text-text-muted">{t.projectionError}</p>}
        {projection && (
          <div className="flex flex-col gap-xs rounded-md bg-surface-strong p-md text-sm">
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
        <Button variant="ghost" size="sm" className="self-start" aria-label={t.removeLabel(goal.name)} onClick={onRemove}>
          {t.remove}
        </Button>
      </Stack>
    </Card>
  );
}
