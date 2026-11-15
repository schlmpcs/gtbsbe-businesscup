'use client';

// "What is due this month?" (/tools/bills): every bill of the month on one screen. The answer first (a
// plain sentence and a KPI strip: due, gone out, still to pay, left after bills), then the month grid with
// amount chips and the split by kind, the next 7 days, what is due before payday, the calendar export, and
// every bill with its due day. Presentational: everything comes from useBills(); the route passes Link.
import type { ComponentType, ReactNode } from 'react';
import { bills as t } from '@/copy';
import { Art, Button, buttonClassName, Card, cx, EstimateTag, formatMoney, formatMonth, PageHeader, Stack } from '@/ui-kit';
import { CountUp, EmptyState, KpiStrip, MOTION, Panel } from '@/ui-kit/reports';
import type { BillsVM, MonthVM } from '../model/types';
import { BillList, PaydaysForm } from './BillList';
import { ChargeList } from './ChargeList';
import { KIND_DOT } from './kind';
import { MonthGrid } from './MonthGrid';

export type BillsScreenProps = {
  vm: BillsVM;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
  /** Where "Edit what recurs" goes (/recurring). */
  recurringHref?: string;
};

const money = (n: number) => formatMoney(n);

export function BillsScreen({ vm, Link, recurringHref = '/recurring' }: BillsScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg pb-3xl pt-md">
      <Stack gap="xl">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          intro={t.intro}
          aside={<Art name="calendar" className="hidden h-32 w-32 items-center sm:flex" />}
        />
        {vm.status === 'loading' ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.loading}</span>
          </div>
        ) : vm.status === 'empty' ? (
          <EmptyState
            data-testid="bills-empty"
            art="empty-plot"
            title={t.empty.title}
            body={t.empty.body}
            actions={
              <Link href={vm.uploadHref} className={buttonClassName({ variant: 'primary', size: 'lg' })}>
                {t.empty.upload}
              </Link>
            }
          />
        ) : (
          <Ready vm={vm} Link={Link} recurringHref={recurringHref} />
        )}
      </Stack>
    </main>
  );
}

function verdictText(month: MonthVM): string {
  switch (month.verdict) {
    case 'toPay':
      return t.verdict.toPay(money(month.toPay.total), month.toPay.count);
    case 'clear':
      return t.verdict.clear;
    case 'future':
      return t.verdict.future(money(month.total));
    case 'past':
      return t.verdict.past(money(month.total));
    default:
      return t.verdict.nothing;
  }
}

function Kpis({ month }: { month: MonthVM }) {
  const est = month.totalIsEstimate ? <EstimateTag /> : undefined;
  return (
    <KpiStrip
      data-testid="bills-kpis"
      aria-label={t.kpi.label}
      items={[
        { id: 'due', label: t.kpi.due, value: <CountUp value={month.total} format={money} />, hint: t.kpi.dueHint(month.charges.length), tag: est },
        { id: 'paid', label: t.kpi.paid, value: <CountUp value={month.paid.total} format={money} />, hint: t.kpi.paidHint, dot: 'muted' },
        {
          id: 'toPay',
          label: t.kpi.toPay,
          value: <CountUp value={month.toPay.total} format={money} />,
          hint: t.kpi.toPayHint(month.toPay.count),
          dot: 'primary',
        },
        month.leftAfter
          ? {
              id: 'left',
              label: t.kpi.left,
              value: <CountUp value={month.leftAfter.amount} format={money} />,
              hint: t.kpi.leftHint(money(month.leftAfter.takeHome)),
              tone: month.leftAfter.amount < 0 ? 'negative' : 'positive',
              tag: month.leftAfter.isEstimate ? <EstimateTag /> : undefined,
            }
          : { id: 'left', label: t.kpi.left, value: '—', hint: t.kpi.leftNone },
      ]}
    />
  );
}

/** The month's total split by kind: one stacked bar that grows in, with direct labels. */
function SplitBar({ month }: { month: MonthVM }) {
  if (month.byKind.length === 0) return null;
  const parts = month.byKind.map((k) => t.split.part(t.legend[k.kind], money(k.total), Math.round(k.share * 100)));
  return (
    <div className="flex flex-col gap-sm" data-testid="bills-split">
      <p className="text-sm font-semibold">{t.split.title}</p>
      <div role="img" aria-label={t.split.label(parts.join(', '))} className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-strong">
        {month.byKind.map((k) => (
          <span key={k.kind} className={cx('h-full', KIND_DOT[k.kind], MOTION.growX)} style={{ width: `${k.share * 100}%` }} />
        ))}
      </div>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-lg gap-y-xs text-xs text-text-muted">
        {month.byKind.map((k) => (
          <li key={k.kind} className="flex items-center gap-xs">
            <span className={cx('size-2 rounded-full', KIND_DOT[k.kind])} />
            <span className="font-semibold text-text">{t.legend[k.kind]}</span>
            <span className="tabular-nums">{money(k.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ready({ vm, Link, recurringHref }: { vm: Extract<BillsVM, { status: 'ready' }>; Link: BillsScreenProps['Link']; recurringHref: string }) {
  const { month } = vm;
  return (
    <>
      <section aria-label={t.kpi.label} className="flex flex-col gap-md">
        <p data-testid="bills-verdict" className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
          {verdictText(month)}
        </p>
        <div data-testid="bills-month-total">
          <Kpis month={month} />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className={cx('flex flex-col gap-lg px-sm sm:px-xl', MOTION.rise)}>
          <MonthGrid month={month} onPrev={vm.prevMonth} onNext={vm.nextMonth} onToday={vm.thisMonth} />
          <div className="px-sm sm:px-0">
            <SplitBar month={month} />
          </div>
        </Card>

        <Stack gap="xl">
          <Panel title={t.soon.title} data-testid="bills-soon">
            <ChargeList
              charges={vm.soon.charges}
              total={vm.soon.total}
              totalIsEstimate={vm.soon.totalIsEstimate}
              empty={t.soon.empty}
              testId="bills-soon-list"
            />
          </Panel>

          <Panel title={t.payday.title} data-testid="bills-payday" delay={80}>
            <Stack gap="md">
              {vm.beforePayday && (
                <>
                  <p className="text-sm text-text-muted">
                    {t.payday.line(formatMonth(vm.beforePayday.payday.iso.slice(0, 7), vm.beforePayday.payday.day))}
                  </p>
                  <ChargeList
                    charges={vm.beforePayday.charges}
                    total={vm.beforePayday.total}
                    totalIsEstimate={vm.beforePayday.totalIsEstimate}
                    empty={t.payday.none}
                  />
                </>
              )}
              <PaydaysForm days={vm.paydays.days} isEstimate={vm.paydays.isEstimate} onChange={vm.setPaydays} />
            </Stack>
          </Panel>

          <div className="flex flex-col gap-sm">
            <Button variant="primary" size="lg" fullWidth onClick={vm.exportCalendar}>
              {t.export.button}
            </Button>
            <p role="status" className="text-sm text-text-muted">
              {vm.exportOutcome ? t.export[vm.exportOutcome] : t.export.hint}
            </p>
          </div>
        </Stack>
      </div>

      <Panel
        title={t.list.title}
        subtitle={t.list.lead}
        action={
          <Link href={recurringHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            {t.recurringLink}
          </Link>
        }
      >
        <BillList bills={vm.bills} onDueDay={vm.setDueDay} />
      </Panel>

      <details className="card card-pad group">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-md font-semibold">
          {t.howTitle}
          <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <ul className="mt-md flex list-disc flex-col gap-sm pl-lg text-sm text-text-muted">
          {t.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
