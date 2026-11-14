// Pieces S1 and S10 share. Presentational only: props in, events out.
import type { ComponentType, ReactNode } from 'react';
import { common, forecast as t } from '@/copy';
import { cx, formatMoney, Tag } from '@/ui-kit';
import type { BandKind, EstimatedField, ForecastPoint, ForecastSource, MoveVM, VMError } from '../model/types';

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

/**
 * Paints the element's background out to both screen edges (a full-width band) without widening the
 * page: border-image outset is ink overflow, so it never adds sideways scroll.
 */
export const FULL_BLEED_PRIMARY = 'bg-primary [border-image:conic-gradient(var(--color-primary)_0_0)_fill_0//0_100vmax]';

/** On orange: every text color class inside switches to white (same rule as Card tone="arena"). */
export const ON_ARENA =
  'text-on-primary [&_.text-text]:text-on-primary [&_.text-text-muted]:text-on-primary/80 [&_.text-positive]:text-on-primary [&_.text-negative]:text-on-primary';

/** An ink (near-black) summary band: text turns white, muted text a softer white. */
export const INK_BAND =
  'rounded-xl bg-ink text-on-primary shadow-md [&_.text-text]:text-on-primary [&_.text-text-muted]:text-on-primary/70';

/** A white button for an ink band (the ui-kit variants are made for light surfaces). */
export const ON_INK_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-sm rounded-lg bg-surface px-lg py-sm font-bold text-ink transition-colors hover:bg-primary-soft';

/** Eyebrow label above a big number. */
export const EYEBROW = 'text-xs font-bold uppercase tracking-wide text-text-muted';

/** Decorative tilt (degrees) for tiles, like the Figma screens. */
export function tilt(deg: number) {
  return { transform: `rotate(${deg}deg)` } as const;
}

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

/** Who made a forecast number: "AI estimate" or "Rules-based estimate". Nothing while there is no answer. */
export function SourceTag({ source, className }: { source: ForecastSource | null; className?: string }) {
  if (!source) return null;
  return (
    <Tag data-testid="forecast-source" data-source={source} className={className}>
      {t.source[source]}
    </Tag>
  );
}

/** What the range band means, by where it comes from: its title and the sentence under it. */
export function bandText(kind: BandKind, isZero: boolean): { label: string; text: string } {
  if (kind === 'model') return { label: t.band.model.label, text: isZero ? t.band.model.zero : t.band.model.explain };
  return { label: t.band.label, text: isZero ? t.band.zero : t.band.explain };
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
    <Tag variant="dashed" title={t.how.assumptionHint}>
      {t.how.assumption}
      <span className="sr-only">: {t.how.assumptionHint}</span>
    </Tag>
  );
}

/** A labelled checkbox drawn as an on/off switch (still a native checkbox for keyboards and screen readers). */
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
        className={cx(
          'relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-strong transition-colors checked:bg-positive',
          'before:absolute before:top-1 before:left-1 before:size-5 before:rounded-full before:bg-surface before:shadow-sm before:transition-transform checked:before:translate-x-5',
        )}
      />
      <span>{children}</span>
    </label>
  );
}
