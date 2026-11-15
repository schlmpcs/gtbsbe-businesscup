// S1 Today. First visit: the product above the fold (count your month → see where you're heading →
// your next best move), one primary CTA (start with your month) and the daily game as the hook.
// After that, the Home dashboard: your house (the 10-year number), this month, your next move,
// today's game and What if?. The screen list for judges lives at /screens, not here.
// Presentational: everything comes from TodayVM; links come from the route page.
import type { ReactNode } from 'react';
import { bills, common, forecast as t, goal as g, spend, tools } from '@/copy';
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
import type { MonthEndVM, MoveVM, SpendSummaryVM, TodayVM } from '../model/types';
import { CushionCard } from './CushionCard';
import {
  bandText,
  ErrorNote,
  EYEBROW,
  INK_BAND,
  moveDetail,
  moveTitle,
  RangeText,
  Skeleton,
  SourceTag,
  type LinkComponent,
} from './shared';

export type TodayLinks = {
  play: string;
  /** "Try with sample data": S10 with the sample life loaded. */
  sample: string;
  future: string;
  /** The "What if?" hub. */
  tools: string;
  afford: string;
  loan: string;
  decide: string;
  checkin: string;
  /** Start of "build your profile" (S5 Guess yourself). */
  profile: string;
  /** The onboarding (/start); when given, the first visit's main button goes there. */
  onboarding?: string;
  upload: string;
  /** The daily spending log (/spend). */
  spend?: string;
  /** The bills calendar (the "Next bill" line links there when given). */
  bills?: string;
};

export type TodayScreenProps = {
  vm: TodayVM;
  links: TodayLinks;
  Link: LinkComponent;
  /** The daily log's quick-add (features/spend), rendered in the "This month so far" card. */
  quickAdd?: ReactNode;
  /** The home hero (features/lifeline): when given, it leads the page and the house card turns compact. */
  hero?: ReactNode;
};

const CARD = 'rounded-xl bg-surface p-xl shadow-md';
const TEXT_LINK = 'inline-flex min-h-11 items-center gap-xs text-sm font-semibold text-primary hover:underline';
const CARD_TITLE = 'text-xs font-bold uppercase tracking-wide';
const VERDICT_TONE = { onTrack: 'positive', withinRange: 'primary', behind: 'ink' } as const;

export function TodayScreen({ vm, links, Link, quickAdd, hero }: TodayScreenProps) {
  if (vm.firstVisit) return <FirstVisit links={links} Link={Link} />;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl">
      <Stack gap="3xl">
        {hero}
        <HouseHero vm={vm} futureHref={links.future} Link={Link} compact={Boolean(hero)} />

        <Nudge vm={vm} links={links} Link={Link} />

        <NextBillLine vm={vm} href={links.bills} Link={Link} />

        <div className="grid items-stretch gap-xl md:grid-cols-2 lg:grid-cols-3">
          <MonthCard vm={vm} uploadHref={links.upload} Link={Link} />
          <MoveCard vm={vm} futureHref={links.future} Link={Link} />
          <GameCard vm={vm} playHref={links.play} Link={Link} />
          <CushionCard vm={vm} />
        </div>

        {(vm.daily || quickAdd) && <DailyCard vm={vm} quickAdd={quickAdd} spendHref={links.spend} Link={Link} />}

        <WhatIfRow links={links} Link={Link} />
      </Stack>
    </main>
  );
}

