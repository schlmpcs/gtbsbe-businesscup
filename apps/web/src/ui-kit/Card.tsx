import { useId, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Optional heading; when given, the card is labelled by it. */
  title?: ReactNode;
  /** Heading level for `title` (default 2). */
  headingLevel?: 2 | 3 | 4;
  /** Content on the right of the heading row (a tag, a small button). */
  action?: ReactNode;
  /** Muted fill instead of the bordered default. */
  tone?: 'default' | 'muted';
  /** Render as another element (default section when titled, else div). */
  as?: ElementType;
  children?: ReactNode;
};

/** A bordered surface that groups related content. */
export function Card({ title, headingLevel = 2, action, tone = 'default', as, className, children, ...rest }: CardProps) {
  const headingId = useId();
  const Tag = as ?? (title ? 'section' : 'div');
  const Heading = `h${headingLevel}` as const;
  return (
    <Tag
      aria-labelledby={title ? headingId : undefined}
      className={cx(
        'rounded-lg p-lg',
        tone === 'muted' ? 'bg-surface' : 'border border-border bg-bg shadow-sm',
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-md flex items-start justify-between gap-md">
          {title && (
            <Heading id={headingId} className="text-lg font-semibold leading-tight">
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
