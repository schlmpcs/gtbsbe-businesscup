// The dashboard's widget cards. Presentational: each takes its slice of the DashboardVM and the route's
// Link; every amount and ratio comes from the view-model (engine numbers), only formatted here.
import { useState } from 'react';
import { dashboard as t, forecast, goals as goalsCopy, planner, recurring as recurringCopy } from '@/copy';
import { Art, buttonClassName, cx, formatMoney, formatMonth, formatRate, Tag, ToolTile } from '@/ui-kit';
import type {
  BudgetGroupBarVM, ChecklistItemVM, DashboardVM, NetWorthPeriod, PlannerLinks, TransactionRowVM, UpcomingBillVM,
} from '../model/types';
import { ArcGauge, LineChart, MeterBar, Ring } from './charts';
import { EmptyState, Icon, Segmented, Widget, type DashLink } from './Widget';

type CardBase = { Link: DashLink; links: PlannerLinks; index: number };

const compact = (v: number) => formatMoney(v, { compact: true });
/** "Nov 12" from 'YYYY-MM-DD'. */
const shortDate = (iso: string) => `${formatMonth(iso.slice(0, 7)).slice(0, 3)} ${Number(iso.slice(8, 10))}`;

// ----- Setup checklist --------------------------------------------------------------------------------

export function ChecklistCard({ checklist, onDismiss, Link }: { checklist: DashboardVM['checklist']; onDismiss: () => void; Link: DashLink }) {
  return (
    <section aria-labelledby="dash-checklist-title" data-testid="dashboard-checklist" className="card card-pad animate-enter flex flex-col gap-lg">
      <div className="flex items-start gap-lg">
        <Ring value={checklist.done / checklist.total} size={60}>
          {checklist.done}/{checklist.total}
        </Ring>
        <div className="min-w-0 flex-1">
          <h2 id="dash-checklist-title" className="text-lg font-bold leading-tight">
            {t.checklistTitle}
          </h2>
          <p className="text-sm text-text-muted">{t.checklistIntro}</p>
          <p className="sr-only">{t.checklistProgress(checklist.done, checklist.total)}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.dismissLabel}
          className="min-h-11 shrink-0 rounded-md px-sm text-sm font-semibold text-text-muted hover:bg-surface-strong hover:text-text"
        >
          {t.dismiss}
        </button>
      </div>
      <ul className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {checklist.items.map((item) => (
          <ChecklistRow key={item.id} item={item} Link={Link} />
        ))}
      </ul>
    </section>
  );
}

function ChecklistRow({ item, Link }: { item: ChecklistItemVM; Link: DashLink }) {
  const label = t.checklist[item.labelKey];
  const mark = (
    <span
      className={cx(
        'grid size-6 shrink-0 place-items-center rounded-full border-2',
        item.done ? 'border-positive bg-positive text-on-primary' : 'border-border text-transparent',
      )}
      aria-hidden="true"
    >
      <Icon name="check" className="size-3.5" />
    </span>
  );
  if (item.done) {
    return (
      <li data-done="true" className="flex min-h-11 items-center gap-sm rounded-lg bg-surface-strong px-md text-sm text-text-muted">
        {mark}
        <span className="line-through">{label}</span>
        <span className="sr-only">({t.checklistDone})</span>
      </li>
    );
  }
  return (
    <li data-done="false">
      <Link href={item.href} className="flex min-h-11 items-center gap-sm rounded-lg border border-border px-md text-sm font-semibold hover:border-primary hover:bg-primary-soft">
        {mark}
        <span className="flex-1">{label}</span>
        <Icon name="arrow" className="size-4 text-primary" />
      </Link>
    </li>
  );
}

// ----- Plan -------------------------------------------------------------------------------------------