/** The house: net worth in 10 years (AI estimate or rules, as the VM says), its range and the goal verdict. */
function HouseHero({ vm, futureHref, Link, compact = false }: { vm: TodayVM; futureHref: string; Link: LinkComponent; compact?: boolean }) {
  const ready = vm.status === 'ready';
  const Heading = compact ? 'h2' : 'h1';
  return (
    <section
      aria-labelledby="house-heading"
      className={compact ? cx(CARD, 'flex flex-col') : 'grid items-center gap-2xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'}
    >
      <div className="flex min-w-0 flex-col items-start gap-lg">
        <Heading id="house-heading" className={compact ? 'sr-only' : undefined}>
          <Sticker tone="ink" tilt={-3} className="text-sm">
            {t.today.home.title}
          </Sticker>
        </Heading>
        <div data-testid="at-horizon" className="flex w-full flex-col gap-sm">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            {ready && vm.horizonReady ? t.today.future.title(vm.horizonYears) : t.today.future.titleNeutral}
          </h2>
          {!ready || vm.forecastStatus === 'loading' ? (
            <Skeleton lines={4} />
          ) : vm.forecastStatus === 'error' && vm.forecastError ? (
            <ErrorNote error={vm.forecastError} />
          ) : (
            <Stack gap="sm">
              <div className="flex flex-wrap items-center gap-sm">
                <span className={EYEBROW}>{vm.horizonReady ? t.netWorthAt(vm.horizonYears) : t.today.future.titleNeutral}</span>
                {!vm.bandIsZero && <EstimateTag />}
              </div>
              <p className={cx('font-display font-extrabold leading-display tracking-tight tabular-nums break-words', compact ? 'text-5xl' : 'text-7xl sm:text-8xl lg:text-9xl')}>
                <Money value={vm.atHorizon.mid} />
              </p>
              <div className="flex flex-wrap items-baseline gap-x-sm text-sm text-text-muted">
                <RangeText point={vm.atHorizon} isZero={vm.bandIsZero} />
                {!vm.bandIsZero && <span aria-hidden="true">·</span>}
                <span>{t.today.future.hint}</span>
              </div>
              <div className="flex flex-wrap items-center gap-sm">
                <SourceTag source={vm.source} />
                {!vm.bandIsZero && (
                  <span className="text-xs text-text-muted">{bandText(vm.bandKind, false).label}</span>
                )}
                <span aria-live="polite" className="text-xs text-text-muted" data-testid="forecast-refreshing">
                  {vm.isRefreshing ? t.future.refreshing : null}
                </span>
              </div>
              {vm.goal && (
                <div data-testid="today-goal" className="mt-sm flex flex-wrap items-center gap-sm">
                  <Sticker tone={VERDICT_TONE[vm.goal.verdict]} tilt={-2}>
                    {g.verdictLabel[vm.goal.verdict]}
                  </Sticker>
                  <span className="text-sm font-semibold tabular-nums">
                    {t.today.home.goalLine(formatMoney(vm.goal.target), vm.goal.years)}
                  </span>
                </div>
              )}
            </Stack>
          )}
        </div>
        <Link href={futureHref} className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
          {t.today.home.openFuture}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      {/* Decoration only: the art carries no number. */}
      {!compact && <Art name="house-build" className="mx-auto w-full max-w-60 sm:max-w-(--container-md)" />}
    </section>
  );
}

/**
 * At most one nudge: none while the sample life is on (the site banner says it); the starting
 * profile asks you to build yours; estimated inputs ask for a statement.
 */
