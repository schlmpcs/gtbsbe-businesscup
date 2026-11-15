// "/" for a new visitor: the life road (a sample life with one milestone to move, rendered by the route),
// one Start (or Continue, for a story in progress), then what the product is: four facts, the sample life,
// how it works, what you get, how it differs from a budget app, the FAQ and Start again. No app chrome (the
// shell leaves "/" bare). Returning visitors never see it: the route sends them to /dashboard (a short
// "Opening your dashboard…" frame meanwhile). Presentational: copy from @/copy, numbers from LandingVM.
import type { CSSProperties, ReactNode } from 'react';
import { onboarding } from '@/copy';
import { Art, buttonClassName, cx, Icon, Sticker, type ArtName } from '@/ui-kit';
import type { LandingVM } from '../model/types';
import { Logo, type StoryLink } from './StoryFrame';

const t = onboarding.landing;

/** `demo`: the live life road (the route renders it) under the headline. */
export type LandingProps = { vm: LandingVM; Link: StoryLink; homeHref: string; demo?: ReactNode };

const H2 = 'font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl';
const LEAD = 'max-w-(--container-2xl) text-lg text-text-muted';
/** The tinted tray a group of cards sits in. */
const TRAY = 'rounded-xl bg-primary-soft p-sm sm:p-lg';
const CARD = 'relative flex min-w-0 flex-col overflow-hidden rounded-xl p-lg sm:p-xl';

const STAT_TONES = ['bg-ink text-on-primary', 'bg-primary text-on-primary', 'bg-surface text-text ring-1 ring-border', 'bg-surface-strong text-text'];
const STAT_ART: ArtName[] = ['house-blueprint', 'duel-houses', 'house-crane', 'home-suburb'];
const GET_TONES = ['bg-primary text-on-primary', 'bg-surface text-text', 'bg-surface text-text', 'bg-ink text-on-primary'];
const GET_ART: ArtName[] = ['step-future', 'home-large', 'coins', 'step-duels'];

function Heading({ title, body, center = true }: { title: string; body: string; center?: boolean }) {
  return (
    <div className={cx('flex flex-col gap-sm', center && 'items-center text-center')}>
      <h2 className={H2}>{title}</h2>
      <p className={LEAD}>{body}</p>
    </div>
  );
}

function Actions({ vm, Link, center }: { vm: LandingVM; Link: StoryLink; center?: boolean }) {
  return (
    <div className={cx('flex w-full flex-col gap-md sm:w-auto sm:flex-row sm:items-center', center && 'sm:justify-center')}>
      <Link href={vm.startHref} className={cx(buttonClassName({ size: 'lg' }), 'ob-press min-w-56 text-center text-xl')}>
        {vm.mode === 'continue' && vm.resumeChapter ? t.continue(vm.resumeChapter) : t.start}
      </Link>
      <Link
        href={vm.sampleHref}
        onClick={vm.seeSample}
        className="min-h-11 content-center text-center text-base font-semibold text-text underline-offset-4 hover:text-primary hover:underline"
      >
        {t.sample}
      </Link>
    </div>
  );
}

