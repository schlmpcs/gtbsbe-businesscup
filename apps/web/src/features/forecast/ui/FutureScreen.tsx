// S10 You in 10 years + Next Moves: the headline number with its range, the forecast chart with the
// range band, a comparison with a move, the ranked moves and "How we calculate".
import { forecast as t } from '@/copy';
import { buttonClassName, Card, cx, ForecastChart, Money, Stack, Stat } from '@/ui-kit';
import type { FutureVM } from '../model/types';
import { HowWeCalculate } from './HowWeCalculate';
import { NextMoves } from './NextMoves';
import {
  bandText, ErrorNote, estimatedFieldLabel, moveTitle, RangeText, Skeleton, SourceTag, Toggle, type LinkComponent,
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
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <header>
          <h1 className="text-3xl font-semibold leading-tight">{f.title}</h1>
          <p className="mt-xs text-text-muted">{f.intro}</p>
        </header>

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

        <HowWeCalculate vm={vm.howWeCalculate} source={vm.source} />

        <Link href={links.today} className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'self-start')}>
          {t.screens.S1}
        </Link>
      </Stack>
    </main>
  );
}

function Forecast({ vm, links, Link }: FutureScreenProps) {
  const f = t.future;
  const dollarsNote = vm.todaysDollars ? t.todaysDollarsNote : t.futureDollarsNote;
  const compareTitle = vm.compareMove ? moveTitle(vm.compareMove) : '';
  const band = bandText(vm.band.kind, vm.band.isZero);
  return (
    <Stack gap="lg">
      <Card data-testid="in10y">
        <Stat
          label={f.headline}
          value={<Money value={vm.in10y.mid} />}
          size="display"
          isEstimate={!vm.band.isZero}
        />
        <RangeText point={vm.in10y} isZero={vm.band.isZero} className="mt-xs" />
        <SourceTag source={vm.source} className="mt-xs" />
        <p className="mt-xs text-xs text-text-muted">{dollarsNote}</p>
        <p aria-live="polite" className="mt-xs text-xs text-text-muted" data-testid="forecast-refreshing">
          {vm.isRefreshing ? f.refreshing : null}
        </p>
        <div className="mt-md flex flex-wrap gap-x-xl gap-y-sm border-t border-border pt-md text-sm">
          <span>
            <span className="text-text-muted">{f.todayLabel}: </span>
            <Money value={vm.today.mid} className="font-semibold" />
          </span>
          {vm.committedPreview && (
            <span data-testid="committed-preview">
              <span className="text-text-muted">{f.committedIn10y}: </span>
              <Money value={vm.committedPreview.in10y.mid} className="font-semibold text-positive" />
            </span>
          )}
          {vm.withMove && !vm.committedPreview && (
            <span>
              <span className="text-text-muted">{f.withMoveIn10y}: </span>
              <Money value={vm.withMove.in10y.mid} className="font-semibold text-positive" />
            </span>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-md flex flex-col">
          <Toggle checked={vm.todaysDollars} onChange={vm.setTodaysDollars}>
            {f.todaysDollarsToggle}
          </Toggle>
          {vm.compareMove && (
            <Toggle checked={vm.compareOn} onChange={vm.setCompareOn}>
              {f.compareToggle(compareTitle)}
              <span className="block text-xs text-text-muted">
                {vm.compareMove.isCommitted ? f.compareCommittedNote : f.compareTopNote}
              </span>
            </Toggle>
          )}
        </div>
        <ForecastChart
          title={f.chartTitle}
          series={{ label: f.seriesLabel, points: vm.points }}
          compare={vm.withMove ? { label: f.withMoveLabel(compareTitle), points: vm.withMove.points } : undefined}
          showBand={!vm.band.isZero}
        />
        <div className="mt-md rounded-md bg-surface p-md text-sm" data-testid="band-note">
          <p className="font-semibold">{band.label}</p>
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
        </div>
      </Card>
    </Stack>
  );
}
