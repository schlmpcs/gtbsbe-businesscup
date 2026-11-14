// The frame of every ladder rung (S5–S9), Design v3: the step pills with "← Back" on the right, a
// huge display headline and its sub line on the left, the screen's content (with an optional right
// column: art, an ink summary card), then the footer: one text action on the left and the one
// orange CTA on the right. Steps: S5 guess → S6 closest life → S9 your spending, imported from a
// statement (S7 is its by-hand alternative) → S8 pay & savings. Only the last step (S8) shows one short "You in 10 years" line above its CTA, which leads to the forecast.
import type { ReactNode } from 'react';
import { ladder, screenTitles } from '@/copy';
import { buttonClassName, cx, EstimateTag, formatMoney } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';
import { LadderSteps } from './LadderProgress';
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
  /** The text action on the left of the footer. Default: skip this step (S8/S9: skip to the forecast). */
  secondary?: ReactNode | null;
  children: ReactNode;
};

const TEXT_ACTION = 'min-h-11 content-center text-base font-semibold text-text hover:text-primary';

/** Link styled as the footer's text action ("← Back", "Skip, use estimates"). */
export function LadderTextLink({ href, label }: LadderLink) {
  return (
    <a href={href} className={TEXT_ACTION}>
      {label}
    </a>
  );
}

/** Button styled as the footer's text action ("Update my guess"). */
export function LadderTextButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(TEXT_ACTION, 'text-left disabled:cursor-default disabled:text-text-muted disabled:hover:text-text-muted')}
    >
      {children}
    </button>
  );
}

/** The step pill a screen sits under: S7 (spending by hand) is the S9 step. */
export function rungOf(screen: LadderScreen): LadderScreen {
  return screen === 'S7' ? 'S9' : screen;
}

function rungHref(progress: LadderProgressVM, screen: LadderScreen): string {
  return progress.rungs.find((r) => r.screen === screen)?.href ?? progress.futureHref;
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
  // S7 (spending by hand) is the by-hand side of the S9 step: same place in the steps.
  const step = rungOf(screen);
  const index = progress.rungs.findIndex((r) => r.screen === step);
  const prev = index > 0 ? progress.rungs[index - 1] : undefined;
  const next = index >= 0 ? progress.rungs[index + 1] : undefined;
  const isLast = !next;

  const defaultPrimary = isLast ? (
    <a href={progress.futureHref} className={buttonClassName({ size: 'lg' })}>
      {t.cta.last}
    </a>
  ) : (
    <a href={next.href} className={buttonClassName({ size: 'lg' })}>
      {t.cta[screen]}
    </a>
  );
  // S9 passes its own (none: its "No statement?" card is the way out by hand).
  const defaultSecondary =
    screen === 'S7' ? (
      <LadderTextLink href={rungHref(progress, 'S9')} label={t.skip.statement} />
    ) : isLast ? (
      <LadderTextLink href={progress.futureHref} label={t.skip.last} />
    ) : (
      <LadderTextLink href={next.href} label={t.skip.step} />
    );
  const primaryNode = primary === undefined ? defaultPrimary : primary;
  const secondaryNode = secondary === undefined ? defaultSecondary : secondary;

  const header = (
    <header className="flex flex-col gap-md">
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

        <footer className="flex flex-col gap-md">
          {isLast && progress.status === 'ready' && (
            <p
              data-testid="ladder-in10y"
              className="flex flex-wrap items-center gap-sm text-base text-text-muted sm:justify-end"
            >
              {t.in10yLabel}
              <span className="font-bold text-text tabular-nums">{formatMoney(progress.in10y.mid)}</span>
              {progress.estimates.left > 0 && <EstimateTag />}
            </p>
          )}
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
        </footer>
      </div>
    </main>
  );
}