function Nudge({ vm, links, Link }: { vm: TodayVM; links: TodayLinks; Link: LinkComponent }) {
  if (vm.status !== 'ready' || vm.isSample) return null;
  const n = t.today.home.nudge;
  const nudge = vm.isDemoProfile
    ? { text: n.demo, cta: n.buildProfile, href: links.profile }
    : vm.hasEstimates
      ? { text: n.estimates, cta: n.makeExact, href: links.upload }
      : null;
  if (!nudge) return null;
  return (
    <div
      data-testid="nudge"
      className="flex flex-wrap items-center justify-between gap-x-md gap-y-xs rounded-xl bg-primary-soft px-xl py-sm"
    >
      <p className="text-sm font-semibold">{nudge.text}</p>
      <Link href={nudge.href} className={TEXT_LINK}>
        {nudge.cta}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/** One line about the next bill due ("Next bill: Netflix $15.49 in 3 days"), linking to the bills calendar. */
function NextBillLine({ vm, href, Link }: { vm: TodayVM; href?: string; Link: LinkComponent }) {
  const next = vm.status === 'ready' ? vm.nextBill : null;
  if (!next) return null;
  const text = bills.today.nextBill(next.label, formatMoney(next.amount, { cents: true }), next.inDays);
  return (
    <p data-testid="next-bill" className="flex flex-wrap items-center justify-between gap-x-md gap-y-xs rounded-xl bg-surface px-xl py-sm text-sm font-semibold shadow-sm">
      <span>{text}</span>
      {href && (
        <Link href={href} className={TEXT_LINK}>
          {bills.today.open}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </p>
  );
}

function MonthCard({ vm, uploadHref, Link }: { vm: TodayVM; uploadHref: string; Link: LinkComponent }) {
  const ready = vm.status === 'ready';
  return (
    <section aria-labelledby="month-end-heading" data-testid="month-end" className={cx(INK_BAND, 'flex flex-col gap-md p-xl')}>
      <h2 id="month-end-heading" className={cx(CARD_TITLE, 'text-primary')}>
        {t.today.monthEnd.title}
      </h2>
      <div className="flex-1">
        {!ready || vm.monthEnd.status === 'loading' ? (
          <Skeleton />
        ) : vm.monthEnd.status === 'error' ? (
          <ErrorNote error={vm.monthEnd.error} />
        ) : (
          <MonthEnd data={vm.monthEnd.data} />
        )}
      </div>
      <Link href={uploadHref} className={cx(TEXT_LINK, 'self-start')}>
        {t.today.monthEnd.upload}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

function MonthEnd({ data }: { data: MonthEndVM }) {
  const m = t.today.monthEnd;
  const hint = data.fromStatement
    ? m.fromStatement(formatMonth(data.month, data.asOfDay ?? undefined))
    : data.historyMonths > 0
      ? m.noRowsThisMonth(formatMonth(data.month))
      : m.fromProfile;
  return (
    <Stack gap="md">
      <div>
        <p className="font-display text-5xl font-extrabold leading-display tabular-nums">
          <Money value={data.projectedSpend} />
        </p>
        <p className="mt-xs text-sm text-text-muted">{m.projected}</p>
      </div>
      <div>
        <p className="font-display text-2xl font-extrabold leading-tight tabular-nums">
          <Money value={data.takeHome.value} />
        </p>
        <p className="mt-xs flex flex-wrap items-center gap-xs text-sm text-text-muted">
          <span>{m.takeHome}</span>
          <span>{m.perMonth}</span>
          {data.takeHome.isEstimate && <EstimateTag className="border-on-primary/40" />}
        </p>
      </div>
      <p className="text-xs text-text-muted">{hint}</p>
      {data.vsAverage === null ? (
        <p
          className="text-sm"
          data-testid={data.noAverage === 'thisMonth' ? 'month-end-no-current' : 'month-end-no-history'}
        >
          {data.noAverage === 'thisMonth' ? m.needThisMonth(formatMonth(data.month)) : m.needHistory(data.historyMonths)}
        </p>
      ) : (
        <div data-testid="month-end-drifts" className="flex flex-col gap-xs">
          <p className="font-semibold tabular-nums text-primary">
            {m.vsAverageValue(formatMoney(data.vsAverage, { signed: true }))}
          </p>
          {data.drifts.length === 0 ? (
            <p className="text-sm text-text-muted">{m.noDrifts}</p>
          ) : (
            <ul aria-label={m.driftsTitle} className="flex flex-wrap gap-xs text-xs">
              {data.drifts.map((d) => (
                <li key={d.category} className="rounded-full bg-on-primary/10 px-md py-xs font-medium tabular-nums">
                  {m.drift(common.categories[d.category], formatMoney(d.delta, { signed: true }))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Stack>
  );
}

function MoveCard({ vm, futureHref, Link }: { vm: TodayVM; futureHref: string; Link: LinkComponent }) {
  const committed = vm.committedMove;
  const title = committed ? t.today.move.committedTitle : t.today.home.move.title;
  let body;
  if (vm.status !== 'ready') body = <Skeleton lines={2} />;
  else if (committed) body = <MoveSummary move={committed} vm={vm} />;
  else if (vm.topMove.status === 'loading') body = <Skeleton lines={2} />;
  else if (vm.topMove.status === 'error') body = <ErrorNote error={vm.topMove.error} />;
  else if (vm.topMove.data === null) body = <p className="text-sm text-text-muted">{t.today.move.none}</p>;
  else body = <MoveSummary move={vm.topMove.data} vm={vm} />;

  return (
    <section
      aria-labelledby="today-move-heading"
      data-testid="today-move"
      className={cx(CARD, 'flex flex-col gap-md border-2', committed ? 'border-positive' : 'border-transparent')}
    >
      <h2 id="today-move-heading" className={cx(CARD_TITLE, 'text-text-muted')}>
        {title}
      </h2>
      <div className="flex-1">{body}</div>
      <Link href={futureHref} className={cx(TEXT_LINK, 'self-start')}>
        {t.today.home.move.allMoves}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

function MoveSummary({ move, vm }: { move: MoveVM; vm: TodayVM }) {
  const detail = moveDetail(move);
  const inPlan = vm.committedMove?.id === move.id;
  return (
    <Stack gap="sm">
      <div>
        <p className="font-display text-4xl font-extrabold leading-display tracking-tight text-primary tabular-nums">
          {t.moves.effect(formatMoney(move.effect, { signed: true }), move.horizonYears)}
        </p>
        <p className="mt-xs flex flex-wrap items-center gap-sm text-xs text-text-muted">
          <SourceTag source={move.source} />
        </p>
      </div>
      <p className="text-lg font-bold leading-tight">{moveTitle(move)}</p>
      {detail && <p className="text-sm text-text-muted">{detail}</p>}
      <div className="mt-sm flex flex-wrap items-center gap-sm">
        {inPlan ? (
          <>
            <Button variant="secondary" size="sm" aria-pressed="true" onClick={vm.uncommit}>
              {t.moves.committed}
            </Button>
            <Button variant="ghost" size="sm" onClick={vm.markCommittedDone} disabled={vm.actionsDisabled}>
              {t.today.move.markDone}
            </Button>
          </>
        ) : (
          <Button variant="dark" size="sm" onClick={() => vm.commit(move.id)} disabled={vm.actionsDisabled}>
            {t.moves.commit}
          </Button>
        )}
      </div>
    </Stack>
  );
}

/** Today's game: not started, in progress (n of 5) or done for today. */
function GameCard({ vm, playHref, Link }: { vm: TodayVM; playHref: string; Link: LinkComponent }) {
  const ready = vm.status === 'ready';
  const { played, total, finished } = vm.game;
  const duel = vm.game.kind === 'duel';
  const p = duel ? t.today.playDuel : t.today.play;
  const h = t.today.home.game;
  const inProgress = played > 0 && !finished;
  return (
    <section aria-labelledby="today-game-heading" data-testid="play" className={cx(CARD, 'flex flex-col gap-md')}>
      <h2 id="today-game-heading" className={cx(CARD_TITLE, 'text-text-muted')}>
        {h.title}
      </h2>
      {/* Decoration only. */}
      <Art name="duel-houses" className="mx-auto w-full max-w-48" />
      {!ready ? (
        <Skeleton lines={2} />
      ) : finished ? (
        <div className="flex flex-1 flex-col items-start gap-sm">
          <Sticker tone="positive" tilt={-3}>
            {p.doneSticker}
          </Sticker>
          <p className="font-display text-5xl font-extrabold leading-display tabular-nums">{p.doneScore(played, total)}</p>
          <p className="text-sm text-text-muted">{duel ? h.tomorrow : h.tomorrowHomes}</p>
          <Link href={playHref} className={cx(TEXT_LINK, 'mt-auto')}>
            {p.doneCta}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-start gap-md">
          <p className="font-display text-2xl font-extrabold leading-tight">{duel ? t.today.duel.title : t.today.title}</p>
          <Link href={playHref} className={cx(buttonClassName({ variant: 'primary' }), 'mt-auto w-full sm:w-auto')}>
            {inProgress ? p.continue(played, total) : p.cta}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}

/** The daily log on Home: spent since the 1st of usual, projected month end, safe to spend today, quick-add. */
function DailyCard({
  vm,
  quickAdd,
  spendHref,
  Link,
}: {
  vm: TodayVM;
  quickAdd?: ReactNode;
  spendHref?: string;
  Link: LinkComponent;
}) {
  const daily = vm.daily;
  return (
    <section aria-labelledby="today-daily-heading" data-testid="today-daily" className={cx(CARD, 'flex flex-col gap-lg')}>
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <h2 id="today-daily-heading" className={cx(CARD_TITLE, 'text-text-muted')}>
          {spend.summary.title}
        </h2>
        {spendHref && (
          <Link href={spendHref} className={TEXT_LINK}>
            {spend.homeLink}
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <div className="grid gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          {vm.status !== 'ready' || !daily || daily.status === 'loading' ? (
            <Skeleton lines={3} />
          ) : daily.status === 'error' ? (
            <ErrorNote error={daily.error} />
          ) : (
            <DailyNumbers data={daily.data} />
          )}
        </div>
        {quickAdd}
      </div>
    </section>
  );
}

function DailyNumbers({ data }: { data: SpendSummaryVM }) {
  const s = spend.summary;
  return (
    <Stack gap="md">
      <div>
        <p className={EYEBROW}>{s.spentSince(formatMonth(data.month, 1))}</p>
        <p className="font-display text-4xl font-extrabold leading-display tabular-nums" data-testid="today-daily-spent">
          <Money value={data.spent} />
        </p>
        <p className="text-sm text-text-muted tabular-nums">{s.ofUsual(formatMoney(data.usual))}</p>
      </div>
      <div className="flex flex-wrap gap-x-xl gap-y-md">
        <div>
          <p className={EYEBROW}>{s.projected}</p>
          <p className="font-display text-2xl font-extrabold tabular-nums" data-testid="today-daily-projected">
            <Money value={data.projected} />
          </p>
        </div>
        <div>
          <p className={EYEBROW}>{s.safeToday}</p>
          <p className="font-display text-2xl font-extrabold tabular-nums text-positive" data-testid="today-daily-safe">
            <Money value={data.safeToday} />
          </p>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {data.remaining < 0 ? s.over(formatMoney(-data.remaining)) : s.safeHint(data.daysLeft)}
      </p>
    </Stack>
  );
}

type ToolKey = 'afford' | 'loan' | 'decide' | 'checkin';
// The same art as the What if? hub (/tools).
const WHAT_IF: { key: ToolKey; art: ArtName }[] = [
  { key: 'afford', art: 'afford-crane' },
  { key: 'loan', art: 'coins' },
  { key: 'decide', art: 'home-family' },
  { key: 'checkin', art: 'house-crane' },
];

function WhatIfRow({ links, Link }: { links: TodayLinks; Link: LinkComponent }) {
  const w = t.today.home.whatIf;
  return (
    <section aria-labelledby="what-if-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <h2 id="what-if-heading" className="font-display text-3xl font-extrabold leading-tight tracking-tight">
          {w.title}
        </h2>
        <Link href={links.tools} className={TEXT_LINK}>
          {w.all}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ul className="mt-md grid gap-md sm:grid-cols-2 lg:grid-cols-4">
        {WHAT_IF.map(({ key, art }) => {
          const item = tools.hub.items[key];
          return (
            <li key={key}>
              <Link
                href={links[key]}
                className="flex h-full items-center gap-md rounded-xl bg-surface p-md shadow-md transition-transform hover:-translate-y-1"
              >
                <Art name={art} className="flex size-16 shrink-0 items-center" />
                <span className="flex min-w-0 flex-col gap-xs">
                  <span className="font-bold leading-tight">{item.question}</span>
                  <span className="text-xs text-text-muted">{item.line}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEP_ART: ArtName[] = ['step-month', 'step-future', 'house-crane'];

function Steps({ items, label }: { items: readonly string[]; label: string }) {
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

/**
 * First visit (no profile, no game yet): the product above the fold (the three steps), one primary
 * CTA (start with your month), the statement shortcut, and the daily game as the hook. No user numbers.
 */
function FirstVisit({ links, Link }: Omit<TodayScreenProps, 'vm' | 'quickAdd'>) {
  const f = t.today.firstVisit;
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl sm:py-3xl" data-testid="today-first-visit">
      <Stack gap="2xl">
        <section className="grid items-center gap-2xl lg:grid-cols-2">
          <div className="flex min-w-0 flex-col items-start gap-lg">
            <Sticker tone="ink" tilt={-3}>
              {f.eyebrow}
            </Sticker>
            <h1 className="font-display text-5xl font-extrabold leading-display tracking-tight sm:text-7xl xl:text-8xl">
              {f.title}
            </h1>
            <p className="max-w-(--container-lg) text-xl">{f.body}</p>
            <div className="flex w-full flex-wrap items-center gap-md">
              <Link href={links.onboarding ?? links.profile} className={cx(buttonClassName({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}>
                {f.start}
                <span aria-hidden="true">→</span>
              </Link>
              <Link href={links.sample} className={TEXT_LINK}>
                {f.sample}
              </Link>
            </div>
            <p className="text-sm text-text-muted">
              <span>{f.note}</span>{' '}
              <Link href={links.upload} className="font-semibold text-primary hover:underline">
                {f.upload}
              </Link>
            </p>
          </div>
          {/* Decoration only: the art carries no number or cost fact. */}
          <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-(--container-md) lg:block">
            <Art name="step-future" />
            <Sticker tone="primary" tilt={6} className="absolute top-lg right-lg">
              {f.heroSticker}
            </Sticker>
          </div>
        </section>
        <section aria-label={f.stepsLabel}>
          <Steps items={f.steps} label={f.stepsLabel} />
        </section>
        <section
          data-testid="play"
          aria-label={f.game.label}
          className="grid items-center gap-xl rounded-xl bg-surface p-xl shadow-md sm:grid-cols-[1fr_auto]"
        >
          <div className="flex min-w-0 flex-col items-start gap-sm">
            <Sticker tone="primary" tilt={-4}>
              {f.game.label}
            </Sticker>
            <h2 className="font-display text-3xl font-extrabold leading-tight">{f.game.title}</h2>
            <p className="text-text-muted">{f.game.body}</p>
            <Link href={links.play} className={cx(buttonClassName({ variant: 'secondary', size: 'lg' }), 'mt-sm')}>
              {f.play}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div aria-hidden="true" className="relative mx-auto w-full max-w-(--container-xs)">
            <Art name="duel-houses" />
            <span className="absolute top-1/3 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold uppercase text-on-primary shadow-md">
              {f.vs}
            </span>
          </div>
        </section>
      </Stack>
    </main>
  );
}
