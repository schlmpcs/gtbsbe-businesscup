'use client';

// Life events timeline (placeholder UI; the designer's frames replace it). All data and actions come
// from useLifeEvents(); nothing is computed here, only formatted.
import { lifeEvents as t } from '@/copy';
import {
  Art, Button, Card, EstimateTag, ForecastChart, PageHeader, SourceNote, Stack, Stat, formatMoney,
} from '@/ui-kit';
import type { LifeEventVM, LifeEventsVM } from '../model/types';
import { EventEditor } from './EventEditor';
import { Timeline, chipText } from './Timeline';

const signed = (n: number) => formatMoney(n, { signed: true });

function Picker({ vm }: { vm: LifeEventsVM }) {
  return (
    <section aria-labelledby="life-picker-title" className="flex flex-col gap-sm" data-testid="life-picker">
      <h2 id="life-picker-title" className="text-xl font-bold">
        {t.picker.title}
      </h2>
      <p className="text-sm text-text-muted">{t.picker.hint}</p>
      <div className="flex flex-wrap gap-sm">
        {vm.kinds.map((k) => (
          <Button key={k} variant="secondary" size="sm" onClick={() => vm.add(k)}>
            {t.picker.add(t.kinds[k])}
          </Button>
        ))}
      </div>
    </section>
  );
}

function EventSummary({ e }: { e: LifeEventVM }) {
  const name = chipText(e);
  const head =
    e.monthlyEffect === 0 && e.oneOffEffect !== 0
      ? t.result.oneOffOnly(name, e.calendarYear, signed(e.oneOffEffect))
      : t.result.eventLine(name, e.calendarYear, signed(e.monthlyEffect));
  return (
    <li className="flex flex-col gap-xs rounded-lg bg-surface p-lg shadow-sm" data-testid="life-event-line" data-kind={e.kind}>
      <div className="flex flex-wrap items-center gap-sm">
        <span className="font-bold tabular-nums">{head}</span>
        {e.monthlyEffect !== 0 && e.oneOffEffect !== 0 && (
          <span className="text-sm text-text-muted tabular-nums">{t.result.oneOff(signed(e.oneOffEffect))}</span>
        )}
        {e.isEstimate && <EstimateTag />}
      </div>
      {e.lines.length > 0 && (
        <ul className="flex flex-col gap-xs text-sm">
          {e.lines.map((l, i) => (
            <li key={i} className="flex flex-col">
              <span className="tabular-nums">
                {t.result.lineAmount(t.lines[l.item], signed(l.effect))}
              </span>
              <SourceNote source={l.source} variant="toggle" />
            </li>
          ))}
        </ul>
      )}
      {e.missingChildcare && <p className="text-sm text-text-muted">{t.result.missingChildcare}</p>}
      {e.beyondHorizon ? (
        <p className="text-sm text-text-muted">{t.result.beyondHorizon}</p>
      ) : (
        <p className="text-sm text-text-muted tabular-nums">{t.result.alone(signed(e.effect10yAlone))}</p>
      )}
    </li>
  );
}

function Result({ vm }: { vm: LifeEventsVM }) {
  const r = vm.result;
  if (!r) {
    return (
      <p role="alert" className="text-negative">
        {t.result.error}
      </p>
    );
  }
  const anyEstimate = vm.events.some((e) => e.isEstimate);
  return (
    <Stack gap="xl">
      <Card tone="muted" data-testid="life-result">
        <Stack gap="lg">
          {vm.events.length === 0 ? (
            <p className="text-lg">{t.result.noEvents}</p>
          ) : (
            <Stat
              label={t.result.deltaLabel}
              value={<span data-testid="life-delta">{t.result.delta(signed(r.delta))}</span>}
              tone={r.delta < 0 ? 'negative' : r.delta > 0 ? 'positive' : 'default'}
              size="lg"
              isEstimate={anyEstimate}
            />
          )}
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <Stat label={t.result.without} value={formatMoney(r.in10y.without)} hint={t.result.in10y} />
            <Stat label={t.result.with} value={formatMoney(r.in10y.with)} hint={t.result.in10y} isEstimate={anyEstimate} />
          </div>
        </Stack>
      </Card>
      <Card>
        <ForecastChart
          title={t.chart.title}
          series={{ label: t.chart.without, points: r.without }}
          compare={vm.events.length > 0 ? { label: t.chart.with, points: r.with } : undefined}
          showBand={false}
          footnote={t.chart.footnote}
        />
      </Card>
      {vm.events.length > 0 && (
        <section aria-labelledby="life-events-list" className="flex flex-col gap-md">
          <h2 id="life-events-list" className="text-xl font-bold">
            {t.result.perEventTitle}
          </h2>
          <ul className="flex flex-col gap-md">
            {vm.events.map((e) => (
              <EventSummary key={e.id} e={e} />
            ))}
          </ul>
        </section>
      )}
    </Stack>
  );
}

export function LifeEventsScreen({ vm }: { vm: LifeEventsVM }) {
  const selected = vm.events.find((e) => e.id === vm.selectedId) ?? null;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        intro={t.intro}
        aside={<Art name="home-family" className="hidden h-40 w-40 sm:flex" />}
      />
      <p className="mt-md text-sm text-text-muted">
        {vm.homeIsFallback ? t.result.homeFallback(vm.homeMetro) : t.result.homeArea(vm.homeMetro)}
      </p>
      <div className="mt-xl grid grid-cols-1 gap-xl lg:grid-cols-2">
        <Stack gap="xl" className="min-w-0">
          <Timeline vm={vm} />
          <Picker vm={vm} />
          {selected && <EventEditor key={selected.id} event={selected} vm={vm} />}
        </Stack>
        <div className="min-w-0">
          <Result vm={vm} />
        </div>
      </div>
      <p className="mt-2xl text-sm text-text-muted">{t.disclaimer}</p>
    </main>
  );
}
