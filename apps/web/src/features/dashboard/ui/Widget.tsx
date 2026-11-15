// The dashboard's building blocks: a widget card (title row, optional selector, body, link to the full
// screen), an empty state (icon, one bold line, one muted line, one button) and the icons they use.
// Presentational only. Card look and the staggered entrance are the shell's global utilities
// (card, card-pad, animate-enter); the chart motion is in app/globals.css (dashboard motion).
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { dashboard as t } from '@/copy';
import { buttonClassName, cx } from '@/ui-kit';

/** next/link or a plain anchor: the route passes it in. */
export type DashLink = ComponentType<{ href: string; className?: string; children?: ReactNode; 'aria-label'?: string }>;

export type IconName = 'plan' | 'wallet' | 'cart' | 'pie' | 'calendar' | 'list' | 'target' | 'duel' | 'check' | 'arrow' | 'spark';

const PATHS: Record<IconName, ReactNode> = {
  plan: <path d="M3 17l5-6 4 3 6-8M14 6h4v4" />,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14.5h2" />
    </>
  ),
  cart: <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01" />,
  pie: <path d="M12 3v9h9A9 9 0 1 1 12 3zM15 3.5A9 9 0 0 1 20.5 9H15z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  duel: <path d="M4 20l7-7M4 4l16 16M20 4l-7 7M14 20l6-6M4 14l6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('size-5 shrink-0', className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

export type WidgetProps = {
  id: string;
  title: string;
  icon: IconName;
  /** Small control on the right of the title row (a period selector). */
  action?: ReactNode;
  /** The full screen: shown as a "See all" link in the title row. */
  link?: { href: string; screen: string };
  Link: DashLink;
  /** Position in the grid, for the staggered fade-in. */
  index: number;
  className?: string;
  children: ReactNode;
};

/** A white widget card: title row (icon, title, selector, link), then the body. */
export function Widget({ id, title, icon, action, link, Link, index, className, children }: WidgetProps) {
  const headingId = `dash-${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`dashboard-${id}`}
      className={cx('card card-pad animate-enter flex min-w-0 flex-col gap-lg', className)}
      style={{ '--enter-delay': `${index * 60}ms` } as CSSProperties}
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-sm">
        <h2 id={headingId} className="flex items-center gap-sm text-lg font-bold leading-tight">
          <span className="grid size-8 place-items-center rounded-md bg-primary-soft text-primary">
            <Icon name={icon} className="size-4" />
          </span>
          {title}
        </h2>
        <div className="flex items-center gap-sm">
          {action}
          {link && (
            <Link
              href={link.href}
              aria-label={t.seeAllLabel(link.screen)}
              className="inline-flex min-h-11 items-center gap-xs rounded-md px-sm text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              {t.seeAll}
              <Icon name="arrow" className="size-4" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  href: string;
  Link: DashLink;
};

/** Small icon, one bold line, one muted line, one button. */
export function EmptyState({ icon, title, body, cta, href, Link }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-sm py-lg text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-strong text-text-muted">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-text-muted">{body}</p>
      <Link href={href} className={cx(buttonClassName({ variant: 'secondary', size: 'sm' }), 'mt-xs min-h-11')}>
        {cta}
      </Link>
    </div>
  );
}

export type SegmentedProps<T extends string> = {
  legend: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
};

/** A small segmented selector for a card's title row (buttons with aria-pressed). */
export function Segmented<T extends string>({ legend, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={legend} className="flex rounded-full bg-surface-strong p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-11 min-w-11 rounded-full px-sm text-xs font-bold tabular-nums transition-colors',
            o.value === value ? 'bg-ink text-on-primary' : 'text-text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
