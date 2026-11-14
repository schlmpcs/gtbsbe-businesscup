// S1 Today: You in 10 years, the daily game, this month, the move to make, and the planning tools.
// Presentational: everything comes from TodayVM; links come from the route page.
import { common, forecast as t, screenTitles, type ScreenId } from '@/copy';
import { Button, buttonClassName, Card, cx, EstimateTag, formatMoney, Money, Stack, Stat } from '@/ui-kit';
import type { MonthEndVM, MoveVM, TodayVM } from '../model/types';
import { ErrorNote, moveDetail, moveTitle, RangeText, Skeleton, type LinkComponent } from './shared';

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
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <header>
          <h1 className="text-4xl leading-display sm:text-display">{t.today.title}</h1>
          <p className="mt-xs text-text-muted">{t.today.intro}</p>
        </header>

        {ready && vm.isDemoProfile && (
          <Card tone="muted" data-testid="sample-note">
            <p className="text-sm">{t.sampleProfile}</p>
            <Link href={links.profile} className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'mt-sm')}>
              {t.today.tools.profile.title}
            </Link>
          </Card>
        )}

        <PlayCard vm={vm} href={links.play} Link={Link} />

        <Card title={t.today.future.title} data-testid="in10y">
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
              <Link href={links.future} className={cx(buttonClassName({ variant: 'secondary' }), 'mt-sm self-start')}>
                {t.today.future.cta}
              </Link>
            </Stack>
          ) : (
            <Skeleton />
          )}
        </Card>

        <Card title={t.today.monthEnd.title} data-testid="month-end">
          {!ready || vm.monthEnd.status === 'loading' ? (
            <Skeleton />
          ) : vm.monthEnd.status === 'error' ? (
            <ErrorNote error={vm.monthEnd.error} />
          ) : (
            <MonthEnd data={vm.monthEnd.data} uploadHref={links.upload} Link={Link} />
          )}
        </Card>

        <MoveCard vm={vm} futureHref={links.future} Link={Link} />

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-lg font-semibold">
            {t.today.tools.title}
          </h2>
          <ul className="mt-md grid gap-md sm:grid-cols-3">
            <ToolLink href={links.afford} {...t.today.tools.afford} Link={Link} />
            <ToolLink href={links.loan} {...t.today.tools.loan} Link={Link} />
            <ToolLink href={links.decide} {...t.today.tools.decide} Link={Link} />
            <ToolLink href={links.checkin} {...t.today.tools.checkin} Link={Link} />
            <ToolLink
              href={links.profile}
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
                  className="inline-flex items-baseline gap-xs rounded-full border border-border px-md py-xs text-xs hover:bg-surface"
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

function PlayCard({ vm, href, Link }: { vm: TodayVM; href: string; Link: LinkComponent }) {
  const { played, total, finished } = vm.game;
  const inProgress = vm.status === 'ready' && played > 0 && !finished;
  const label = finished ? t.today.play.doneCta : inProgress ? t.today.play.continue(played, total) : t.today.play.cta;
  return (
    <Card title={t.today.play.title} tone="arena" data-testid="play">
      <p className="text-sm text-text-muted">{finished ? t.today.play.done : t.today.play.pitch}</p>
      <Link href={href} className={cx(buttonClassName({ variant: 'dark', size: 'lg', fullWidth: true }), 'mt-md')}>
        {label}
      </Link>
    </Card>
  );
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
          <Link href={uploadHref} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>
            {m.upload}
          </Link>
        </div>
      ) : (
        <div data-testid="month-end-drifts">
          <p className="text-sm font-medium tabular-nums">{m.vsAverageValue(formatMoney(data.vsAverage, { signed: true }))}</p>
          <h3 className="mt-md text-sm font-semibold">{m.driftsTitle}</h3>
          {data.drifts.length === 0 ? (
            <p className="text-sm text-text-muted">{m.noDrifts}</p>
          ) : (
            <ul className="mt-xs flex flex-col gap-xs text-sm">
              {data.drifts.map((d) => (
                <li key={d.category} className="tabular-nums">
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
    <Card title={title} data-testid="today-move">
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
    <Stack gap="sm">
      <p className="font-semibold">{moveTitle(move)}</p>
      {detail && <p className="text-sm text-text-muted">{detail}</p>}
      <p className="text-lg font-semibold text-positive tabular-nums">
        {t.moves.effect(formatMoney(move.effect10y, { signed: true }))}
      </p>
      {onDone && (
        <Button variant="secondary" size="sm" className="self-start" onClick={onDone}>
          {t.today.move.markDone}
        </Button>
      )}
    </Stack>
  );
}

function ToolLink({
  href,
  title,
  body,
  Link,
}: {
  href: string;
  title: string;
  body: string;
  Link: LinkComponent;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col gap-xs rounded-lg border border-border bg-bg p-lg shadow-sm hover:bg-surface"
      >
        <span className="font-semibold text-primary">{title}</span>
        <span className="text-sm text-text-muted">{body}</span>
      </Link>
    </li>
  );
}
