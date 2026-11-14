'use client';

// P6 Recurring (/recurring): pay, bills and subscriptions that come back, as a list by section or a
// month calendar. Presentational: everything comes from useRecurring(); the route passes Link.
import type { ComponentType, ReactNode } from 'react';
import { recurring as t, planner } from '@/copy';
import { Button, buttonClassName, Card, cx, EstimateTag, formatMoney, PageHeader, Row, Stack, Tabs, Tag } from '@/ui-kit';
import type { RecurringCalendarCellVM, RecurringItemVM, RecurringSectionId, RecurringSectionVM, RecurringVM } from '../model/types';

export type RecurringLinks = { guess: string; upload: string };

export type RecurringScreenProps = {
  vm: RecurringVM;
  links: RecurringLinks;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const DOT: Record<RecurringSectionId, string> = { income: 'bg-chart-4', expenses: 'bg-chart-2', creditCards: 'bg-chart-5' };

const itemName = (item: RecurringItemVM): string => (item.labelKey ? t.labels[item.labelKey] : item.label);

export function RecurringScreen({ vm, links, Link }: RecurringScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="xl">
        <PageHeader title={t.title} intro={t.intro} />
        {!vm.ready ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.loading}</span>
          </div>
        ) : (
          <>
            {vm.empty && (
              <Card data-testid="recurring-empty" title={t.empty}>
                <Stack gap="md">
                  <p className="text-text-muted">{t.emptyBody}</p>
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
            )}
            {vm.error && (
              <p role="alert" className="rounded-md bg-surface-strong p-md text-sm">
                {t.error}
              </p>
            )}
            <MonthBar vm={vm} />
            <Tabs
              label={t.viewLegend}
              tabs={[
                {
                  id: 'list',
                  label: t.views.list,
                  panel: (
                    <Stack gap="lg">
                      {vm.sections.map((s) => (
                        <SectionCard key={s.id} section={s} onHide={vm.markNotRecurring} />
                      ))}
                    </Stack>
                  ),
                },
                { id: 'calendar', label: t.views.calendar, panel: <Calendar vm={vm} /> },
              ]}
            />
            <p className="text-xs text-text-muted">{planner.educational}</p>
          </>
        )}
      </Stack>
    </main>
  );
}

function MonthBar({ vm }: { vm: RecurringVM }) {
  return (
    <Row gap="sm" wrap={false}>
      <Button variant="ghost" size="sm" aria-label={t.prev} onClick={vm.prev}>
        ‹
      </Button>
      <h2 data-testid="recurring-month" className="min-w-0 text-lg font-bold">
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
  );
}

function SectionCard({ section, onHide }: { section: RecurringSectionVM; onHide: (id: string) => void }) {
  return (
    <Card
      title={t.sections[section.id]}
      data-testid={`recurring-section-${section.id}`}
      action={
        <span className="text-sm tabular-nums text-text-muted">
          <span className="sr-only">{t.total}: </span>
          {formatMoney(section.total, { cents: true })}
        </span>
      }
    >
      {section.items.length === 0 ? (
        <p className="text-sm text-text-muted">{t.noneThisMonth}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {section.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-sm py-md first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-xs">
                <span className="flex items-center gap-sm font-medium">
                  <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', DOT[item.section])} />
                  <span className="min-w-0 break-words">{itemName(item)}</span>
                </span>
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
                <Button variant="ghost" size="sm" aria-label={t.markNotRecurringLabel(itemName(item))} onClick={() => onHide(item.id)}>
                  {t.markNotRecurring}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Calendar({ vm }: { vm: RecurringVM }) {
  return (
    <Card className="px-sm sm:px-xl">
      <table className="w-full table-fixed border-separate border-spacing-xs" aria-label={t.calendarLabel(vm.monthLabel)}>
        <thead>
          <tr>
            {t.weekdays.map((d) => (
              <th key={d} scope="col" className="text-xs font-medium text-text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vm.calendar.weeks.map((week, i) => (
            <tr key={i}>
              {week.map((cell, j) => (
                <Cell key={cell.iso ?? `pad-${i}-${j}`} cell={cell} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-md flex flex-wrap gap-md px-sm text-xs text-text-muted">
        {(Object.keys(DOT) as RecurringSectionId[]).map((s) => (
          <li key={s} className="flex items-center gap-xs">
            <span aria-hidden="true" className={cx('size-2 rounded-full', DOT[s])} />
            {t.sections[s]}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Cell({ cell }: { cell: RecurringCalendarCellVM }) {
  if (cell.day === null) return <td aria-hidden="true" />;
  const title = cell.items.map((i) => `${itemName(i)} ${formatMoney(i.amount, { cents: true })}`).join(', ');
  const shown = cell.items.slice(0, 3);
  return (
    <td
      data-testid={cell.isToday ? 'recurring-today' : undefined}
      title={title || undefined}
      className={cx(
        'h-14 rounded-sm p-xs align-top sm:h-20',
        cell.items.length > 0 ? 'bg-surface-strong' : '',
        cell.isToday && 'outline-2 outline-primary',
      )}
    >
      <span className={cx('block text-xs', cell.isToday ? 'font-bold' : 'text-text-muted')}>{cell.day}</span>
      {cell.items.length > 0 && (
        <>
          <span className="sr-only">{title}</span>
          <span aria-hidden="true" className="mt-xs flex flex-wrap items-center gap-xs">
            {shown.map((i) => (
              <span key={i.id} className={cx('size-2 rounded-full', DOT[i.section])} />
            ))}
            {cell.items.length > shown.length && <span className="text-xs">{t.more(cell.items.length - shown.length)}</span>}
          </span>
          <span aria-hidden="true" className="hidden truncate text-xs tabular-nums sm:block">
            {formatMoney(cell.items[0]!.amount)}
          </span>
        </>
      )}
    </td>
  );
}
