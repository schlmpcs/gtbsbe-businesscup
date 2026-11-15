// /spend: the daily log. A big "safe to spend today" ring next to the quick-add (text, voice, chips),
// the month in a KPI strip, a day-by-day bar chart against the usual pace, the split by category and
// the purchases logged this month. Presentational: everything comes from SpendVM (engine numbers).
import { common, spend as t } from '@/copy';
import { Button, PageHeader, Tag, cx, formatMoney, formatMonth } from '@/ui-kit';
import { CLASS_TONE, CountUp, EmptyState, KpiStrip, Meter, Panel, Ring, TONE_BG } from '@/ui-kit/reports';
import type { SpendSummaryVM, SpendVM } from '../model/types';
import { DayBars } from './DayBars';
import { QuickAdd } from './QuickAdd';

export type SpendScreenProps = { vm: SpendVM };

const money = (v: number) => formatMoney(v);

function SafeRing({ data }: { data: SpendSummaryVM }) {
  const tone = data.leftShare > 0.25 ? 'positive' : data.leftShare > 0 ? 'warning' : 'negative';
  const over = data.remaining < 0;
  return (
    <section aria-labelledby="spend-safe-heading" className="card card-pad flex min-w-0 flex-col items-center gap-md text-center" data-testid="spend-summary">
      <div className="flex w-full items-center justify-between gap-sm">
        <h2 id="spend-safe-heading" className="section-label">{t.safe.label}</h2>
        <Tag variant="dashed">{t.safe.rulesTag}</Tag>
      </div>
      <Ring value={data.leftShare} tone={tone} thickness={8} className="w-48 sm:w-52">
        <span className="font-display text-4xl font-extrabold leading-none tabular-nums sm:text-5xl" data-testid="spend-safe">
          <CountUp value={data.safeToday} format={money} />
        </span>
        <span className="mt-xs text-sm text-text-muted">{t.safe.perDay}</span>
      </Ring>
      <p className={cx('text-sm', over ? 'font-semibold text-negative' : 'text-text-muted')}>
        {over ? t.summary.over(formatMoney(-data.remaining)) : t.summary.safeHint(data.daysLeft)}
      </p>
      <p className="text-xs text-text-muted">
        {data.everydayBudget > 0
          ? t.safe.left(formatMoney(Math.max(0, data.remaining)), formatMoney(data.everydayBudget))
          : t.safe.noBudget}
      </p>
    </section>
  );
}

function Kpis({ data }: { data: SpendSummaryVM }) {
  const diff = data.projected - data.usual;
  return (
    <KpiStrip
      aria-label={t.kpis.label}
      items={[
        {
          id: 'spent',
          label: t.kpis.spent,
          value: <span data-testid="spend-spent">{formatMoney(data.spent)}</span>,
          hint: (
            <>
              {t.kpis.spentHint(formatMoney(data.usual))}
              <br />
              {data.usualFromHistory ? t.summary.usualFromHistory : t.summary.usualFromProfile}
            </>
          ),
          dot: 'c1',
        },
        {
          id: 'projected',
          label: t.kpis.projected,
          value: <span data-testid="spend-projected"><CountUp value={data.projected} format={money} /></span>,
          hint: Math.round(diff) > 0 ? t.kpis.projectedOver(formatMoney(diff)) : t.kpis.projectedUnder(formatMoney(-diff)),
          tone: Math.round(diff) > 0 ? 'negative' : 'default',
        },
        {
          id: 'bills',
          label: t.kpis.bills,
          value: <CountUp value={data.billsDue} format={money} />,
          hint: t.kpis.billsHint,
        },
      ]}
    />
  );
}

export function SpendScreen({ vm }: SpendScreenProps) {
  const ready = vm.status === 'ready';
  const summary = vm.summary.status === 'ready' ? vm.summary.data : null;
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg pb-2xl pt-md sm:pt-xl">
      <div className="flex flex-col gap-xl">
        <PageHeader eyebrow={t.eyebrow} title={t.title} intro={t.intro} className="animate-enter" />

        <div className="grid gap-lg md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {summary ? (
            <SafeRing data={summary} />
          ) : (
            <section className="card card-pad flex min-h-60 items-center justify-center text-sm text-text-muted" aria-busy={!ready}>
              {vm.summary.status === 'error' ? <span role="alert">{t.summary.error}</span> : '…'}
            </section>
          )}
          <section aria-label={t.input.label} className="card card-pad min-w-0">
            <QuickAdd vm={vm.quickAdd} />
          </section>
        </div>

        {summary && <Kpis data={summary} />}

        {summary && (
          <Panel title={`${t.chart.title} · ${formatMonth(summary.month)}`} subtitle={t.chart.subtitle} delay={80}>
            <DayBars days={vm.chart} max={vm.chartMax} pacePerDay={summary.pacePerDay} month={summary.month} spent={summary.spent} />
          </Panel>
        )}

        {ready && vm.days.length === 0 ? (
          <EmptyState art="duel-houses" title={t.empty.title} body={t.empty.body} headingLevel={2} data-testid="spend-empty" />
        ) : (
          <div className="grid gap-lg md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Panel title={t.month.byCategory} subtitle={t.month.byCategorySub} delay={120}>
              <ul className="flex flex-col gap-md" data-testid="spend-categories">
                {vm.byCategory.map((c) => (
                  <li key={c.category} className="flex flex-col gap-xs">
                    <div className="flex items-baseline justify-between gap-md text-sm">
                      <span className="inline-flex min-w-0 items-center gap-sm">
                        <span aria-hidden="true" className={cx('size-2.5 shrink-0 rounded-full', TONE_BG[CLASS_TONE[c.category]])} />
                        <span className="truncate font-medium">{common.categories[c.category]}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(c.amount)}</span>
                    </div>
                    <Meter value={c.share} tone={CLASS_TONE[c.category]} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={t.month.byDay} subtitle={t.month.byDaySub} delay={160}>
              <ol className="flex flex-col gap-lg" data-testid="spend-days">
                {vm.days.map((d) => (
                  <li key={d.date} className="flex flex-col gap-xs">
                    <div className="flex items-baseline justify-between gap-md border-b border-border pb-xs">
                      <h3 className="text-sm font-bold">
                        {formatMonth(d.date.slice(0, 7), d.day)}
                        <span className="ml-sm font-normal text-text-muted">{t.month.count(d.entries.length)}</span>
                      </h3>
                      <span className="text-sm font-bold tabular-nums">{formatMoney(d.total)}</span>
                    </div>
                    <ul className="flex flex-col">
                      {d.entries.map((e) => {
                        const what = e.label ?? common.categories[e.category];
                        return (
                          <li key={e.id} className="flex items-center justify-between gap-md py-xs text-sm">
                            <span className="flex min-w-0 items-center gap-sm">
                              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_BG[CLASS_TONE[e.category]])} />
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">{what}</span>
                                <span className="text-xs text-text-muted">{common.categories[e.category]}</span>
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-xs">
                              <span className="tabular-nums">{formatMoney(e.amount)}</span>
                              <Button size="sm" variant="ghost" aria-label={t.month.remove(what)} onClick={() => vm.remove(e.id)} className="min-h-11 min-w-11">
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
            </Panel>
          </div>
        )}

        <details className="card card-pad text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold leading-[2.75rem]">{t.how.title}</summary>
          <ul className="mt-sm flex list-disc flex-col gap-xs pl-lg text-text-muted">
            {t.how.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <p className="text-xs text-text-muted">{t.privacy}</p>
      </div>
    </main>
  );
}
