// The story's frame (/start): a small logo link home, the slim 4-chapter progress (tap a reached chapter
// to go back), "Skip" (on to the next chapter, estimates kept), and the chapter card, which slides in on
// every chapter change (keyed by chapter). No app chrome here: the shell leaves /start bare.
import type { ComponentType, ReactNode } from 'react';
import { common, onboarding } from '@/copy';
import { cx } from '@/ui-kit';
import type { ChapterId } from '../model/types';

const t = onboarding.story;
const CHAPTERS: readonly ChapterId[] = [1, 2, 3, 4];

export type StoryLink = ComponentType<{ href: string; className?: string; children: ReactNode; 'aria-label'?: string; onClick?: () => void }>;

export type StoryFrameProps = {
  chapter: ChapterId;
  reached: ChapterId;
  onGoTo: (chapter: ChapterId) => void;
  Link: StoryLink;
  homeHref: string;
  children: ReactNode;
};

/** The wordmark: a little orange house and the app name. */
export function Logo({ Link, href }: { Link: StoryLink; href: string }) {
  return (
    <Link href={href} aria-label={t.home(common.appName)} className="inline-flex min-h-11 items-center gap-sm font-display text-lg font-extrabold">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-primary text-on-primary">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z" />
        </svg>
      </span>
      {common.appName}
    </Link>
  );
}

export function StoryFrame({ chapter, reached, onGoTo, Link, homeHref, children }: StoryFrameProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-(--container-4xl) flex-col gap-lg overflow-x-clip px-lg py-md sm:py-lg" data-testid="story" data-chapter={chapter}>
      <header className="flex items-center justify-between gap-md">
        <Logo Link={Link} href={homeHref} />
        {chapter < 4 && (
          <button
            type="button"
            onClick={() => onGoTo((chapter + 1) as ChapterId)}
            aria-label={t.skipLabel(chapter)}
            className="min-h-11 rounded-full px-md text-sm font-semibold text-text-muted hover:text-text"
          >
            {t.skip}
          </button>
        )}
      </header>

      <nav aria-label={t.progressLabel}>
        <ol className="grid grid-cols-4 gap-xs">
          {CHAPTERS.map((n) => {
            const current = n === chapter;
            const done = n < chapter;
            const canGo = n <= reached && !current;
            const state = current ? t.chapterState.current : done ? t.chapterState.done : t.chapterState.notYet;
            return (
              <li key={n} className="min-w-0">
                <button
                  type="button"
                  disabled={!canGo}
                  onClick={() => onGoTo(n)}
                  aria-current={current ? 'step' : undefined}
                  data-chapter-dot={n}
                  className="group flex min-h-11 w-full flex-col justify-center gap-xs text-left disabled:cursor-default"
                >
                  <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <span
                      className={cx(
                        'absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500',
                        current || done ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                  </span>
                  <span className={cx('truncate text-xs font-semibold', current ? 'text-text' : 'text-text-muted', canGo && 'group-hover:text-text')}>
                    {t.chapters[n].short}
                    <span className="sr-only">
                      {' '}
                      ({t.chapterOf(n)}, {state})
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Keyed by chapter: each chapter enters with the slide. */}
      <section key={chapter} aria-labelledby={`chapter-${chapter}-title`} className="ob-chapter flex flex-1 flex-col gap-xl pb-xl">
        <header className="flex flex-col gap-xs">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{t.chapterOf(chapter)}</p>
          <h1 id={`chapter-${chapter}-title`} className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-5xl lg:text-6xl">
            {t.chapters[chapter].title}
          </h1>
        </header>
        {children}
      </section>
    </main>
  );
}
