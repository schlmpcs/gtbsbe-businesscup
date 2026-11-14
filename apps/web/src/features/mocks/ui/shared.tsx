// Pieces S13 and S14 share. Presentational only: props in, events out.
import type { ComponentType, ReactNode } from 'react';
import { forecast, mocks as t } from '@/copy';
import { buttonClassName, cx, formatMoney } from '@/ui-kit';
import type { ForecastPoint, ProPreviewVM, VMError } from '../model/types';

/**
 * The router's link component (next/link), passed in by the route page: ui/ may not import next/*.
 * Any component that renders an <a href> with these props works.
 */
export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

/** The screen heading, intro and the "preview of a Pro feature" note. */
export function ScreenHeader({
  title,
  intro,
  pro,
  Link,
}: {
  title: string;
  intro: string;
  pro: ProPreviewVM;
  Link: LinkComponent;
}) {
  return (
    <header className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-sm">
        <h1 className="text-4xl leading-display sm:text-display">{title}</h1>
        <span className="rounded-full bg-surface-strong px-md py-xs text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t.preview.badge}
        </span>
      </div>
      <p className="text-sm text-text-muted">{intro}</p>
      <div
        role="note"
        data-testid="preview-note"
        className="flex flex-wrap items-center justify-between gap-sm rounded-lg bg-surface p-md text-sm"
      >
        <p>{pro.isPro ? t.preview.proBody : t.preview.body}</p>
        {!pro.isPro && (
          <Link href={pro.href} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
            {t.preview.cta}
          </Link>
        )}
      </div>
    </header>
  );
}

/** Grey placeholder blocks while saved state loads. */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.loading}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={cx('animate-pulse rounded-lg bg-surface', i === 0 ? 'h-3xl' : 'h-2xl')} />
      ))}
    </div>
  );
}

/** A VMError as one sentence. */
export function ErrorNote({ error, className }: { error: VMError; className?: string }) {
  return (
    <p role="alert" className={cx('text-sm text-negative', className)}>
      {error.kind === 'notImplemented' ? t.errors.notImplemented : t.errors.other}
    </p>
  );
}

/** "Likely between $X and $Y" for a forecast point, or nothing when the band is zero. */
export function RangeText({ point, show }: { point: ForecastPoint; show: boolean }) {
  if (!show || point.low === point.high) return null;
  return <p className="text-sm text-text-muted tabular-nums">{forecast.range(formatMoney(point.low), formatMoney(point.high))}</p>;
}
