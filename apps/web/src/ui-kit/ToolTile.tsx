// A large illustrated tile for one "What if?" tool: our 3D art on a soft stage, the question it answers
// as the title, one short line, an optional live teaser (already worded by the caller) and an arrow.
// One look on /tools, the Dashboard's "What if?" row and /plan's "Check a decision". The whole tile is
// the link; it lifts on hover and enters with the global .animate-enter (stagger with `index`).
// Presentational: strings and the href come in, the route's Link comes in.
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Art, type ArtName } from './Art';
import { cx } from './cx';

export type ToolTileTone = 'primary' | 'positive' | 'warm';

export type ToolTileProps = {
  href: string;
  art: ArtName;
  title: string;
  line: string;
  /** A live one-liner (e.g. "Next bill in 6 days"), already formatted. Omitted when there is none. */
  teaser?: string | null;
  /** The stage colour behind the art. */
  tone?: ToolTileTone;
  /** `lg` on the hub, `md` in rows on other screens. */
  size?: 'md' | 'lg';
  /** Position in its grid, for the staggered entrance. */
  index?: number;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
  className?: string;
};

const STAGE: Record<ToolTileTone, string> = {
  primary: 'bg-primary-soft',
  positive: 'bg-positive-soft',
  warm: 'bg-surface-strong',
};

export function ToolTile({ href, art, title, line, teaser, tone = 'warm', size = 'lg', index = 0, Link, className }: ToolTileProps) {
  const lg = size === 'lg';
  return (
    <div className={cx('animate-enter h-full min-w-0', className)} style={{ '--enter-delay': `${index * 60}ms` } as CSSProperties}>
      <Link
        href={href}
        className={cx(
          'card group flex h-full min-w-0 flex-col overflow-hidden',
          'transition-[transform,box-shadow,border-color] duration-200 ease-out',
          'hover:-translate-y-xs hover:border-primary hover:shadow-lg focus-visible:-translate-y-xs',
        )}
      >
        <span aria-hidden="true" className={cx('relative flex items-center justify-center overflow-hidden', STAGE[tone], lg ? 'h-44 sm:h-48' : 'h-32')}>
          {/* A soft disc under the art, so every cutout sits on the same "stage". */}
          <span className={cx('absolute rounded-full bg-surface/60', lg ? 'size-36' : 'size-24')} />
          <Art
            name={art}
            className={cx(
              'relative transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-2',
              lg ? 'w-36 sm:w-40' : 'w-24',
            )}
          />
        </span>
        <span className={cx('flex flex-1 flex-col gap-xs', lg ? 'p-lg sm:p-xl' : 'p-lg')}>
          <span className={cx('font-display font-extrabold leading-tight', lg ? 'text-2xl' : 'text-xl')}>{title}</span>
          <span className="text-sm text-text-muted">{line}</span>
          <span className="mt-auto flex items-center justify-between gap-sm pt-sm">
            {teaser ? (
              <span className="rounded-full bg-primary-soft px-sm py-0.5 text-xs font-bold text-primary tabular-nums">{teaser}</span>
            ) : (
              <span />
            )}
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong text-lg text-text transition-colors group-hover:bg-primary group-hover:text-on-primary"
            >
              →
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}
