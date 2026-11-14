// /spend: the daily log. Quick-add (text, voice, chips), the month so far, this month's entries
// by day and the totals by category. Presentational: everything comes from SpendVM.
import type { ComponentType, ReactNode } from 'react';
import { common, spend as t } from '@/copy';
import { Button, formatMoney, formatMonth, Money, PageHeader, Stack } from '@/ui-kit';
import type { SpendVM } from '../model/types';
import { QuickAdd } from './QuickAdd';
import { SpendSummary } from './SpendSummary';

type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type SpendScreenProps = { vm: SpendVM; homeHref: string; Link: LinkComponent };

const CARD = 'rounded-xl bg-surface p-xl shadow-md';
const CARD_TITLE = 'text-xs font-bold uppercase tracking-wide text-text-muted';

export function SpendScreen({ vm, homeHref, Link }: SpendScreenProps) {
  const ready = vm.status === 'ready';
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg py-xl sm:py-3xl">
      <Stack gap="2xl">
        <PageHeader eyebrow={t.eyebrow} title={t.title} intro={t.intro} />

        <section className={CARD}>
          <QuickAdd vm={vm.quickAdd} />
        </section>

        <section className={CARD} aria-labelledby="spend-summary-heading">
          <h2 id="spend-summary-heading" className={CARD_TITLE}>
            {t.summary.title}
          </h2>
          <div className="mt-md">
            {!ready || vm.summary.status === 'loading' ? (
              <p className="text-sm text-text-muted">…</p>
            ) : vm.summary.status === 'error' ? (
              <p role="alert" className="text-sm">
                {t.summary.error}
              </p>
            ) : (
              <SpendSummary data={vm.summary.data} />
            )}
          </div>
        </section>

        <div className="grid gap-xl md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className={CARD} aria-labelledby="spend-days-heading">
            <h2 id="spend-days-heading" className={CARD_TITLE}>
              {t.month.byDay}
            </h2>
            {vm.days.length === 0 ? (
              <p className="mt-md text-sm text-text-muted">{t.month.empty}</p>
            ) : (
              <ol className="mt-md flex flex-col gap-lg" data-testid="spend-days">
                {vm.days.map((d) => (
                  <li key={d.date} className="flex flex-col gap-xs">
                    <div className="flex items-baseline justify-between gap-md border-b border-border pb-xs">
                      <h3 className="text-sm font-bold">{formatMonth(d.date.slice(0, 7), d.day)}</h3>
                      <span className="text-sm font-bold tabular-nums">
                        <Money value={d.total} cents />
                      </span>
                    </div>
                    <ul className="flex flex-col">
                      {d.entries.map((e) => {
                        const what = e.label ?? common.categories[e.category];
                        return (
                          <li key={e.id} className="flex items-center justify-between gap-md py-xs text-sm">
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">{what}</span>
                              <span className="text-xs text-text-muted">{common.categories[e.category]}</span>
                            </span>
                            <span className="flex items-center gap-sm">
                              <span className="tabular-nums">{formatMoney(e.amount, { cents: true })}</span>
                              <Button size="sm" variant="ghost" aria-label={t.month.remove(what)} onClick={() => vm.remove(e.id)}>
                                <span aria-hidden="true">✕</span>
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={CARD} aria-labelledby="spend-cats-heading">
            <h2 id="spend-cats-heading" className={CARD_TITLE}>
              {t.month.byCategory}
            </h2>
            {vm.byCategory.length === 0 ? (
              <p className="mt-md text-sm text-text-muted">{t.month.empty}</p>
            ) : (
              <ul className="mt-md flex flex-col gap-sm" data-testid="spend-categories">
                {vm.byCategory.map((c) => (
                  <li key={c.category} className="flex items-baseline justify-between gap-md text-sm">
                    <span>{common.categories[c.category]}</span>
                    <span className="font-semibold tabular-nums">
                      <Money value={c.amount} cents />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="text-xs text-text-muted">{t.privacy}</p>
        <Link href={homeHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
          <span aria-hidden="true">←</span>&nbsp;{t.backHome}
        </Link>
      </Stack>
    </main>
  );
}
