// Pieces S1 and S10 share. Presentational only: props in, events out.
import type { ComponentType, ReactNode } from 'react';
import { common, forecast as t } from '@/copy';
import { cx, formatMoney } from '@/ui-kit';
import type { EstimatedField, ForecastPoint, MoveVM, VMError } from '../model/types';

/**
 * The router's link component (next/link), passed in by the route page: ui/ may not import next/*.
 * Any component that renders an <a href> with these props works.
 */
export type LinkComponent = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
  'data-screen'?: string;
}>;

/** Title of a move from its kind (and category). */
export function moveTitle(move: Pick<MoveVM, 'kind' | 'category'>): string {
  return t.moves.title(move.kind, move.category ? common.categories[move.category] : undefined);
}

/** One-line detail of what a move sets, from the VM's `target`. */
export function moveDetail(move: Pick<MoveVM, 'target'>): string | null {
  const target = move.target;
  if (!target) return null;
  if (target.kind === 'extraPayment') return t.moves.detail.payCardFirst(formatMoney(target.monthly));
  return t.moves.detail.spendingTo(common.categories[target.category], formatMoney(target.monthly));
}

/** "Likely between $X and $Y", or nothing when there is no range. */
export function RangeText({ point, isZero, className }: { point: ForecastPoint; isZero: boolean; className?: string }) {
  if (isZero) return null;
  return (
    <p className={cx('text-sm text-text-muted tabular-nums', className)}>
      {t.range(formatMoney(point.low), formatMoney(point.high))}
    </p>
  );
}

/** Label of an estimated input. */
export function estimatedFieldLabel(f: EstimatedField): string {
  if (f.field === 'spending') return common.categories[f.category];
  return t.band.fields[f.field];
}

/** A VMError as one sentence. */
export function errorText(error: VMError): string {
  return t.errors[error.kind];
}

export function ErrorNote({ error, className }: { error: VMError; className?: string }) {
  return (
    <p role="alert" className={cx('text-sm text-negative', className)}>
      {errorText(error)}
    </p>
  );
}

/** Placeholder blocks while saved state loads. */
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-busy="true" className={cx('flex flex-col gap-sm', className)}>
      <span className="sr-only">{t.loading}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cx('h-xl animate-pulse rounded-md bg-surface-strong', i === 0 ? 'w-1/2' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** A small "our assumption" tag (a default we chose, not a published figure). */
export function AssumptionTag() {
  return (
    <span
      title={t.how.assumptionHint}
      className="inline-flex items-center rounded-full border border-dashed border-text-muted px-sm text-xs font-medium leading-normal text-text-muted"
    >
      {t.how.assumption}
      <span className="sr-only">: {t.how.assumptionHint}</span>
    </span>
  );
}

/** A labelled checkbox used as an on/off switch. */
export function Toggle({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-center gap-sm text-sm', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="size-lg shrink-0 accent-primary"
      />
      <span>{children}</span>
    </label>
  );
}
