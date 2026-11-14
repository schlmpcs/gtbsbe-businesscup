// S10 You in N years + Next Moves (JF14/JF16): one message (the headline number and a plain "why" line)
// and one action (see the ranked moves). The goal, the chart with its range band, "Coming up" and
// "How we calculate" sit behind disclosures.
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
  links: { makeExact: string };
  Link: LinkComponent;
  /** The goal card (its own view-model), placed under the headline number when the route passes it. */
  goal?: ReactNode;
  /** The "Coming up" life events card (its own view-model), placed under the forecast chart when the route passes it. */
  events?: ReactNode;
};

const CARD = 'rounded-xl bg-surface p-xl shadow-md';
const MOVES_ID = 'next-moves';

/** A secondary panel, closed by default (JF16: one main message, one main action per screen). */
function Disclosure({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl bg-surface p-lg shadow-md" data-testid={testId}>
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-display text-xl font-extrabold"
        data-testid={testId && `${testId}-summary`}
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-md">{children}</div>
    </details>
  );
}

/** JF14: why the headline is what it is, in one plain sentence (engine numbers, formatted here). */
function whyText(why: NonNullable<FutureVM['why']>): string {
  const f = t.future;
  const take = formatMoney(why.takeHome);
  const out = formatMoney(why.outflow);
  const gap = why.takeHome - why.outflow;
  if (Math.abs(gap) < 1) return f.whyEven(take);
  if (gap > 0) return f.whyLeft(take, out, formatMoney(gap));
  return f.whyShort(take, out, formatMoney(-gap)) + (why.cashOutMonth !== null ? f.cashRunsOut(why.cashOutMonth) : '');
}

export function FutureScreen({ vm, links, Link, goal, events }: FutureScreenProps) {
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
              <Headline vm={vm} links={links} Link={Link} />
            )}
            {shown && (
              <a href={`#${MOVES_ID}`} className={cx(buttonClassName({ variant: 'primary' }), 'self-start')}>
                {f.seeMoves} <span aria-hidden="true">→</span>
              </a>
            )}
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

        <div id={MOVES_ID} className="scroll-mt-xl">
          <NextMoves vm={vm} explanations={vm.explanations} onExplain={vm.explain} loading={loading} />
        </div>

        {goal && <Disclosure title={f.goalDisclosure} testId="goal-disclosure">{goal}</Disclosure>}

        {shown && (
          <Disclosure title={f.chartDisclosure} testId="chart-disclosure">
            <ChartCard vm={vm} links={links} Link={Link} />
          </Disclosure>
        )}

        {events && <Disclosure title={f.eventsDisclosure} testId="events-disclosure">{events}</Disclosure>}

        <HowWeCalculate vm={vm.howWeCalculate} source={vm.source} />
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

function Headline({ vm, links, Link }: { vm: FutureVM; links: FutureScreenProps['links']; Link: LinkComponent }) {
  const f = t.future;
  const dollarsNote = vm.todaysDollars ? t.todaysDollarsNote : t.futureDollarsNote;
  return (
    <div data-testid="at-horizon">
      <div className="flex flex-wrap items-center gap-sm">
        <span className={EYEBROW}>{f.headline(vm.horizonYears)}</span>
        {/* "Estimate" only when an input behind the number is one (the source tag below says who made it). */}
        {vm.band.estimatedFields.length > 0 && <EstimateTag />}
      </div>
      <p className="mt-sm font-display text-7xl font-extrabold leading-display tracking-tight tabular-nums break-words sm:text-8xl lg:text-9xl">
        <Money value={vm.atHorizon.mid} />
      </p>
      <div className="mt-md flex flex-wrap items-baseline gap-x-sm text-xl text-text-muted">
        {/* Not a probability band: it says what it is (the estimated inputs, or the AI model's own range). */}
        <RangeText point={vm.atHorizon} isZero={vm.band.isZero} kind={vm.band.kind} className="text-xl" />
        {!vm.band.isZero && <span aria-hidden="true">·</span>}
        <span className="tabular-nums">{f.todayInline(formatMoney(vm.today.mid))}</span>
      </div>
      {!vm.band.isZero && vm.band.kind === 'inputs' && vm.band.estimatedFields.length > 0 && (
        <Link href={links.makeExact} className="mt-xs inline-block text-sm font-semibold text-primary hover:underline">
          {t.narrowRange} <span aria-hidden="true">→</span>
        </Link>
      )}
      {vm.why && (
        <p className="mt-md max-w-prose text-lg font-semibold" data-testid="future-why">
          {whyText(vm.why)}
        </p>
      )}
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
    <section>
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
