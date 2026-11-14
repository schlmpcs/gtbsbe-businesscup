// S10 You in 10 years + Next Moves: "Your number" (rules forecast) with today and the goal, the goal
// card, the forecast chart with its range band and source, a comparison with a move, the ranked moves
// and "How we calculate".
import { forecast as t } from '@/copy';
import { Art, buttonClassName, Card, cx, EstimateTag, ForecastChart, Money, Stack, Sticker } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { FutureVM, NumberHeroVM } from '../model/types';
import { HowWeCalculate } from './HowWeCalculate';
import { NextMoves } from './NextMoves';
import { NumberHero } from './YourNumber';
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
  /** "Your number": the rules forecast and the goal, on the orange band. */
  hero: NumberHeroVM;
  /** The goal card (set / edit, or the Pro lock), rendered under the hero's band. */
  goal?: ReactNode;
  links: { today: string; makeExact: string };
  Link: LinkComponent;
};

export function FutureScreen({ vm, hero, goal, links, Link }: FutureScreenProps) {
  const f = t.future;
  const loading = vm.status === 'loading';
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg pb-xl">
      <Stack gap="3xl">
        {/* Orange hero band, full width on every screen size: the number, today, the goal. */}
        <div className={cx(FULL_BLEED_PRIMARY, ON_ARENA, 'py-2xl sm:py-3xl')}>
          <div className="grid gap-2xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-center">
            <div className="flex min-w-0 flex-col gap-lg">
              <h1 className="text-xl font-bold">{f.title}</h1>
              <NumberHero vm={hero} />
            </div>
            {/* Decoration only: the illustration and its sticker carry no number. */}
            <div className="relative mx-auto hidden w-full max-w-(--container-sm) pb-xl lg:block">
              <Art name="future" framed tilt={3} />
              <Sticker tone="ink" tilt={4} className="absolute bottom-0 left-md text-sm shadow-lg">
                {f.artSticker}
              </Sticker>
            </div>
          </div>
        </div>

        {goal}

        {loading ? (
          <Card>
            <Skeleton lines={5} />
          </Card>
        ) : vm.status === 'error' && vm.error ? (
          <Card title={f.errorTitle}>
            <ErrorNote error={vm.error} />
          </Card>
        ) : (
          <Forecast vm={vm} links={links} Link={Link} />
        )}

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
 * The chart and the forecast it draws (the AI answer when there is one, else the rules forecast; the
 * tag says which), with the dollars toggle, the comparison with a move and what the band means.
 */
function Forecast({ vm, links, Link }: Pick<FutureScreenProps, 'vm' | 'links' | 'Link'>) {
  const f = t.future;
  const dollarsNote = vm.todaysDollars ? t.todaysDollarsNote : t.futureDollarsNote;
  const compareTitle = vm.compareMove ? moveTitle(vm.compareMove) : '';
  const band = bandText(vm.band.kind, vm.band.isZero);
  return (
    <Card className="flex flex-col gap-lg">
      <div data-testid="in10y" className="flex flex-col gap-xs">
        <div className="flex flex-wrap items-center gap-sm text-sm text-text-muted">
          <span>{f.headline}</span>
          {!vm.band.isZero && <EstimateTag />}
          <SourceTag source={vm.source} />
        </div>
        <p className="font-display text-4xl font-extrabold leading-tight tabular-nums">
          <Money value={vm.in10y.mid} />
        </p>
        <RangeText point={vm.in10y} isZero={vm.band.isZero} />
        <p className="text-sm text-text-muted">{dollarsNote}</p>
        <p aria-live="polite" className="text-sm text-text-muted" data-testid="forecast-refreshing">
          {vm.isRefreshing ? f.refreshing : null}
        </p>
        <div className="flex flex-wrap gap-x-xl gap-y-sm text-sm">
          <span>
            <span className="text-text-muted">{f.todayLabel}: </span>
            <Money value={vm.today.mid} className="font-bold" />
          </span>
          {vm.committedPreview && (
            <span data-testid="committed-preview">
              <span className="text-text-muted">{f.committedIn10y}: </span>
              <Money value={vm.committedPreview.in10y.mid} className="font-bold" />
            </span>
          )}
          {vm.withMove && !vm.committedPreview && (
            <span>
              <span className="text-text-muted">{f.withMoveIn10y}: </span>
              <Money value={vm.withMove.in10y.mid} className="font-bold" />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col">
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
        title={f.chartTitle}
        series={{ label: f.seriesLabel, points: vm.points }}
        compare={vm.withMove ? { label: f.withMoveLabel(compareTitle), points: vm.withMove.points } : undefined}
        showBand={!vm.band.isZero}
        bandLabel={band.label}
      />
      {/* The band's label stays visible as the summary; what it means opens on tap. */}
      <details className="group rounded-md bg-surface-strong p-md text-sm" data-testid="band-note">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-semibold">
          <span>{band.label}</span>
          <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <p className="mt-xs text-text-muted">{band.text}</p>
        {!vm.band.isZero && vm.band.estimatedFields.length > 0 && (
          <>
            <h3 className="mt-md text-xs font-semibold text-text-muted">{t.band.estimatedTitle}</h3>
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
  );
}
