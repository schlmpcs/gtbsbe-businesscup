// "/" for a new visitor: the idea in one headline, one Start (or Continue, for a story in progress), a
// hint of the three chapters, the 3D house, and "See a sample plan" as the quiet second way in. No app
// chrome (the shell leaves "/" bare) and no numbers. Returning visitors never see it: the route sends
// them to /dashboard (a short "Opening your dashboard…" frame meanwhile).
import type { CSSProperties } from 'react';
import { onboarding } from '@/copy';
import { Art, buttonClassName, cx, Sticker } from '@/ui-kit';
import type { LandingVM } from '../model/types';
import { Logo, type StoryLink } from './StoryFrame';

const t = onboarding.landing;

export type LandingProps = { vm: LandingVM; Link: StoryLink; homeHref: string };

export function Landing({ vm, Link, homeHref }: LandingProps) {
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
    <main className="mx-auto flex min-h-dvh w-full max-w-(--container-6xl) flex-col gap-2xl px-lg py-md" data-testid="landing">
      <header className="flex items-center justify-between gap-md">
        <Logo Link={Link} href={homeHref} />
      </header>
      <section className="grid items-center gap-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col items-start gap-lg">
          <Sticker tone="ink" tilt={-3} className="ob-enter text-sm">
            {t.eyebrow}
          </Sticker>
          <h1 className="ob-enter font-display text-5xl font-extrabold leading-display tracking-tight sm:text-7xl" style={{ '--ob-delay': '80ms' } as CSSProperties}>
            {t.title}
          </h1>
          <p className="ob-enter max-w-(--container-lg) text-xl" style={{ '--ob-delay': '160ms' } as CSSProperties}>
            {t.body}
          </p>
          <div className="ob-enter flex w-full flex-col gap-md sm:w-auto sm:flex-row sm:items-center" style={{ '--ob-delay': '240ms' } as CSSProperties}>
            <Link href={vm.startHref} className={cx(buttonClassName({ size: 'lg' }), 'ob-press min-w-48 text-center text-2xl')}>
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
          {vm.mode === 'continue' && (
            <Link href={vm.restartHref} className="text-sm text-text-muted underline hover:text-text">
              {t.restart}
            </Link>
          )}
          <p className="text-sm text-text-muted">{t.note}</p>
        </div>
        {/* Decoration only: the art carries no number. */}
        <div aria-hidden="true" className="relative mx-auto w-full max-w-(--container-sm) lg:max-w-(--container-md)">
          <div className="ob-build">
            <Art name="house-build" loading="eager" className="ob-float" />
          </div>
          <Sticker tone="primary" tilt={6} className="absolute top-md right-md text-sm">
            {t.heroSticker}
          </Sticker>
        </div>
      </section>
      <section aria-label={t.chaptersLabel}>
        <ol className="grid gap-md sm:grid-cols-3">
          {t.chapters.map((c, i) => (
            <li
              key={c.title}
              className="ob-enter flex gap-md rounded-xl bg-surface p-lg shadow-md"
              style={{ '--ob-delay': `${360 + i * 100}ms` } as CSSProperties}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-extrabold text-on-primary">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-xs">
                <span className="text-lg font-bold">{c.title}</span>
                <span className="text-sm text-text-muted">{c.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
