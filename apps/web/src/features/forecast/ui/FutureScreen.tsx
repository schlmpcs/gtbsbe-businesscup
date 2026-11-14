// S10 You in N years + Next Moves: the year picker, the headline number with its range, the forecast
// chart with the range band, a comparison with a move, the ranked moves and "How we calculate".
import type { ReactNode } from 'react';
import { forecast as t, yearsPhrase } from '@/copy';
import { Art, buttonClassName, Choice, cx, EstimateTag, ForecastChart, formatMoney, Money, Stack, Sticker } from '@/ui-kit';
import type { FutureVM } from '../model/types';
import { HOW_WE_CALCULATE_ID, HowWeCalculate } from './HowWeCalculate';
import { NextMoves } from './NextMoves';
import {
  bandText,
  ErrorNote,
  estimatedFieldLabel,
  EYEBROW,
  moveTitle,
  RangeText,
  Skeleton,
  SourceTag,
  Toggle,
  type LinkComponent,
} from './shared';

export type FutureScreenProps = {
  vm: FutureVM;
  links: { today: string; makeExact: string };
  Link: LinkComponent;
  /** The goal card (its own view-model), placed under the headline number when the route passes it. */
  goal?: ReactNode;
};

const CARD = 'rounded-xl bg-surface p-xl shadow-md';

export function FutureScreen({ vm, links, Link, goal }: FutureScreenProps) {
  const f = t.future;
  const loading = vm.status === 'loading';
  const failed = vm.status === 'error' && vm.error !== null;
  const shown = !loading && !failed;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <Stack gap="3xl">
        <section className="grid gap-2xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <Stack gap="xl" className="min-w-0">
            <h1>
              <Sticker tone="ink" tilt={-3} className="text-sm">
                {vm.horizonReady ? f.title(vm.horizonYears) : f.titleNeutral}
              </Sticker>
            </h1>
            <HorizonPicker vm={vm} />
            {loading ? (
              <div className={CARD}>
                <Skeleton lines={5} />
              </div>
            ) : failed && vm.error ? (
              <div className={CARD}>
                <h2 className="text-xl font-bold">{f.errorTitle}</h2>
                <ErrorNote error={vm.error} className="mt-sm" />
              </div>
            ) : (
              <Headline vm={vm} />
            )}
            {goal}
          </Stack>

          {/* Decoration: the house and its sticker repeat the headline number, nothing new. */}
          <div className="relative mx-auto w-full max-w-(--container-md) pt-2xl">
            <Art name="house-build" />
            {shown && (
              <Sticker tone="primary" tilt={6} className="absolute top-0 right-0 text-base">
                {f.artSticker(formatMoney(vm.atHorizon.mid, { compact: true }), vm.horizonYears)}
              </Sticker>
            )}
          </div>
        </section>

        {shown && <ChartCard vm={vm} links={links} Link={Link} />}

        <NextMoves vm={vm} explanations={vm.explanations} onExplain={vm.explain} loading={loading} />

        <div className="flex flex-col gap-xl lg:flex-row lg:items-start">
          <HowWeCalculate vm={vm.howWeCalculate} source={vm.source} className="lg:flex-1" />
          <Link href={links.today} className={cx(buttonClassName({ variant: 'secondary', size: 'lg' }), 'lg:min-w-sm')}>
            {f.backCta}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Stack>
    </main>
  );
}

/**
 * The year the headline, chart and moves are read at, under the title and above the headline number.
 * The kit's Choice has string values: the years go in and out as strings here.
 */
function HorizonPicker({ vm }: { vm: FutureVM }) {
  const options = vm.horizons.map((years) => ({ value: String(years), label: yearsPhrase(years) }));
  return (
    <Choice
      legend={t.future.horizonLabel}
      name="horizon"
      // Until the saved year is in, the picker keeps its place (no jump) with no year chosen.
      value={vm.horizonReady ? String(vm.horizonYears) : ''}
      disabled={!vm.horizonReady}
      options={options}
      onChange={(value) => {
        const years = vm.horizons.find((y) => String(y) === value);
        if (years !== undefined) vm.setHorizonYears(years);
      }}
    />
  );
}

