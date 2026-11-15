'use client';

// P6 Recurring (/recurring), reports layout: KPI strip led by "remaining due this month", a month
// calendar with amount chips on the due days, the bills still to come (round initials, no logos), and
// every recurring item by section with a "Not recurring" switch. Presentational: everything comes from
// useRecurring(); the route passes Link.
import type { ComponentType, ReactNode } from 'react';
import { recurring as t, planner } from '@/copy';
import { Button, buttonClassName, cx, EstimateTag, formatMoney, PageHeader, Tag } from '@/ui-kit';
import { CountUp, EmptyState, Initials, KpiStrip, MOTION, Panel, TONE_BG, type ChartTone } from '@/ui-kit/reports';
import type { RecurringCalendarCellVM, RecurringItemVM, RecurringSectionId, RecurringSectionVM, RecurringVM } from '../model/types';

export type RecurringLinks = { guess: string; upload: string };

export type RecurringScreenProps = {
  vm: RecurringVM;
  links: RecurringLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const TONE: Record<RecurringSectionId, ChartTone> = { income: 'positive', expenses: 'c2', creditCards: 'c5' };
const CHIP: Record<RecurringSectionId, string> = {
  income: 'bg-positive-soft text-positive',
  expenses: 'bg-chart-2/15 text-text',
  creditCards: 'bg-chart-5/15 text-text',
};

const itemName = (item: RecurringItemVM): string => (item.labelKey ? t.labels[item.labelKey] : item.label);
const money = (v: number) => formatMoney(v);

export function RecurringScreen({ vm, links, Link }: RecurringScreenProps) {
  return (
    <main className="page flex flex-col gap-xl">
      <PageHeader title={t.title} intro={t.intro} aside={vm.ready ? <MonthBar vm={vm} /> : undefined} />
      {!vm.ready ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-lg">
          <div className="h-28 animate-pulse rounded-(--card-radius) bg-surface" />
          <div className="h-96 animate-pulse rounded-(--card-radius) bg-surface" />
          <span className="sr-only">{t.loading}</span>
        </div>
      ) : (
        <>
          {vm.empty && (
            <EmptyState
              data-testid="recurring-empty"
              art="calendar"
              title={t.empty}
              body={t.emptyBody}
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
          )}
          {vm.error && (
            <p role="alert" className="card px-lg py-md text-sm">
              {t.error}
            </p>
          )}
          <Kpis vm={vm} />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-xl lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Panel title={t.calendarTitle} subtitle={vm.monthLabel} delay={60} className="px-sm sm:px-xl">
              <Calendar vm={vm} />
            </Panel>
            <Upcoming vm={vm} />
          </div>
          <section aria-label={t.allTitle} className="grid grid-cols-[minmax(0,1fr)] gap-xl lg:grid-cols-3">
            {vm.sections.map((s, i) => (
              <SectionCard key={s.id} section={s} onHide={vm.markNotRecurring} delay={180 + i * 60} />
            ))}
          </section>
          <p className="text-xs text-text-muted">{planner.educational}</p>
        </>
      )}
    </main>
  );
}

function Kpis({ vm }: { vm: RecurringVM }) {
  const total = (id: RecurringSectionId) => vm.sections.find((s) => s.id === id)?.total ?? 0;
  return (
    <KpiStrip
      data-testid="recurring-kpis"
      aria-label={t.kpisLabel}
      items={[
        {
          id: 'remaining',
          label: t.kpis.remaining,
          value: <CountUp value={vm.upcoming.total} format={money} />,
          hint: t.remainingHint(vm.upcoming.items.length),
        },
        { id: 'expenses', label: t.kpis.expenses, dot: TONE.expenses, value: <CountUp value={total('expenses')} format={money} /> },
        { id: 'creditCards', label: t.kpis.creditCards, dot: TONE.creditCards, value: <CountUp value={total('creditCards')} format={money} /> },
        { id: 'income', label: t.kpis.income, dot: TONE.income, tone: 'positive', value: <CountUp value={total('income')} format={money} /> },
      ]}
    />
  );
}

function MonthBar({ vm }: { vm: RecurringVM }) {
  return (
    <div className="flex items-center gap-xs">
      <Button variant="ghost" size="sm" className="min-h-11 min-w-11" aria-label={t.prev} onClick={vm.prev}>
        ‹
      </Button>
      <h2 data-testid="recurring-month" className="min-w-36 text-center text-lg font-bold">
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
  );
}