export function Landing({ vm, Link, homeHref, demo }: LandingProps) {
  if (vm.mode === 'loading' || vm.mode === 'redirect') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-(--container-6xl) flex-col px-lg py-md" data-testid="landing-wait">
        <Logo Link={Link} href={homeHref} />
        <p role="status" className="m-auto text-text-muted">
          {vm.mode === 'redirect' ? t.redirecting : t.loading}
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-(--container-6xl) flex-col gap-3xl overflow-x-clip px-lg py-md pb-2xl" data-testid="landing">
      {/* ----- Hero: the headline, Start, and the road ----- */}
      <div className="flex flex-col gap-lg">
        <header className="flex items-center justify-between gap-md">
          <Logo Link={Link} href={homeHref} />
          <nav className="flex items-center gap-md text-sm font-semibold sm:gap-lg sm:text-base">
            <Link href={vm.playHref} className="min-h-11 content-center hover:text-primary">{t.nav.play}</Link>
          </nav>
        </header>
        <section className="relative z-10 flex flex-col items-center gap-md pt-md text-center">
          <Sticker tone="ink" tilt={-3} className="ob-enter text-sm">
            {t.eyebrow}
          </Sticker>
          <h1 className="ob-enter text-balance font-display text-5xl font-extrabold leading-display tracking-tight sm:text-6xl lg:text-7xl lg:whitespace-nowrap" style={{ '--ob-delay': '80ms' } as CSSProperties}>
            {t.title}
          </h1>
          <p className="ob-enter max-w-(--container-2xl) text-xl text-text-muted" style={{ '--ob-delay': '160ms' } as CSSProperties}>
            {t.body}
          </p>
          <div className="ob-enter flex w-full flex-col items-center gap-sm" style={{ '--ob-delay': '240ms' } as CSSProperties}>
            <Actions vm={vm} Link={Link} center />
            {vm.mode === 'continue' && (
              <Link href={vm.restartHref} className="text-sm text-text-muted underline hover:text-text">
                {t.restart}
              </Link>
            )}
            <p className="text-sm text-text-muted">{t.note}</p>
          </div>
        </section>
        {demo && <div className="ob-enter min-w-0 lg:-mt-40" style={{ '--ob-delay': '320ms' } as CSSProperties}>{demo}</div>}
      </div>

      {/* ----- Four facts ----- */}
      <section aria-label={t.statsLabel}>
        <ul className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          {t.stats.map((s, i) => (
            <li key={s.value} className={cx(CARD, 'min-h-44 gap-xs sm:min-h-64', STAT_TONES[i])}>
              <span className="font-display text-5xl font-extrabold tabular-nums">{s.value}</span>
              <span className="max-w-52 text-base opacity-80">{s.body}</span>
              <Art name={STAT_ART[i]!} className="pointer-events-none absolute -bottom-6 -right-6 w-40" />
            </li>
          ))}
        </ul>
      </section>

      {/* ----- The sample life ----- */}
      <section className="flex flex-col gap-xl">
        <Heading title={t.life.title} body={t.life.body} center={false} />
        <div className={cx(TRAY, 'grid gap-sm sm:gap-lg lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
          <div className={cx(CARD, 'gap-lg bg-ink text-on-primary')}>
            <div className="flex items-center gap-md">
              <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary"><Icon name="home" size={26} /></span>
              <div className="min-w-0">
                <p className="text-xl font-bold">{t.life.who}</p>
                <p className="text-sm text-chart-6">{t.life.whoBody}</p>
              </div>
            </div>
            <dl className="divide-y divide-on-primary/10 rounded-lg bg-on-primary/5 ring-1 ring-on-primary/10" data-testid="landing-sample-facts">
              {vm.sampleFacts.map((f) => (
                <div key={f.id} className="flex items-baseline justify-between gap-md px-lg py-md">
                  <dt className="text-sm text-chart-6">{t.life.rows[f.id]}</dt>
                  <dd className="text-right font-bold tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={cx(CARD, 'gap-lg bg-surface')}>
            <div>
              <h3 className="font-display text-2xl font-extrabold">{t.life.outTitle}</h3>
              <p className="text-text-muted">{t.life.outBody}</p>
            </div>
            <ol className="flex flex-col gap-md">
              {t.life.outs.map((o, i) => (
                <li key={o.title} className="flex gap-md rounded-lg bg-surface-strong p-md">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display font-extrabold text-on-primary">{i + 1}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-bold">{o.title}</span>
                    <span className="text-sm text-text-muted">{o.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ----- What you get ----- */}
      <section className="flex flex-col gap-xl">
        <Heading title={t.gets.title} body={t.gets.body} />
        <ul className={cx(TRAY, 'grid gap-sm sm:gap-lg md:grid-cols-2')}>
          {t.gets.items.map((g, i) => (
            <li key={g.title} className={cx(CARD, 'min-h-56 gap-sm', GET_TONES[i])}>
              <h3 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
                {g.title}<br /><span className="opacity-50">{g.rest}</span>
              </h3>
              <p className="max-w-64 opacity-80">{g.body}</p>
              <Art name={GET_ART[i]!} className="pointer-events-none absolute -bottom-4 -right-4 w-36 sm:w-48" />
            </li>
          ))}
        </ul>
      </section>

      {/* ----- How it works ----- */}
      <section className="flex flex-col gap-xl">
        <Heading title={t.how.title} body={t.how.body} />
        <ol className="grid gap-md sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-steps">
          {t.how.steps.map((s, i) => (
            <li key={s.title + s.rest} className={cx(CARD, 'min-h-40 gap-sm sm:min-h-52', i === 3 ? 'bg-primary text-on-primary' : 'bg-surface ring-1 ring-border')}>
              <span className={cx('self-start rounded-full px-md py-xs text-sm font-bold',
                s.by === 'us' ? 'bg-ink text-on-primary' : i === 3 ? 'bg-on-primary/20' : 'bg-primary-soft text-primary')}>
                {s.by === 'us' ? t.how.us : t.how.you}
              </span>
              <h3 className="font-display text-2xl font-extrabold leading-tight">
                {s.title} <span className="opacity-50">{s.rest}</span>
              </h3>
              <p className="max-w-56 text-sm opacity-80">{s.body}</p>
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 right-md font-display text-8xl font-extrabold tabular-nums opacity-10">
                {String(i + 1).padStart(2, '0')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ----- Against a budget app ----- */}
      <section className="flex flex-col gap-xl">
        <Heading title={t.compare.title} body={t.compare.body} />
        <div className={TRAY}>
          <div className="overflow-hidden rounded-xl bg-surface" role="table" aria-label={t.compare.title}>
            <div role="row" className="hidden grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,5fr)] text-sm sm:grid">
              <span role="columnheader" className="px-lg py-md text-text-muted">{t.compare.what}</span>
              <span role="columnheader" className="px-lg py-md text-text-muted">{t.compare.them}</span>
              <span role="columnheader" className="bg-primary px-lg py-md font-display text-lg font-extrabold text-on-primary">{t.compare.us}</span>
            </div>
            {t.compare.rows.map((r) => (
              <div role="row" key={r.what} className="grid border-t border-border sm:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,5fr)]">
                <span role="rowheader" className="px-lg pt-md font-bold sm:py-md">{r.what}</span>
                <span role="cell" className="flex items-center gap-sm px-lg py-xs text-sm text-text-muted sm:py-md">
                  <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs">×</span>
                  <span><span className="sm:hidden">{t.compare.them}: </span>{r.them}</span>
                </span>
                <span role="cell" className="flex items-center gap-sm bg-primary-soft px-lg py-sm text-sm font-semibold sm:py-md">
                  <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"><Icon name="check" size={12} strokeWidth={3} /></span>
                  {r.us}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----- FAQ ----- */}
      <section className={cx(TRAY, 'grid gap-lg lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:p-xl')}>
        <div className="flex flex-col gap-sm p-md">
          <h2 className={H2}>{t.faq.title}</h2>
          <p className="text-text-muted">{t.faq.body}</p>
          <Art name="house-build" className="mt-md hidden w-56 lg:block" />
        </div>
        <div className="flex flex-col gap-sm" data-testid="landing-faq">
          {t.faq.items.map((f, i) => (
            <details key={f.q} open={i === 0} className="group rounded-lg bg-surface px-lg py-md">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-sm pt-xs text-sm leading-relaxed text-text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ----- Start again ----- */}
      <section className={cx(CARD, 'items-center gap-md bg-ink py-2xl text-center text-on-primary sm:py-3xl')}>
        <h2 className={H2}>{t.final.title}</h2>
        <p className="max-w-(--container-xl) text-lg text-chart-6">{t.final.body}</p>
        <Link href={vm.startHref} className={cx(buttonClassName({ size: 'lg' }), 'ob-press min-w-56 text-center text-xl')}>
          {vm.mode === 'continue' && vm.resumeChapter ? t.continue(vm.resumeChapter) : t.start}
        </Link>
        <p className="text-sm text-chart-6">{t.note}</p>
        <Art name="home-large" className="pointer-events-none absolute -bottom-8 -left-6 hidden w-56 md:block" />
        <Art name="home-cottage" className="pointer-events-none absolute -bottom-8 -right-6 hidden w-56 md:block" />
      </section>

      <footer className="text-center text-sm text-text-muted">{t.disclaimer}</footer>
    </main>
  );
}
