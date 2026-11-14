// Pieces the preview screens share. Presentational only: props in, events out.
import type { ReactNode } from 'react';
import { previewA as t } from '@/copy';
import { cx, formatRate } from '@/ui-kit';

/** Top banner on every /preview/* page: these numbers are samples, and the page is not in the app. */
export function PreviewBanner() {
  return (
    <div className="mx-auto w-full max-w-(--container-7xl) px-lg pt-md">
      <p
        role="note"
        aria-label={t.banner.label}
        data-testid="preview-banner"
        className="rounded-xl border-2 border-dashed border-text-muted bg-surface-strong px-lg py-sm text-center text-sm font-semibold"
      >
        {t.banner.text}
      </p>
    </div>
  );
}

/** Page frame: a centered column with the same paddings as the app's screens. */
export function PreviewMain({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main
      className={cx(
        'mx-auto flex w-full flex-col gap-xl px-lg py-xl',
        narrow ? 'max-w-(--container-2xl)' : 'max-w-(--container-4xl)',
      )}
    >
      {children}
    </main>
  );
}

export type PillTone = 'ink' | 'soft' | 'outline' | 'positive';

const PILL: Record<PillTone, string> = {
  ink: 'bg-ink text-on-primary',
  soft: 'bg-primary-soft text-primary',
  outline: 'border border-dashed border-text-muted text-text-muted',
  positive: 'bg-positive-soft text-positive',
};

/** A small sentence-case pill (the app's Sticker is all caps; previews keep labels in normal case). */
export function Pill({ children, tone = 'soft', className }: { children: ReactNode; tone?: PillTone; className?: string }) {
  return (
    <span className={cx('inline-flex w-fit items-center gap-xs rounded-full px-md py-xs text-xs font-bold', PILL[tone], className)}>
      {children}
    </span>
  );
}

/** Title block: optional pill, a display h1, a muted intro. */
export function PreviewHeader({ title, eyebrow, intro }: { title: ReactNode; eyebrow?: ReactNode; intro?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-col gap-md">
      {eyebrow && <Pill tone="ink">{eyebrow}</Pill>}
      <h1 className="text-4xl leading-display sm:text-display">{title}</h1>
      {intro && <p className="max-w-prose text-lg text-text-muted">{intro}</p>}
    </header>
  );
}

/** A row of toggle buttons that switches the preview between the screen's states (for the team). */
export function PreviewStates<Id extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <div role="group" aria-label={t.states.label} className="flex flex-wrap items-center gap-sm text-sm">
      <span className="text-text-muted">{t.states.label}:</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded-full border px-md py-xs font-semibold transition-colors',
            o.id === value ? 'border-ink bg-ink text-on-primary' : 'border-border bg-surface text-text hover:bg-surface-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled progress bar (share is a decimal, 0.35 = 35%). */
export function ProgressBar({ share, label, tone = 'positive' }: { share: number; label: string; tone?: 'positive' | 'primary' }) {
  const pct = Math.min(100, Math.max(0, share * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={formatRate(share, 0)}
      className="h-md w-full overflow-hidden rounded-full bg-surface-strong"
    >
      <div className={cx('h-full rounded-full', tone === 'positive' ? 'bg-positive' : 'bg-primary')} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A polite status line that says a preview button did nothing real. */
export function PreviewStatus({ children }: { children?: ReactNode }) {
  return (
    <p role="status" className="min-h-lg text-sm text-text-muted">
      {children}
    </p>
  );
}