function Headline({ vm }: { vm: FutureVM }) {
  const f = t.future;
  const dollarsNote = vm.todaysDollars ? t.todaysDollarsNote : t.futureDollarsNote;
  return (
    <div data-testid="at-horizon">
      <div className="flex flex-wrap items-center gap-sm">
        <span className={EYEBROW}>{f.headline(vm.horizonYears)}</span>
        {!vm.band.isZero && <EstimateTag />}
      </div>
      <p className="mt-sm font-display text-7xl font-extrabold leading-display tracking-tight tabular-nums break-words sm:text-8xl lg:text-9xl">
        <Money value={vm.atHorizon.mid} />
      </p>
      <div className="mt-md flex flex-wrap items-baseline gap-x-sm text-xl text-text-muted">
        <RangeText point={vm.atHorizon} isZero={vm.band.isZero} className="text-xl" />
        {!vm.band.isZero && <span aria-hidden="true">·</span>}
        <span className="tabular-nums">{f.todayInline(formatMoney(vm.today.mid))}</span>
      </div>
      <div className="mt-sm flex flex-wrap items-center gap-sm text-sm">
        <SourceTag source={vm.source} />
        <span className="text-text-muted">{dollarsNote}</span>
        <a href={`#${HOW_WE_CALCULATE_ID}`} className="font-semibold text-primary hover:underline">
          {f.howLink} <span aria-hidden="true">→</span>
        </a>
      </div>
      <p aria-live="polite" className="mt-xs text-sm text-text-muted" data-testid="forecast-refreshing">
        {vm.isRefreshing ? f.refreshing : null}
      </p>
      {(vm.committedPreview || vm.withMove) && (
        <div className="mt-md flex flex-wrap gap-x-xl gap-y-sm text-base">
          {vm.committedPreview && (
            <span data-testid="committed-preview">
              <span className="text-text-muted">{f.committedAt}: </span>
              <Money value={vm.committedPreview.point.mid} className="font-bold text-positive" />
            </span>
          )}
          {vm.withMove && !vm.committedPreview && (
            <span>
              <span className="text-text-muted">{f.withMoveAt}: </span>
              <Money value={vm.withMove.point.mid} className="font-bold text-primary" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ vm, links, Link }: { vm: FutureVM; links: FutureScreenProps['links']; Link: LinkComponent }) {
  const f = t.future;
  const compareTitle = vm.compareMove ? moveTitle(vm.compareMove) : '';
  const band = bandText(vm.band.kind, vm.band.isZero);
  return (
    <section className={CARD}>
      <div className="mb-md flex flex-col gap-x-xl sm:flex-row sm:flex-wrap">
        <Toggle checked={vm.todaysDollars} onChange={vm.setTodaysDollars}>
          {f.todaysDollarsToggle}
        </Toggle>
        {vm.compareMove && (
          <Toggle checked={vm.compareOn} onChange={vm.setCompareOn}>
            {f.compareToggle(compareTitle)}
          </Toggle>
        )}
      </div>
      <ForecastChart
        title={f.chartTitle(vm.horizonYears)}
        series={{ label: f.seriesLabel, points: vm.points }}
        compare={vm.withMove ? { label: f.withMoveLabel(compareTitle), points: vm.withMove.points } : undefined}
        showBand={!vm.band.isZero}
        bandLabel={band.label}
      />
      {/* The band's label stays visible as the summary; what it means opens on tap. */}
      <details className="group mt-md rounded-md bg-surface-strong p-md text-sm" data-testid="band-note">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-semibold">
          <span>{band.label}</span>
          <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <p className="mt-xs text-text-muted">{band.text}</p>
        {!vm.band.isZero && vm.band.estimatedFields.length > 0 && (
          <>
            <h3 className="mt-md text-xs font-semibold uppercase tracking-wide text-text-muted">{t.band.estimatedTitle}</h3>
            <ul className="mt-xs flex flex-wrap gap-xs">
              {vm.band.estimatedFields.map((field, i) => (
                <li key={i} className="rounded-full border border-dashed border-text-muted px-sm text-xs">
                  {estimatedFieldLabel(field)}
                </li>
              ))}
            </ul>
            <Link href={links.makeExact} className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'mt-md')}>
              {t.band.makeExact}
            </Link>
          </>
        )}
      </details>
    </section>
  );
}