export function PlanCard({ plan, topMove, Link, links, index }: CardBase & { plan: DashboardVM['plan']; topMove: DashboardVM['topMove'] }) {
  return (
    <Widget id="plan" title={t.plan} icon="plan" Link={Link} index={index} link={{ href: links.plan, screen: t.screens.plan }} className="lg:col-span-2">
      {plan === null ? (
        <div role="status" className="h-40 animate-pulse rounded-lg bg-surface-strong">
          <span className="sr-only">{t.loading}</span>
        </div>
      ) : (
        <div className="grid gap-xl md:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="flex min-w-0 flex-col gap-md">
            <div className="flex flex-wrap items-center gap-sm">
              <p className="text-sm font-semibold">{t.planChart(plan.endAge)}</p>
              <Tag title={t.planSource}>{t.planSource}</Tag>
              <span className="text-xs text-text-muted">{t.planUnits[plan.display]}</span>
            </div>
            <LineChart
              label={`${t.planChart(plan.endAge)}: ${t.planAge(plan.points[0]!.age)} ${formatMoney(plan.points[0]!.netWorth)}, ${t.planAtRetirement(plan.retireAge)} ${formatMoney(plan.netWorthAtRetirement)}, ${t.planAge(plan.points.at(-1)!.age)} ${formatMoney(plan.points.at(-1)!.netWorth)}`}
              series={[{ id: 'plan', points: plan.points.map((p) => ({ x: p.age, y: p.netWorth })), colorClass: 'text-primary', area: true, endDot: true }]}
              yInclude={[0]}
              guide={{ x: plan.retireAge, label: String(plan.retireAge) }}
              xLabels={[t.planAge(plan.points[0]!.age), t.planAge(plan.points.at(-1)!.age)]}
              yLabels={{
                top: compact(Math.max(0, ...plan.points.map((p) => p.netWorth))),
                bottom: compact(Math.min(0, ...plan.points.map((p) => p.netWorth))),
              }}
              heightClass="h-40"
            />
            <dl className="grid grid-cols-2 gap-md">
              <div>
                <dt className="section-label">{t.planAtRetirement(plan.retireAge)}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{formatMoney(plan.netWorthAtRetirement, { compact: true })}</dd>
              </div>
              <div>
                <dt className="section-label">{plan.shortfallAge === null ? t.planLasts(plan.endAge) : t.planShortfall(plan.shortfallAge)}</dt>
                <dd className={cx('font-display text-2xl font-bold tabular-nums', plan.shortfallAge === null ? 'text-positive' : 'text-negative')}>
                  {formatMoney(plan.points.at(-1)!.netWorth, { compact: true })}
                </dd>
              </div>
            </dl>
            {topMove && (
              <p className="flex flex-wrap items-center gap-xs rounded-lg bg-primary-soft px-md py-sm text-sm">
                <span className="font-semibold">{t.topMove}:</span>
                <span>{forecast.moves.title(topMove.kind, topMove.category ? planner.categories[topMove.category] : undefined)}</span>
                <span className="font-semibold tabular-nums text-positive">{t.topMoveEffect(formatMoney(topMove.effect10y, { signed: true }))}</span>
              </p>
            )}
          </div>
          <ChanceBlock chance={plan.chance} Link={Link} href={links.plan} />
        </div>
      )}
    </Widget>
  );
}

function ChanceBlock({ chance, Link, href }: { chance: NonNullable<DashboardVM['plan']>['chance']; Link: DashLink; href: string }) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg bg-surface-strong p-lg text-center" data-testid="dashboard-chance">
      <p className="section-label">{t.chance}</p>
      {chance.status === 'result' ? (
        <>
          <div
            role="meter"
            aria-label={t.chance}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(chance.successRate * 100)}
            aria-valuetext={formatRate(chance.successRate, 0)}
            className="w-full"
          >
            <ArcGauge value={chance.successRate} colorClass={chance.good ? 'text-positive' : 'text-warning'} className="mx-auto">
              <span className="font-display text-3xl font-bold leading-none tabular-nums">{formatRate(chance.successRate, 0)}</span>
            </ArcGauge>
          </div>
          <p className={cx('text-sm font-semibold', chance.good ? 'text-positive' : 'text-text')}>{chance.good ? t.chanceGood : t.chanceBad}</p>
          <p className="text-xs text-text-muted">{t.chancePaths(chance.paths.toLocaleString('en-US'))}</p>
        </>
      ) : chance.status === 'running' ? (
        <div role="status" className="flex flex-col items-center gap-sm py-md">
          <ArcGauge value={0} colorClass="text-primary" className="mx-auto opacity-60" />
          <p className="text-sm text-text-muted">{t.chanceRunning}</p>
        </div>
      ) : (
        <p role="alert" className="text-sm text-text-muted">
          {t.chanceError}
        </p>
      )}
      <Link href={href} className={cx(buttonClassName({ size: 'md', fullWidth: true }), 'mt-auto')}>
        {t.open}
      </Link>
    </div>
  );
}

// ----- Net worth --------------------------------------------------------------------------------------

const PERIODS: readonly NetWorthPeriod[] = ['1m', '3m', '6m', '12m'];