function Upcoming({ vm }: { vm: RecurringVM }) {
  return (
    <Panel title={t.upcomingTitle} delay={120} data-testid="recurring-upcoming">
      {vm.upcoming.items.length === 0 ? (
        <p className="text-sm text-text-muted">{t.upcomingNone}</p>
      ) : (
        <ul aria-label={t.upcomingLabel} className="-my-sm flex flex-col divide-y divide-border">
          {vm.upcoming.items.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center gap-md py-sm">
              <Initials name={itemName(item)} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{itemName(item)}</span>
                <span className="text-xs text-text-muted">{item.dayOfMonth === null ? t.dueUnknown : t.due(item.dayOfMonth)}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function SectionCard({ section, onHide, delay }: { section: RecurringSectionVM; onHide: (id: string) => void; delay: number }) {
  return (
    <Panel
      title={t.sections[section.id]}
      data-testid={`recurring-section-${section.id}`}
      delay={delay}
      action={
        <span className="text-sm font-semibold tabular-nums">
          <span className="sr-only">{t.total}: </span>
          {formatMoney(section.total)}
        </span>
      }
    >
      {section.items.length === 0 ? (
        <p className="text-sm text-text-muted">{t.noneThisMonth}</p>
      ) : (
        <ul className="-my-sm flex flex-col divide-y divide-border">
          {section.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-sm py-md">
              <div className="flex items-start gap-md">
                <Initials name={itemName(item)} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-xs">
                  <span className="break-words font-medium">{itemName(item)}</span>
                  <span className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
                    {item.dayOfMonth === null ? t.dueUnknown : t.due(item.dayOfMonth)}
                    {item.dayIsEstimate && <Tag variant="dashed">{t.dayEstimate}</Tag>}
                    {item.flags.map((f) => (
                      <Tag key={f}>{t.flags[f]}</Tag>
                    ))}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-xs">
                  <span className="flex items-center gap-sm font-semibold tabular-nums">
                    {item.amountIsEstimate && <EstimateTag />}
                    {formatMoney(item.amount, { cents: true })}
                  </span>
                  <span className="text-xs text-text-muted">
                    {item.cadence === 'monthly' ? t.perMonth : `${t.cadences[item.cadence]} · ${formatMoney(item.monthly, { cents: true })} ${t.perMonth}`}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-end"
                aria-label={t.markNotRecurringLabel(itemName(item))}
                onClick={() => onHide(item.id)}
              >
                {t.markNotRecurring}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Calendar({ vm }: { vm: RecurringVM }) {
  return (
    <div className="flex flex-col gap-md">
      <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1" aria-label={t.calendarLabel(vm.monthLabel)}>
        <thead>
          <tr>
            {t.weekdays.map((d) => (
              <th key={d} scope="col" className="pb-xs text-xs font-medium text-text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vm.calendar.weeks.map((week, i) => (
            <tr key={i}>
              {week.map((cell, j) => (
                <Cell key={cell.iso ?? `pad-${i}-${j}`} cell={cell} index={i * 7 + j} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-wrap gap-md px-sm text-xs text-text-muted">
        {(Object.keys(TONE) as RecurringSectionId[]).map((s) => (
          <li key={s} className="flex items-center gap-xs">
            <span aria-hidden="true" className={cx('size-2.5 rounded-full', TONE_BG[TONE[s]])} />
            {t.sections[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({ cell, index }: { cell: RecurringCalendarCellVM; index: number }) {
  if (cell.day === null) return <td aria-hidden="true" />;
  const title = cell.items.map((i) => `${itemName(i)} ${formatMoney(i.amount)}`).join(', ');
  const shown = cell.items.slice(0, 2);
  return (
    <td
      data-testid={cell.isToday ? 'recurring-today' : undefined}
      title={title || undefined}
      className={cx(
        'h-16 rounded-md p-0.5 align-top sm:h-24 sm:p-xs',
        cell.items.length > 0 ? 'bg-surface-strong/70' : 'bg-bg/60',
        cell.isToday && 'outline-2 -outline-offset-2 outline-primary',
      )}
    >
      <span
        className={cx(
          'inline-flex size-5 items-center justify-center rounded-full text-xs',
          cell.isToday ? 'bg-primary font-bold text-on-primary' : 'text-text-muted',
        )}
      >
        {cell.day}
      </span>
      {cell.items.length > 0 && (
        <>
          <span className="sr-only">{title}</span>
          <span aria-hidden="true" className="mt-0.5 flex flex-col gap-0.5">
            {shown.map((i) => (
              <span
                key={i.id}
                className={cx('block truncate rounded-sm px-0.5 text-xs font-semibold leading-4 tabular-nums sm:px-xs sm:leading-5', CHIP[i.section], MOTION.fade)}
                style={{ transitionDelay: `${index * 12}ms` }}
              >
                <span className="sm:hidden">{formatMoney(i.amount, { compact: true })}</span>
                <span className="hidden sm:inline">{formatMoney(i.amount)}</span>
              </span>
            ))}
            {cell.items.length > shown.length && <span className="px-0.5 text-xs text-text-muted">{t.more(cell.items.length - shown.length)}</span>}
          </span>
        </>
      )}
    </td>
  );
}
