// S1 Today: the daily game hero, You in 10 years, the move to make, this month and the planning tools.
// Presentational: everything comes from TodayVM; links come from the route page.
import { common, forecast as t, screenTitles, type ScreenId } from '@/copy';
import {
  Art,
  Button,
  buttonClassName,
  cx,
  EstimateTag,
  formatMoney,
  formatMonth,
  Money,
  Stack,
  Sticker,
  type ArtName,
} from '@/ui-kit';
import type { MonthEndVM, MoveVM, TodayHomeVM, TodayVM } from '../model/types';
import {
  bandText,
  ErrorNote,
  EYEBROW,
  INK_BAND,
  moveDetail,
  moveTitle,
  ON_INK_BUTTON,
  RangeText,
  Skeleton,
  SourceTag,
  tilt,
  type LinkComponent,
} from './shared';

export type TodayLinks = {
  play: string;
  /** "Try with sample data": S10 with the sample life loaded. */
  sample: string;
  future: string;
  afford: string;
  loan: string;
  decide: string;
  checkin: string;
  /** Start of "build your profile" (S5 Guess yourself). */
  profile: string;
  upload: string;
};

export type TodayScreenProps = {
  vm: TodayVM;
  links: TodayLinks;
  /**
   * Every screen the app links to, for the compact "All screens" list (judges can reach each one).
   * `title` overrides the screen's default title (S2/S3 when /play is the duel).
   */
  screens: { id: ScreenId; href: string; title?: string }[];
  Link: LinkComponent;
};

const CARD = 'rounded-xl bg-surface p-xl shadow-md';

export function TodayScreen({ vm, links, screens, Link }: TodayScreenProps) {
  if (vm.firstVisit) return <FirstVisit links={links} screens={screens} Link={Link} />;
  const ready = vm.status === 'ready';
  const firstVisit = !ready || (vm.game.played === 0 && !vm.game.finished);
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <Stack gap="3xl">
        <Hero vm={vm} links={links} Link={Link} />

        {firstVisit && <Steps items={vm.game.kind === 'duel' ? t.today.duel.steps : t.today.steps.items} />}

        {ready && vm.game.homes.length > 0 && <HomesRow homes={vm.game.homes} />}

        {ready && vm.isDemoProfile && !vm.isSample && (
          <div
            data-testid="sample-note"
            className="flex flex-wrap items-center justify-between gap-md rounded-xl bg-primary-soft px-xl py-lg"
          >
            <p className="text-sm font-semibold">{t.sampleProfile}</p>
            <Link href={links.profile} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              {t.today.tools.profile.title}
            </Link>
          </div>
        )}

        <div className="grid items-stretch gap-xl lg:grid-cols-12">
          <In10yCard vm={vm} futureHref={links.future} Link={Link} />
          <MoveCard vm={vm} futureHref={links.future} Link={Link} />
        </div>

        <section aria-labelledby="month-end-heading" data-testid="month-end" className={cx(INK_BAND, 'p-xl sm:p-2xl')}>
          <h2 id="month-end-heading" className="text-xs font-bold uppercase tracking-wide text-primary">
            {t.today.monthEnd.title}
          </h2>
          <div className="mt-md">
            {!ready || vm.monthEnd.status === 'loading' ? (
              <Skeleton />
            ) : vm.monthEnd.status === 'error' ? (
              <ErrorNote error={vm.monthEnd.error} />
            ) : (
              <MonthEnd data={vm.monthEnd.data} uploadHref={links.upload} Link={Link} />
            )}
          </div>
        </section>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="font-display text-4xl font-extrabold leading-tight tracking-tight">
            {t.today.tools.title}
          </h2>
          <ul className="mt-lg grid grid-cols-2 gap-lg sm:grid-cols-3 lg:grid-cols-5">
            <ToolLink href={links.afford} art="afford-crane" {...t.today.tools.afford} Link={Link} />
            <ToolLink href={links.loan} art="house-crane" {...t.today.tools.loan} Link={Link} />
            <ToolLink href={links.decide} art="coins" {...t.today.tools.decide} Link={Link} />
            <ToolLink href={links.checkin} art="calendar" {...t.today.tools.checkin} Link={Link} />
            <ToolLink
              href={links.profile}
              art="house-blueprint"
              {...(ready && !vm.isDemoProfile ? t.today.tools.profileEdit : t.today.tools.profile)}
              Link={Link}
            />
          </ul>
        </section>

        <AllScreens screens={screens} Link={Link} />
      </Stack>
    </main>
  );
}