export function NetWorthCard({ netWorth, Link, links, index }: CardBase & { netWorth: DashboardVM['netWorth'] }) {
  const [period, setPeriod] = useState<NetWorthPeriod>('3m');
  const cut = netWorth.periods[period];
  const first = cut.points[0];
  const last = cut.points.at(-1);
  const rising = (cut.change ?? 0) >= 0;
  return (
    <Widget
      id="net-worth"
      title={t.netWorth}
      icon="wallet"
      Link={Link}
      index={index}
      link={{ href: links.accounts, screen: t.screens.accounts }}
      action={
        netWorth.hasAccounts ? (
          <Segmented
            legend={t.periodLegend}
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p, label: t.netWorthPeriods[p], title: t.netWorthPeriodNames[p] }))}
          />
        ) : undefined
      }
    >
      {!netWorth.hasAccounts ? (
        <EmptyState icon="wallet" {...t.netWorthEmpty} href={links.addAccount} Link={Link} />
      ) : (
        <>
          <div>
            <p className={cx('font-display text-4xl font-bold leading-tight tabular-nums', netWorth.value < 0 && 'text-negative')} data-testid="dashboard-net-worth-value">
              {formatMoney(netWorth.value)}
            </p>
            <p className={cx('text-sm font-semibold tabular-nums', cut.change === null ? 'text-text-muted' : rising ? 'text-positive' : 'text-negative')}>
              {cut.change === null ? t.netWorthNoChange : t.netWorthChange(formatMoney(cut.change, { signed: true }), t.netWorthPeriodNames[period])}
            </p>
          </div>
          {cut.points.length >= 2 && first && last ? (
            <LineChart
              key={period}
              label={`${t.netWorthChart}: ${formatMonth(first.month)} ${formatMoney(first.value)}, ${formatMonth(last.month)} ${formatMoney(last.value)}`}
              series={[{ id: 'nw', points: cut.points.map((p, i) => ({ x: i, y: p.value })), colorClass: rising ? 'text-positive' : 'text-negative', area: true, endDot: true }]}
              xLabels={[formatMonth(first.month), formatMonth(last.month)]}
            />
          ) : (
            <p className="rounded-lg bg-surface-strong p-md text-sm text-text-muted">{t.netWorthTooFew}</p>
          )}
        </>
      )}
    </Widget>
  );
}

// ----- Spending ---------------------------------------------------------------------------------------

export function SpendingCard({ spending, Link, links, index }: CardBase & { spending: DashboardVM['spending'] }) {
  const month = formatMonth(spending.month);
  const previous = formatMonth(spending.previousMonth);
  const diff = spending.vsLastMonthToDate;
  const days = spending.points.length;
  return (
    <Widget id="spending" title={t.spending} icon="cart" Link={Link} index={index} link={{ href: links.cashFlow, screen: t.screens.cashFlow }}>
      {spending.empty ? (
        <EmptyState icon="cart" {...t.spendingEmpty} href={links.importCsv} Link={Link} />
      ) : (
        <>
          <div>
            <p className="font-display text-4xl font-bold leading-tight tabular-nums" data-testid="dashboard-spending-value">
              {formatMoney(spending.thisMonth)}
            </p>
            <p className={cx('text-sm font-semibold tabular-nums', diff > 0 ? 'text-negative' : 'text-positive')}>
              {t.spendingVs(formatMoney(diff, { signed: true }))}
            </p>
          </div>
          <LineChart
            label={t.spendingChart(month, previous)}
            xDomain={[1, days]}
            yInclude={[0]}
            series={[
              { id: 'last', points: spending.points.map((p) => ({ x: p.day, y: p.lastMonth })), colorClass: 'text-chart-6', dashed: true },
              { id: 'this', points: spending.points.map((p) => ({ x: p.day, y: p.thisMonth })), colorClass: 'text-primary', area: true, endDot: true },
            ]}
            xLabels={['1', String(Math.ceil(days / 2)), String(days)]}
            yLabels={{ top: compact(Math.max(spending.lastMonth, spending.thisMonth)), bottom: '$0' }}
          />
          <ul className="flex flex-wrap gap-x-lg gap-y-xs text-sm" aria-label={t.spendingDayAxis}>
            <li className="flex items-center gap-xs">
              <span className="h-1 w-4 rounded-full bg-primary" aria-hidden="true" />
              {t.spendingThisMonth} ({month}) <span className="font-semibold tabular-nums">{formatMoney(spending.thisMonth)}</span>
            </li>
            <li className="flex items-center gap-xs text-text-muted">
              <span className="h-0 w-4 border-t-2 border-dashed border-chart-6" aria-hidden="true" />
              {t.spendingLastMonth} ({previous}) <span className="font-semibold tabular-nums">{formatMoney(spending.lastMonth)}</span>
            </li>
          </ul>
        </>
      )}
    </Widget>
  );
}

