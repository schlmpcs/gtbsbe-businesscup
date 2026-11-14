// The frame of every ladder rung (S5–S9), Design v3: the step pills with "← Back" on the right, a
// huge display headline and its sub line on the left, the screen's content (with an optional right
// column: art, an ink summary card), the 10-year preview strip, then the footer: one text action on
// the left and the one orange CTA on the right.
import type { ReactNode } from 'react';
import { ladder, screenTitles } from '@/copy';
import { buttonClassName, cx } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';
import { LadderPreview, LadderSteps } from './LadderProgress';
import { LoadingState } from './LoadingState';

const t = ladder.shell;

/** A link in the footer: where it goes and what it says. */
export type LadderLink = { href: string; label: string };

export type LadderShellProps = {
  screen: LadderScreen;
  progress: LadderProgressVM;
  /** The screen's own view-model is still loading (saved state not read yet). */
  loading?: boolean;
  /** Right column next to the headline and content (art, an ink summary card). */
  aside?: ReactNode;
  /**
   * The orange CTA. Default: a link to the next rung (S9: to the forecast). Pass an element to
   * replace it (S5's "Lock my guess" button), or null for none (S6 before a life is picked).
   */
  primary?: ReactNode | null;
  /** The text action on the left of the footer. Default per rung (S7 back, S8/S9 skip). */
  secondary?: ReactNode | null;
  children: ReactNode;
};

/** Link styled as the footer's text action ("← Back", "Skip, use estimates"). */
export function LadderTextLink({ href, label }: LadderLink) {
  return (
    <a href={href} className="min-h-11 content-center text-base font-semibold text-text hover:text-primary">
      {label}
    </a>
  );
}

export function LadderShell({
  screen,
  progress,
  loading = false,
  aside,
  primary,
  secondary,
  children,
}: LadderShellProps) {
  const index = progress.rungs.findIndex((r) => r.screen === screen);
  const prev = index > 0 ? progress.rungs[index - 1] : undefined;
  const next = index >= 0 ? progress.rungs[index + 1] : undefined;

  const defaultPrimary =
    screen === 'S9' || !next ? (
      <a href={progress.futureHref} className={buttonClassName({ size: 'lg' })}>
        {t.cta.S9}
      </a>
    ) : (
      <a href={next.href} className={buttonClassName({ size: 'lg' })}>
        {t.cta[screen]}
      </a>
    );
  const defaultSecondary =
    screen === 'S8' || screen === 'S9' ? (
      <LadderTextLink href={progress.futureHref} label={t.skip[screen]} />
    ) : screen === 'S7' && prev ? (
      <LadderTextLink href={prev.href} label={t.back} />
    ) : null;
  const primaryNode = primary === undefined ? defaultPrimary : primary;
  const secondaryNode = secondary === undefined ? defaultSecondary : secondary;

  const header = (
    <header className="flex flex-col gap-md">
      {screen === 'S9' && (
        <p className="text-sm font-bold uppercase tracking-wide text-text-muted">{t.optional}</p>
      )}
      <h1 className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display lg:text-[length:calc(var(--text-display)*1.3)]">
        {screenTitles[screen]}
      </h1>
      <p className="max-w-prose text-lg text-text-muted">{t.intro[screen]}</p>
    </header>
  );

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <div className="flex flex-col gap-2xl">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <LadderSteps screen={screen} progress={progress} />
          {prev && <LadderTextLink href={prev.href} label={t.back} />}
        </div>

        {aside ? (
          <div className="grid items-start gap-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="flex min-w-0 flex-col gap-xl">
              {header}
              {loading ? <LoadingState /> : children}
            </div>
            {!loading && <div className="flex min-w-0 flex-col gap-xl lg:sticky lg:top-xl">{aside}</div>}
          </div>
        ) : (
          <div className="flex flex-col gap-xl">
            {header}
            {loading ? <LoadingState /> : children}
          </div>
        )}

        <LadderPreview progress={progress} />

        {(primaryNode || secondaryNode) && (
          <div
            className={cx(
              'flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center',
              secondaryNode ? 'sm:justify-between' : 'sm:justify-end',
            )}
          >
            {secondaryNode}
            {primaryNode}
          </div>
        )}
      </div>
    </main>
  );
}
