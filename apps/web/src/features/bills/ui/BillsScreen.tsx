'use client';

// Bills calendar (/tools/bills): every charge of the month on one screen. Presentational: everything
// comes from useBills(); the route passes its Link component.
import type { ComponentType, ReactNode } from 'react';
import { bills as t } from '@/copy';
import { Art, Button, buttonClassName, Card, cx, EstimateTag, formatMoney, formatMonth, PageHeader, Stack } from '@/ui-kit';
import type { BillKindVM, BillsVM } from '../model/types';
import { BillList, PaydaysForm } from './BillList';
import { ChargeList } from './ChargeList';
import { KIND_DOT, MonthGrid } from './MonthGrid';

export type BillsScreenProps = {
  vm: BillsVM;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

const LEGEND: BillKindVM[] = ['rent', 'debt', 'subscription'];

export function BillsScreen({ vm, Link }: BillsScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <Stack gap="2xl">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          intro={t.intro}
          aside={<Art name="calendar" className="hidden h-40 w-40 items-center sm:flex" />}
        />
        {vm.status === 'loading' ? (
          <div role="status" aria-live="polite" className="h-96 animate-pulse rounded-xl bg-surface">
            <span className="sr-only">{t.loading}</span>
          </div>
        ) : vm.status === 'empty' ? (
          <Card data-testid="bills-empty" className="flex flex-col items-center gap-md text-center">
            <Art name="empty-plot" className="flex h-40 w-40 items-center" />
            <h2 className="font-display text-3xl font-extrabold">{t.empty.title}</h2>
            <p className="max-w-prose text-text-muted">{t.empty.body}</p>
            <Link href={vm.uploadHref} className={buttonClassName({ variant: 'primary', size: 'lg' })}>
              {t.empty.upload}
            </Link>
          </Card>
        ) : (
          <Ready vm={vm} />
        )}
        <p className="text-xs text-text-muted">{t.note}</p>
      </Stack>
    </main>
  );
}

function Ready({ vm }: { vm: Extract<BillsVM, { status: 'ready' }> }) {
  const { month } = vm;
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-lg px-sm sm:px-xl">
          <MonthGrid month={month} onPrev={vm.prevMonth} onNext={vm.nextMonth} onToday={vm.thisMonth} />
          <div className="flex flex-wrap items-end justify-between gap-md px-sm sm:px-0">
            <div data-testid="bills-month-total">
              <p className="text-sm text-text-muted">
                {t.month.total} · {t.month.count(month.charges.length)}
              </p>
              <p className="flex items-center gap-sm font-display text-4xl font-extrabold tabular-nums">
                {formatMoney(month.total, { cents: true })}
                {month.totalIsEstimate && <EstimateTag />}
              </p>
            </div>
            <ul aria-label={t.legend.label} className="flex flex-wrap gap-md text-xs text-text-muted">
              {LEGEND.map((k) => (
                <li key={k} className="flex items-center gap-xs">
                  <span aria-hidden="true" className={cx('size-2 rounded-full', KIND_DOT[k])} />
                  {t.legend[k]}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Stack gap="xl">
          <Card title={t.soon.title} headingLevel={2} data-testid="bills-soon">
            <div className="mt-md">
              <ChargeList
                charges={vm.soon.charges}
                total={vm.soon.total}
                totalIsEstimate={vm.soon.totalIsEstimate}
                empty={t.soon.empty}
                testId="bills-soon-list"
              />
            </div>
          </Card>

          <Card title={t.payday.title} headingLevel={2} tone="muted" data-testid="bills-payday">
            <Stack gap="md" className="mt-md">
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
          </Card>

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

      <Card title={t.list.title} headingLevel={2}>
        <p className="mt-xs text-sm text-text-muted">{t.list.lead}</p>
        <BillList bills={vm.bills} onDueDay={vm.setDueDay} />
      </Card>
    </>
  );
}
