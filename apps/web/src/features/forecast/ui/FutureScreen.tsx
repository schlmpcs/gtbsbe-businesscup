// S10 You in N years + Next Moves: the year picker, the headline number with its range, the forecast
// chart with the range band, a comparison with a move, the ranked moves and "How we calculate".
import { forecast as t, yearsPhrase } from '@/copy';
import { Art, buttonClassName, Card, Choice, cx, EstimateTag, ForecastChart, Money, Stack, Sticker } from '@/ui-kit';
import type { FutureVM } from '../model/types';
import { HowWeCalculate } from './HowWeCalculate';
import { NextMoves } from './NextMoves';
import {
  bandText,
  ErrorNote,
  estimatedFieldLabel,
  FULL_BLEED_PRIMARY,
  moveTitle,
  ON_ARENA,
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
};

export function FutureScreen({ vm, links, Link }: FutureScreenProps) {
  const f = t.future;
  const loading = vm.status === 'loading';
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg pb-xl">
      <Stack gap="3xl">
        {/* Orange hero band, full width on every screen size. */}
        <div className={cx(FULL_BLEED_PRIMARY, 'py-2xl sm:py-3xl')}>
          <header className={cx(ON_ARENA, 'mb-xl')}>
            <h1 className="text-sm font-bold uppercase tracking-wide">{vm.horizonReady ? f.title(vm.horizonYears) : f.titleNeutral}</h1>
          </header>

          {vm.horizonReady && <HorizonPicker vm={vm} />}

          {loading ? (
            <Card>
              <Skeleton lines={5} />
            </Card>
          ) : vm.status === 'error' && vm.error ? (
            <Card title={f.errorTitle} className="text-text">
              <ErrorNote error={vm.error} />
            </Card>
          ) : (
            <Forecast vm={vm} links={links} Link={Link} />
          )}
        </div>

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
 * The year the headline, chart and moves are read at. A white tile on the orange hero, so the segments
 * and their focus ring keep the colors they have everywhere else (white text on orange would hide the
 * unchosen ones). The kit's Choice has string values: the years go in and out as strings here.
 */
function HorizonPicker({ vm }: { vm: FutureVM }) {
  const options = vm.horizons.map((years) => ({ value: String(years), label: yearsPhrase(years) }));
  return (
    <Card className="mb-xl w-fit max-w-full text-text">
      <Choice
        legend={t.future.horizonLabel}
        name="horizon"
        value={String(vm.horizonYears)}
        options={options}
        onChange={(value) => {
          const years = vm.horizons.find((y) => String(y) === value);
          if (years !== undefined) vm.setHorizonYears(years);
        }}
      />
    </Card>
  );
}

function Forecast({ vm, links, Link }: FutureScreenProps) {
  const f = t.future;
  const dollarsNote = vm.todaysDollars ? t.todaysDollarsNote : t.futureDollarsNote;
  const compareTitle = vm.compareMove ? moveTitle(vm.compareMove) : '';
  const band = bandText(vm.band.kind, vm.band.isZero);
  return (
    <div className="grid gap-2xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <Stack gap="xl" className="min-w-0">
        <div data-testid="at-horizon" className={ON_ARENA}>
          <div className="flex flex-wrap items-center gap-sm text-sm font-bold uppercase tracking-wide">
            <span>{f.headline(vm.horizonYears)}</span>
            {!vm.band.isZero && <EstimateTag className="normal-case" />}
          </div>
          <p className="mt-sm font-display text-display leading-display font-extrabold tabular-nums break-words sm:text-8xl sm:leading-display">
            <Money value={vm.atHorizon.mid} />
          </p>
          <RangeText point={vm.atHorizon} isZero={vm.band.isZero} className="mt-md text-lg" />
          <SourceTag source={vm.source} className="mt-xs border-on-primary/40" />
          <p className="mt-xs text-sm text-text-muted">{dollarsNote}</p>
          <p aria-live="polite" className="mt-xs text-sm text-text-muted" data-testid="forecast-refreshing">
            {vm.isRefreshing ? f.refreshing : null}
          </p>
          <div className="mt-lg flex flex-wrap gap-x-xl gap-y-sm border-t border-on-primary/40 pt-md text-base">
            <span>
              <span className="text-text-muted">{f.todayLabel}: </span>
              <Money value={vm.today.mid} className="font-bold" />
            </span>
            {vm.committedPreview && (
              <span data-testid="committed-preview">
                <span className="text-text-muted">{f.committedAt}: </span>
                <Money value={vm.committedPreview.point.mid} className="font-bold" />
              </span>
            )}
            {vm.withMove && !vm.committedPreview && (
              <span>
                <span className="text-text-muted">{f.withMoveAt}: </span>
                <Money value={vm.withMove.point.mid} className="font-bold" />
              </span>
            )}
          </div>
        </div>

        <Card className="text-text">
          <div className="mb-md flex flex-col">
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
        </Card>
      </Stack>

      {/* Decoration only: the illustration and its sticker carry no number. */}
      <div className="relative mx-auto w-full max-w-(--container-md) pb-xl lg:mt-3xl">
        <Art name="future" framed tilt={3} />
        <Sticker tone="ink" tilt={4} className="absolute bottom-0 left-md text-sm shadow-lg">
          {f.artSticker}
        </Sticker>
      </div>
    </div>
  );
}
