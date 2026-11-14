// Pieces S13 and S14 share. Presentational only: props in, events out.
import type { ComponentType, ReactNode } from 'react';
import { mocks as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { VMError } from '../model/types';

/**
 * The router's link component (next/link), passed in by the route page: ui/ may not import next/*.
 * Any component that renders an <a href> with these props works.
 */
export type LinkComponent = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

/** Grey placeholder blocks while saved state loads. */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.loading}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={cx('animate-pulse rounded-xl bg-surface', i === 0 ? 'h-3xl' : 'h-2xl')} />
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