// ----- Budget -----------------------------------------------------------------------------------------

export function BudgetCard({ budget, Link, links, index }: CardBase & { budget: DashboardVM['budget'] }) {
  const over = budget.totals.remaining < 0;
  return (
    <Widget id="budget" title={t.budget} icon="pie" Link={Link} index={index} link={{ href: links.budget, screen: t.screens.budget }}>
      {!budget.hasBudget ? (
        <EmptyState icon="pie" {...t.budgetEmpty} href={links.budget} Link={Link} />
      ) : (
        <>
          <div>
            <p className={cx('font-display text-4xl font-bold leading-tight tabular-nums', over && 'text-negative')}>
              {over ? t.budgetOver(formatMoney(-budget.totals.remaining)) : t.budgetLeft(formatMoney(budget.totals.remaining))}
            </p>
            <p className="text-sm text-text-muted tabular-nums">{t.budgetOf(formatMoney(budget.totals.actual), formatMoney(budget.totals.planned))}</p>
          </div>
          <ul className="flex flex-col gap-md">
            {budget.groups.map((g, i) => (
              <BudgetGroupRow key={g.id} group={g} marker={budget.todayMarker} delayMs={i * 120} />
            ))}
          </ul>
          <p className="text-xs text-text-muted">{t.budgetToday}</p>
        </>
      )}
    </Widget>
  );
}

function BudgetGroupRow({ group, marker, delayMs }: { group: BudgetGroupBarVM; marker: number; delayMs: number }) {
  const over = group.remaining < 0;
  return (
    <li className="flex flex-col gap-xs">
      <div className="flex items-baseline justify-between gap-sm text-sm">
        <span className="font-semibold">{planner.budgetGroups[group.id]}</span>
        <span className="tabular-nums text-text-muted">{t.budgetOf(formatMoney(group.actual), formatMoney(group.planned))}</span>
      </div>
      <MeterBar value={group.progress} marker={marker} fillClass={over ? 'bg-negative' : group.progress > marker ? 'bg-warning' : 'bg-positive'} delayMs={delayMs} />
      <span className={cx('text-xs font-semibold tabular-nums', over ? 'text-negative' : 'text-text-muted')}>
        {over ? t.budgetOver(formatMoney(-group.remaining)) : t.budgetLeft(formatMoney(group.remaining))}
      </span>
    </li>
  );
}

// ----- Recurring --------------------------------------------------------------------------------------

const billLabel = (b: UpcomingBillVM) => (b.labelKey ? recurringCopy.labels[b.labelKey] : b.label);

