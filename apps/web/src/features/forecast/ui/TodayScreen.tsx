// S1 Today: You in 10 years, the daily game, this month, the move to make, and the planning tools.
// Presentational: everything comes from TodayVM; links come from the route page.
import { common, forecast as t, screenTitles, type ScreenId } from '@/copy';
import {
  Art,
  Button,
  buttonClassName,
  Card,
  cx,
  EstimateTag,
  formatMoney,
  Money,
  Scoreboard,
  Stack,
  Stat,
  Sticker,
  type ArtName,
  type ScoreboardItem,
} from '@/ui-kit';
import type { MonthEndVM, MoveVM, TodayHomeVM, TodayVM } from '../model/types';
import { ErrorNote, moveDetail, moveTitle, RangeText, Skeleton, tilt, type LinkComponent } from './shared';

export type TodayLinks = {
  play: string;
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
  /** Every screen, for the compact "All screens" list (judges can reach each one). */
  screens: { id: ScreenId; href: string }[];
  Link: LinkComponent;
};

export function TodayScreen({ vm, links, screens, Link }: TodayScreenProps) {
  const ready = vm.status === 'ready';
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <Stack gap="3xl">
        <header className="flex flex-col items-center gap-lg text-center">
          <div className="flex flex-wrap items-center justify-center gap-sm">
            <Sticker tone="ink">{t.today.kicker}</Sticker>
            <span className="text-sm text-text-muted">{t.today.kickerNote}</span>
          </div>
          <h1 className="font-display text-display leading-display font-extrabold sm:text-8xl sm:leading-display lg:text-9xl lg:leading-display">
            {t.today.title}
          </h1>
          <p className="max-w-(--container-xl) text-lg text-text-muted">{t.today.intro}</p>
        </header>

        {ready && vm.game.homes.length > 0 && <HomesRow homes={vm.game.homes} />}

        <PlayCard vm={vm} href={links.play} Link={Link} />

        {ready && <DayScore vm={vm} />}

        {ready && vm.isDemoProfile && (
          <Card tone="muted" data-testid="sample-note" className="flex flex-wrap items-center justify-between gap-md">
            <p className="text-sm">{t.sampleProfile}</p>
            <Link href={links.profile} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
              {t.today.tools.profile.title}
            </Link>
          </Card>
        )}

        <div className="grid items-start gap-xl lg:grid-cols-2">
          <Card title={t.today.future.title} data-testid="in10y" style={tilt(-1)}>
            {ready ? (
              <Stack gap="sm">
                <Stat
                  label={t.netWorthIn10y}
                  value={<Money value={vm.in10y.mid} />}
                  size="display"
                  isEstimate={!vm.in10yBandIsZero}
                  hint={t.today.future.hint}
                />
                <RangeText point={vm.in10y} isZero={vm.in10yBandIsZero} />
                {!vm.in10yBandIsZero && <p className="text-xs text-text-muted">{t.band.label}</p>}
                <Link href={links.future} className={cx(buttonClassName({ variant: 'primary' }), 'mt-sm self-start')}>
                  {t.today.future.cta}
                </Link>
              </Stack>
            ) : (
              <Skeleton />
            )}
          </Card>

          <Card title={t.today.monthEnd.title} data-testid="month-end" style={tilt(1)}>
            {!ready || vm.monthEnd.status === 'loading' ? (
              <Skeleton />
            ) : vm.monthEnd.status === 'error' ? (
              <ErrorNote error={vm.monthEnd.error} />
            ) : (
              <MonthEnd data={vm.monthEnd.data} uploadHref={links.upload} Link={Link} />
            )}
          </Card>
        </div>

        <MoveCard vm={vm} futureHref={links.future} Link={Link} />

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-3xl font-extrabold leading-tight">
            {t.today.tools.title}
          </h2>
          <ul className="mt-lg grid gap-lg sm:grid-cols-3">
            <ToolLink href={links.afford} art="afford" {...t.today.tools.afford} Link={Link} />
            <ToolLink href={links.loan} art="loan" {...t.today.tools.loan} Link={Link} />
            <ToolLink href={links.decide} art="austin" {...t.today.tools.decide} Link={Link} />
            <ToolLink href={links.checkin} art="checkin" {...t.today.tools.checkin} Link={Link} />
            <ToolLink
              href={links.profile}
              art="upload"
              {...(ready && !vm.isDemoProfile ? t.today.tools.profileEdit : t.today.tools.profile)}
              Link={Link}
            />
          </ul>
        </section>

        <nav aria-label={t.today.allScreens}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{t.today.allScreens}</h2>
          <ul className="mt-sm flex flex-wrap gap-xs">
            {screens.map(({ id, href }) => (
              <li key={id}>
                <Link
                  href={href}
                  data-screen={id}
                  className="inline-flex items-baseline gap-xs rounded-full border border-border bg-surface px-md py-xs text-xs hover:bg-surface-strong"
                >
                  <span className="font-mono text-text-muted">{id}</span>
                  <span>{screenTitles[id]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Stack>
    </main>
  );
}

// Decorative art for the home tiles, in play order (the illustrations carry no facts about the card).
const HOME_ART: ArtName[] = ['austin', 'brooklyn', 'boise', 'tampa', 'queens', 'columbus'];
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
                <Sticker tone="primary" tilt={-6} className="absolute top-0 right-md z-10 shadow-md">
                  {h.start}
                </Sticker>
              )}
              <div
                className={cx(
                  'flex h-full flex-col gap-sm rounded-xl bg-surface p-md shadow-md',
                  isNext && 'border-2 border-primary',
                )}
              >
                <Art name={HOME_ART[i % HOME_ART.length]!} imgClassName="aspect-square" />
                <div className="px-xs pb-xs">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{h.home(i + 1)}</p>
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

function PlayCard({ vm, href, Link }: { vm: TodayVM; href: string; Link: LinkComponent }) {
  const { played, total, finished } = vm.game;
  const inProgress = vm.status === 'ready' && played > 0 && !finished;
  const label = finished ? t.today.play.doneCta : inProgress ? t.today.play.continue(played, total) : t.today.play.cta;
  return (
    <Card tone="arena" data-testid="play" className="flex flex-col items-center gap-lg text-center sm:p-3xl">
      <h2 className="font-display text-4xl font-extrabold leading-display sm:text-6xl sm:leading-display">{t.today.play.title}</h2>
      <p className="max-w-(--container-lg) text-lg text-text-muted">{finished ? t.today.play.done : t.today.play.pitch}</p>
      <Link href={href} className={cx(buttonClassName({ variant: 'dark', size: 'lg' }), 'w-full sm:w-auto sm:min-w-sm')}>
        {label}
        <span aria-hidden="true">→</span>
      </Link>
    </Card>
  );
}

/** The black score bar, filled only with numbers the view-model has. */
function DayScore({ vm }: { vm: TodayVM }) {
  const s = t.today.score;
  const items: ScoreboardItem[] = [];
  if (vm.game.total > 0) {
    items.push({ id: 'played', value: s.playedValue(vm.game.played, vm.game.total), label: s.played, tone: 'primary' });
  }
  items.push({ id: 'in10y', value: formatMoney(vm.in10y.mid, { compact: true }), label: s.in10y });
  if (vm.monthEnd.status === 'ready') {
    items.push({ id: 'month', value: formatMoney(vm.monthEnd.data.projectedSpend, { compact: true }), label: s.month });
  }
  const move = vm.committedMove ?? (vm.topMove.status === 'ready' ? vm.topMove.data : null);
  if (move) {
    items.push({ id: 'move', value: formatMoney(move.effect10y, { signed: true, compact: true }), label: s.move, tone: 'positive' });
  }
  return <Scoreboard label={s.label} items={items} />;
}

function MonthEnd({ data, uploadHref, Link }: { data: MonthEndVM; uploadHref: string; Link: LinkComponent }) {
  const m = t.today.monthEnd;
  return (
    <Stack gap="md">
      <Stat
        label={m.projected}
        value={<Money value={data.projectedSpend} />}
        size="lg"
        hint={data.fromStatement ? m.fromStatement : m.fromProfile}
      />
      {data.vsAverage === null ? (
        <div className="flex flex-col items-start gap-sm" data-testid="month-end-no-history">
          <p className="text-sm text-text-muted">{m.needHistory(data.historyMonths)}</p>
          <Link href={uploadHref} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
            {m.upload}
          </Link>
        </div>
      ) : (
        <div data-testid="month-end-drifts">
          <p className="text-sm font-semibold tabular-nums">{m.vsAverageValue(formatMoney(data.vsAverage, { signed: true }))}</p>
          <h3 className="mt-md text-sm font-bold uppercase tracking-wide text-text-muted">{m.driftsTitle}</h3>
          {data.drifts.length === 0 ? (
            <p className="text-sm text-text-muted">{m.noDrifts}</p>
          ) : (
            <ul className="mt-xs flex flex-wrap gap-xs text-sm">
              {data.drifts.map((d) => (
                <li key={d.category} className="rounded-full bg-surface-strong px-md py-xs font-medium tabular-nums">
                  {m.drift(common.categories[d.category], formatMoney(d.delta, { signed: true }))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-sm border-t border-border pt-md text-sm">
        <span className="text-text-muted">{m.takeHome}</span>
        <Money value={data.takeHome.value} className="font-semibold" />
        <span className="text-text-muted">{m.perMonth}</span>
        {data.takeHome.isEstimate && <EstimateTag />}
      </div>
    </Stack>
  );
}

function MoveCard({ vm, futureHref, Link }: { vm: TodayVM; futureHref: string; Link: LinkComponent }) {
  const committed = vm.committedMove;
  const title = committed ? t.today.move.committedTitle : t.today.move.topTitle;
  let body;
  if (vm.status !== 'ready') body = <Skeleton lines={2} />;
  else if (committed) body = <MoveSummary move={committed} onDone={vm.markCommittedDone} />;
  else if (vm.topMove.status === 'loading') body = <Skeleton lines={2} />;
  else if (vm.topMove.status === 'error') body = <ErrorNote error={vm.topMove.error} />;
  else if (vm.topMove.data === null) body = <p className="text-sm text-text-muted">{t.today.move.none}</p>;
  else body = <MoveSummary move={vm.topMove.data} />;

  return (
    <Card
      title={title}
      data-testid="today-move"
      className={cx(committed && 'border-2 border-positive')}
      action={<Sticker tone={committed ? 'positive' : 'ink'}>{t.moves.rank(1)}</Sticker>}
    >
      {body}
      <Link href={futureHref} className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'mt-sm')}>
        {t.today.move.seeAll}
      </Link>
    </Card>
  );
}

function MoveSummary({ move, onDone }: { move: MoveVM; onDone?: () => void }) {
  const detail = moveDetail(move);
  return (
    <div className="flex flex-col gap-md sm:flex-row sm:items-end sm:justify-between">
      <Stack gap="xs">
        <p className="text-lg font-semibold">{moveTitle(move)}</p>
        {detail && <p className="text-sm text-text-muted">{detail}</p>}
        {onDone && (
          <Button variant="secondary" size="sm" className="mt-sm self-start" onClick={onDone}>
            {t.today.move.markDone}
          </Button>
        )}
      </Stack>
      <p className="font-display text-4xl font-extrabold leading-tight text-positive tabular-nums">
        {t.moves.effect(formatMoney(move.effect10y, { signed: true }))}
      </p>
    </div>
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
        className="flex h-full flex-col gap-sm rounded-xl bg-surface p-lg shadow-md transition-transform hover:-translate-y-1"
      >
        <Art name={art} imgClassName="aspect-video" />
        <span className="font-display text-xl font-extrabold text-primary">{title}</span>
        <span className="text-sm text-text-muted">{body}</span>
      </Link>
    </li>
  );
}