/** The game hero: first visit / in progress (play), or done for today (price your own month). */
function Hero({ vm, links, Link }: { vm: TodayVM; links: TodayLinks; Link: LinkComponent }) {
  const ready = vm.status === 'ready';
  const { played, total, finished } = vm.game;
  const done = ready && finished;
  const inProgress = ready && played > 0 && !finished;
  // The duel counts rounds ("today's five"), the slider game homes.
  const duel = vm.game.kind === 'duel';
  const p = duel ? t.today.playDuel : t.today.play;

  return (
    <section data-testid="play" className="grid items-center gap-2xl lg:grid-cols-2">
      <div className="flex min-w-0 flex-col items-start gap-lg">
        {done ? (
          <>
            <Sticker tone="positive" tilt={-3} className="text-sm">
              {p.doneSticker}
            </Sticker>
            <h1 className="font-display text-7xl font-extrabold leading-display tracking-tight tabular-nums sm:text-8xl lg:text-9xl">
              {p.doneScore(played, total)}
            </h1>
            <p className="max-w-(--container-lg) text-xl">{p.done}</p>
            <div className="flex flex-wrap items-center gap-md">
              <Link href={links.profile} className={buttonClassName({ variant: 'primary', size: 'lg' })}>
                {vm.isDemoProfile ? p.priceOwn : t.today.tools.profileEdit.title}
                <span aria-hidden="true">→</span>
              </Link>
              <Link href={links.play} className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
                {p.doneCta}
              </Link>
            </div>
          </>
        ) : (
          <>
            <Sticker tone={inProgress ? 'primary' : 'ink'} tilt={-3}>
              {inProgress ? t.today.inProgress : t.today.kicker}
            </Sticker>
            <h1 className="font-display text-6xl font-extrabold leading-display tracking-tight sm:text-7xl xl:text-8xl">
              {duel ? t.today.duel.title : t.today.title}
            </h1>
            <p className="max-w-(--container-lg) text-xl">{duel ? t.today.duel.lead : t.today.lead}</p>
            <div className="flex w-full flex-wrap items-center gap-md">
              <Link
                href={links.play}
                className={cx(buttonClassName({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}
              >
                {inProgress ? p.continue(played, total) : p.cta}
                <span aria-hidden="true">→</span>
              </Link>
              {ready && vm.isDemoProfile && (
                <Link
                  href={links.sample}
                  className={cx(buttonClassName({ variant: 'secondary', size: 'lg' }), 'w-full sm:w-auto')}
                >
                  {t.today.sampleCta}
                </Link>
              )}
            </div>
            <p className="text-sm text-text-muted">{t.today.note}</p>
          </>
        )}
      </div>
      {/* Decoration only: the art carries no number or cost fact. */}
      <Art name={done ? 'empty-plot' : 'duel-houses'} className="mx-auto w-full max-w-(--container-xl)" />
    </section>
  );
}

const STEP_ART: ArtName[] = ['step-duels', 'step-month', 'step-future'];

function Steps({
  items = t.today.steps.items,
  label = t.today.steps.label,
}: {
  items?: readonly string[];
  label?: string;
}) {
  return (
    <ol aria-label={label} className="grid gap-xl sm:grid-cols-3">
      {items.map((title, i) => (
        <li
          key={title}
          // The arrow between steps is a CSS pseudo-element, so it stays out of the step's text.
          className="relative flex flex-col items-center gap-sm text-center sm:after:absolute sm:after:top-xl sm:after:-right-lg sm:after:text-2xl sm:after:text-text-muted sm:after:content-['→'] sm:last:after:content-none"
        >
          <div className="flex items-center gap-md">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-primary-soft font-display text-lg font-extrabold text-primary"
            >
              {i + 1}
            </span>
            <Art name={STEP_ART[i]!} className="flex h-24 w-24 items-center" />
          </div>
          <p className="text-xl font-bold">{title}</p>
        </li>
      ))}
    </ol>
  );
}

// Decorative art for the home tiles, in play order (the illustrations carry no facts about the card).
const HOME_ART: ArtName[] = ['home-apartment', 'home-family', 'home-suburb', 'home-large'];
const HOME_TILT = [-2, 1, -1, 2, -1, 1];

/** Today's homes as tiles: where each one is, and which you already guessed. No prices before a guess. */
function HomesRow({ homes }: { homes: TodayHomeVM[] }) {
  const h = t.today.homes;
  const next = homes.findIndex((home) => !home.played);
  return (
    <section aria-label={h.label}>
      <ol className="grid grid-cols-2 gap-lg sm:grid-cols-3 lg:grid-cols-5">
        {homes.map((home, i) => {
          const isNext = i === next;
          return (
            <li key={home.id} className="relative pt-md" style={tilt(HOME_TILT[i % HOME_TILT.length]!)}>
              {isNext && (
                <Sticker tone="primary" tilt={-6} className="absolute top-0 right-md z-10">
                  {h.start}
                </Sticker>
              )}
              <div
                className={cx(
                  'flex h-full flex-col gap-sm rounded-xl bg-surface p-md shadow-md',
                  isNext && 'ring-2 ring-primary',
                )}
              >
                <Art name={HOME_ART[i % HOME_ART.length]!} className="mx-auto w-4/5" />
                <div className="px-xs pb-xs">
                  <p className={EYEBROW}>{h.home(i + 1)}</p>
                  <p className="font-display text-lg font-extrabold leading-tight">{home.metro}</p>
                  {home.played ? (
                    <Sticker tone="positive" className="mt-xs">
                      {h.played}
                    </Sticker>
                  ) : (
                    <p
                      className={cx(
                        'font-display text-2xl font-extrabold leading-tight',
                        isNext ? 'text-primary' : 'text-border',
                      )}
                    >
                      <span aria-hidden="true">{h.hidden}</span>
                      <span className="sr-only">{h.hiddenLabel}</span>
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function In10yCard({ vm, futureHref, Link }: { vm: TodayVM; futureHref: string; Link: LinkComponent }) {
  const ready = vm.status === 'ready';
  return (
    <section
      aria-labelledby="in10y-heading"
      data-testid="in10y"
      className={cx(CARD, 'flex flex-col gap-lg sm:flex-row sm:items-center lg:col-span-7')}
    >
      <div className="min-w-0 flex-1">
        <h2 id="in10y-heading" className="font-display text-2xl font-extrabold leading-tight">
          {t.today.future.title}
        </h2>
        <div className="mt-md">
          {!ready || vm.forecastStatus === 'loading' ? (
            <Skeleton />
          ) : vm.forecastStatus === 'error' && vm.forecastError ? (
            <ErrorNote error={vm.forecastError} />
          ) : (
            <Stack gap="sm">
              <div className="flex flex-wrap items-center gap-sm">
                <span className={EYEBROW}>{t.netWorthIn10y}</span>
                {!vm.in10yBandIsZero && <EstimateTag />}
              </div>
              <p className="font-display text-6xl font-extrabold leading-display tracking-tight break-words sm:text-7xl">
                <Money value={vm.in10y.mid} />
              </p>
              <p className="text-sm text-text-muted">{t.today.future.hint}</p>
              <RangeText point={vm.in10y} isZero={vm.in10yBandIsZero} className="text-base" />
              <div className="flex flex-wrap items-center gap-sm">
                <SourceTag source={vm.source} />
                {!vm.in10yBandIsZero && (
                  <span className="text-xs text-text-muted">{bandText(vm.in10yBandKind, false).label}</span>
                )}
                <span aria-live="polite" className="text-xs text-text-muted" data-testid="forecast-refreshing">
                  {vm.isRefreshing ? t.future.refreshing : null}
                </span>
              </div>
              <Link href={futureHref} className={cx(buttonClassName({ variant: 'secondary' }), 'mt-sm self-start')}>
                {t.today.future.cta}
                <span aria-hidden="true">→</span>
              </Link>
            </Stack>
          )}
        </div>
      </div>
      {/* Decoration only. */}
      <Art name="house-build" className="mx-auto w-48 shrink-0 sm:w-56" />
    </section>
  );
}

function MonthEnd({ data, uploadHref, Link }: { data: MonthEndVM; uploadHref: string; Link: LinkComponent }) {
  const m = t.today.monthEnd;
  const hint = data.fromStatement
    ? m.fromStatement(formatMonth(data.month, data.asOfDay ?? undefined))
    : data.historyMonths > 0
      ? m.noRowsThisMonth(formatMonth(data.month))
      : m.fromProfile;
  return (
    <div className="flex flex-col gap-xl lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap gap-x-3xl gap-y-lg">
        <div>
          <p className="font-display text-5xl font-extrabold leading-display tabular-nums">
            <Money value={data.projectedSpend} />
          </p>
          <p className="mt-xs text-sm text-text-muted">{m.projected}</p>
        </div>
        <div>
          <p className="font-display text-5xl font-extrabold leading-display tabular-nums">
            <Money value={data.takeHome.value} />
          </p>
          <p className="mt-xs flex flex-wrap items-center gap-xs text-sm text-text-muted">
            <span>{m.takeHome}</span>
            <span>{m.perMonth}</span>
            {data.takeHome.isEstimate && <EstimateTag className="border-on-primary/40" />}
          </p>
        </div>
      </div>

      <div className="flex max-w-(--container-md) flex-col items-start gap-sm">
        <p className="text-sm text-text-muted">{hint}</p>
        {data.vsAverage === null ? (
          <div
            className="flex flex-col items-start gap-sm"
            data-testid={data.noAverage === 'thisMonth' ? 'month-end-no-current' : 'month-end-no-history'}
          >
            <p className="text-sm">
              {data.noAverage === 'thisMonth' ? m.needThisMonth(formatMonth(data.month)) : m.needHistory(data.historyMonths)}
            </p>
            <Link href={uploadHref} className={ON_INK_BUTTON}>
              {m.upload}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div data-testid="month-end-drifts" className="flex flex-col gap-xs">
            <p className="font-semibold tabular-nums text-primary">{m.vsAverageValue(formatMoney(data.vsAverage, { signed: true }))}</p>
            <h3 className="mt-sm text-xs font-bold uppercase tracking-wide text-text-muted">{m.driftsTitle}</h3>
            {data.drifts.length === 0 ? (
              <p className="text-sm text-text-muted">{m.noDrifts}</p>
            ) : (
              <ul className="flex flex-wrap gap-xs text-sm">
                {data.drifts.map((d) => (
                  <li key={d.category} className="rounded-full bg-on-primary/10 px-md py-xs font-medium tabular-nums">
                    {m.drift(common.categories[d.category], formatMoney(d.delta, { signed: true }))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MoveCard({ vm, futureHref, Link }: { vm: TodayVM; futureHref: string; Link: LinkComponent }) {
  const committed = vm.committedMove;
  const title = committed ? t.today.move.committedTitle : t.today.move.topTitle;
  let body;
  if (vm.status !== 'ready') body = <Skeleton lines={2} />;
  else if (committed) body = <MoveSummary move={committed} onDone={vm.markCommittedDone} disabled={vm.actionsDisabled} />;
  else if (vm.topMove.status === 'loading') body = <Skeleton lines={2} />;
  else if (vm.topMove.status === 'error') body = <ErrorNote error={vm.topMove.error} />;
  else if (vm.topMove.data === null) body = <p className="text-sm text-text-muted">{t.today.move.none}</p>;
  else body = <MoveSummary move={vm.topMove.data} />;

  return (
    <section
      aria-labelledby="today-move-heading"
      data-testid="today-move"
      className={cx(
        CARD,
        'flex flex-col gap-md border-2 lg:col-span-5',
        committed ? 'border-positive' : 'border-transparent',
      )}
    >
      <div className="flex items-center justify-between gap-md">
        <h2 id="today-move-heading" className="font-display text-2xl font-extrabold leading-tight">
          {title}
        </h2>
        <Sticker tone={committed ? 'positive' : 'ink'} tilt={4}>
          {t.moves.rank(1)}
        </Sticker>
      </div>
      <div className="flex-1">{body}</div>
      <Link href={futureHref} className="self-start text-sm font-semibold text-primary hover:underline">
        {t.today.move.seeAll} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

function MoveSummary({ move, onDone, disabled = false }: { move: MoveVM; onDone?: () => void; disabled?: boolean }) {
  const detail = moveDetail(move);
  return (
    <Stack gap="sm">
      <p className="font-display text-4xl font-extrabold leading-display tracking-tight text-primary tabular-nums">
        {t.moves.effect(formatMoney(move.effect10y, { signed: true }))}
      </p>
      <SourceTag source={move.source} />
      <p className="text-lg font-bold">{moveTitle(move)}</p>
      {detail && <p className="text-sm text-text-muted">{detail}</p>}
      {onDone && (
        <Button variant="secondary" size="sm" className="mt-sm self-start" onClick={onDone} disabled={disabled}>
          {t.today.move.markDone}
        </Button>
      )}
    </Stack>
  );
}

function ToolLink({
  href,
  art,
  title,
  body,
  Link,
}: {
  href: string;
  art: ArtName;
  title: string;
  body: string;
  Link: LinkComponent;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-xs rounded-xl bg-surface p-lg shadow-md transition-transform hover:-translate-y-1"
      >
        <Art name={art} className="mx-auto mb-sm w-28" />
        <span className="text-lg font-bold leading-tight">{title}</span>
        <span className="text-sm text-text-muted">{body}</span>
      </Link>
    </li>
  );
}

/** First visit (no profile, no game yet): what the app is and the two ways in. No user numbers. */
function FirstVisit({ links, screens, Link }: Omit<TodayScreenProps, 'vm'>) {
  const f = t.today.firstVisit;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl" data-testid="today-first-visit">
      <Stack gap="3xl">
        <section data-testid="play" className="grid items-center gap-2xl lg:grid-cols-2">
          <div className="flex min-w-0 flex-col items-start gap-lg">
            <h1 className="font-display text-6xl font-extrabold leading-display tracking-tight sm:text-7xl xl:text-8xl">
              {f.title}
            </h1>
            <p className="max-w-(--container-lg) text-xl">{f.body}</p>
            <div className="flex w-full flex-wrap items-center gap-md">
              <Link href={links.play} className={cx(buttonClassName({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}>
                {f.play}
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href={links.sample}
                className={cx(buttonClassName({ variant: 'secondary', size: 'lg' }), 'w-full sm:w-auto')}
              >
                {f.sample}
              </Link>
            </div>
            <p className="text-sm text-text-muted">{f.note}</p>
          </div>
          {/* Decoration only: the art carries no number or cost fact. */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-(--container-xl)">
            <Art name="duel-houses" />
            <span className="absolute top-1/3 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold uppercase text-on-primary shadow-md">
              {f.vs}
            </span>
          </div>
        </section>
        <section aria-label={f.stepsLabel}>
          <Steps items={f.steps} label={f.stepsLabel} />
        </section>
        <AllScreens screens={screens} Link={Link} />
      </Stack>
    </main>
  );
}

/** Every screen, for the compact "All screens" list (judges can reach each one). */
function AllScreens({ screens, Link }: Pick<TodayScreenProps, 'screens' | 'Link'>) {
  return (
    <nav aria-label={t.today.allScreens}>
      <details>
        <summary className="min-h-11 cursor-pointer text-sm font-semibold uppercase tracking-wide text-text-muted">
          {t.today.allScreens}
        </summary>
        <ul className="mt-sm flex flex-wrap gap-xs">
          {screens.map(({ id, href, title }) => (
            <li key={id}>
              <Link
                href={href}
                data-screen={id}
                className="inline-flex items-baseline gap-xs rounded-full bg-surface px-md py-xs text-xs shadow-sm hover:bg-primary-soft"
              >
                <span className="font-mono text-text-muted">{id}</span>
                <span>{title ?? screenTitles[id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