export function RecurringCard({ recurring, Link, links, index }: CardBase & { recurring: DashboardVM['recurring'] }) {
  return (
    <Widget id="recurring" title={t.recurring} icon="calendar" Link={Link} index={index} link={{ href: links.recurring, screen: t.screens.recurring }}>
      {recurring.empty ? (
        <EmptyState icon="calendar" {...t.recurringEmpty} href={links.importCsv} Link={Link} />
      ) : (
        <>
          <p className="font-display text-2xl font-bold tabular-nums">{t.recurringRemaining(formatMoney(recurring.remainingDue))}</p>
          {recurring.upcoming.length === 0 ? (
            <p className="rounded-lg bg-surface-strong p-md text-sm text-text-muted">{t.recurringAllPaid}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recurring.upcoming.map((b) => (
                <li key={b.id} className="flex min-h-11 items-center gap-md py-sm">
                  <span className="grid w-11 shrink-0 place-items-center rounded-md bg-surface-strong py-xs text-center leading-tight">
                    <span className="text-xs font-semibold uppercase text-text-muted">{formatMonth(b.date.slice(0, 7)).slice(0, 3)}</span>
                    <span className="font-display text-lg font-bold tabular-nums">{Number(b.date.slice(8, 10))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{billLabel(b)}</span>
                    <span className="block text-xs text-text-muted">{recurringCopy.sections[b.section]}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Widget>
  );
}

// ----- Recent transactions ----------------------------------------------------------------------------

export function RecentCard({ rows, Link, links, index }: CardBase & { rows: TransactionRowVM[] }) {
  return (
    <Widget id="recent" title={t.recent} icon="list" Link={Link} index={index} link={{ href: links.transactions, screen: t.screens.transactions }}>
      {rows.length === 0 ? (
        <EmptyState icon="list" {...t.recentEmpty} href={links.importCsv} Link={Link} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center gap-md py-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.label}</span>
                <span className="block text-xs text-text-muted">
                  {shortDate(r.date)} · {planner.categories[r.category]}
                </span>
              </span>
              <span className={cx('font-semibold tabular-nums', r.amount > 0 && 'text-positive')}>{formatMoney(r.amount, { signed: r.amount > 0 })}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// ----- Goals ------------------------------------------------------------------------------------------

export function GoalsCard({ goals, Link, links, index }: CardBase & { goals: DashboardVM['goals'] }) {
  return (
    <Widget id="goals" title={t.goals} icon="target" Link={Link} index={index} link={{ href: links.goals, screen: t.screens.goals }}>
      {goals.length === 0 ? (
        <EmptyState icon="target" {...t.goalsEmpty} href={links.goals} Link={Link} />
      ) : (
        <ul className="flex flex-col gap-md">
          {goals.map((g, i) => (
            <li key={g.id} className="flex flex-col gap-xs">
              <div className="flex items-baseline justify-between gap-sm text-sm">
                <span className="truncate font-semibold">{g.name}</span>
                {g.status && (
                  <span className={cx('shrink-0 text-xs font-semibold', g.status === 'atRisk' ? 'text-warning' : 'text-positive')}>{goalsCopy.statuses[g.status]}</span>
                )}
              </div>
              <MeterBar value={g.savedShare} fillClass={g.status === 'completed' ? 'bg-positive' : 'bg-primary'} delayMs={i * 120} />
              <span className="text-xs tabular-nums text-text-muted">
                {t.goalsSaved(formatMoney(g.saved), formatMoney(g.target))} · {formatRate(g.savedShare, 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

// ----- Today's game -----------------------------------------------------------------------------------

export function GameCard({ duel, Link, links, index }: CardBase & { duel: DashboardVM['duel'] }) {
  const cta = duel.playedToday ? t.duelSeeResult : duel.played > 0 ? t.duelContinue : t.duelPlay;
  return (
    <Widget id="game" title={t.duel} icon="duel" Link={Link} index={index} className="lg:col-span-2">
      <div className="flex flex-col items-center gap-lg sm:flex-row">
        <Art name="duel-houses" className="w-40 shrink-0 sm:w-48" />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <p className="font-display text-2xl font-bold leading-tight">{t.duelQuestion}</p>
          <p className="text-sm text-text-muted">{duel.playedToday ? t.duelDone : t.duelBody}</p>
          <div className="flex items-center gap-sm">
            <ol className="flex gap-xs" aria-hidden="true">
              {Array.from({ length: duel.total }, (_, i) => (
                <li key={i} className={cx('h-2 w-6 rounded-full', i < duel.played ? 'bg-primary' : 'bg-surface-strong')} />
              ))}
            </ol>
            <span className="text-xs font-semibold tabular-nums text-text-muted">{t.duelProgress(duel.played, duel.total)}</span>
          </div>
        </div>
        <Link href={links.duel} className={cx(buttonClassName({ size: 'md' }), 'w-full sm:w-auto')}>
          {cta}
        </Link>
      </div>
    </Widget>
  );
}

// ----- What if? ----------------------------------------------------------------------------------------

/** Three decision tools as big illustrated tiles, then "All tools" (the /tools hub). No numbers here. */
export function WhatIfRow({ Link, links, index }: CardBase) {
  const w = t.whatIf;
  const keys = ['afford', 'loan', 'decide'] as const;
  return (
    <section aria-labelledby="dash-whatif-title" data-testid="dashboard-whatif" className="flex flex-col gap-md">
      <div className="flex min-h-11 flex-wrap items-end justify-between gap-sm">
        <div className="flex flex-col">
          <h2 id="dash-whatif-title" className="font-display text-2xl font-extrabold leading-tight">
            {w.title}
          </h2>
          <p className="text-sm text-text-muted">{w.intro}</p>
        </div>
        <Link
          href={links.tools}
          aria-label={w.allLabel}
          className="inline-flex min-h-11 items-center gap-xs rounded-md px-sm text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          {w.all}
          <Icon name="arrow" className="size-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-lg min-[480px]:grid-cols-3">
        {keys.map((k, i) => {
          const tile = w.tiles[k];
          return (
            <li key={k}>
              <ToolTile href={links[k]} art={tile.art} tone={tile.tone} title={tile.title} line={tile.line} size="md" index={index + i} Link={Link} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
