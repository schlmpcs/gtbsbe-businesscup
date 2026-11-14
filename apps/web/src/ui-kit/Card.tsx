import { useId, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Optional heading; when given, the card is labelled by it. */
  title?: ReactNode;
  /** Heading level for `title` (default 2). */
  headingLevel?: 2 | 3 | 4;
  /** Content on the right of the heading row (a tag, a small button). */
  action?: ReactNode;
  /** default = white tile; muted = flat warm fill; arena = orange highlight for the big moments (Figma). */
  tone?: 'default' | 'muted' | 'arena';
  /** Render as another element (default section when titled, else div). */
  as?: ElementType;
  children?: ReactNode;
};

// On the orange arena every text color inside switches to white, so children need no changes.
const TONE = {
  default: 'bg-surface shadow-md',
  muted: 'bg-surface-strong',
  arena:
    'bg-primary text-on-primary shadow-lg [&_.text-text]:text-on-primary [&_.text-text-muted]:text-on-primary/80 [&_.text-positive]:text-on-primary [&_.text-warning]:text-on-primary [&_.text-negative]:text-on-primary',
} as const;

/** A white tile (Figma: rounded 24, soft shadow) that groups related content. */
export function Card({ title, headingLevel = 2, action, tone = 'default', as, className, children, ...rest }: CardProps) {
  const headingId = useId();
  const Tag = as ?? (title ? 'section' : 'div');
  const Heading = `h${headingLevel}` as const;
  return (
    <Tag
      aria-labelledby={title ? headingId : undefined}
      className={cx(
        'rounded-xl p-xl',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-md flex items-start justify-between gap-md">
          {title && (
            <Heading id={headingId} className="text-xl font-bold leading-tight">
              {title}
            </Heading>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
