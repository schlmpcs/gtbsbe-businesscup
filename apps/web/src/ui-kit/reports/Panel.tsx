// A report card: the shell's `card` look, a title row with an optional subtitle and controls on the
// right (they wrap under the title on a phone), then the content. Labelled by its title.
import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { MOTION } from './tones';

export type PanelProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Selectors or a link on the right of the title. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
  /** Delay of the rise-in, for a stagger down the page. */
  delay?: number;
  className?: string;
  children?: ReactNode;
  'data-testid'?: string;
  'aria-label'?: string;
};

export function Panel({ title, subtitle, action, headingLevel = 2, delay = 0, className, children, ...rest }: PanelProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cx('card card-pad min-w-0', MOTION.rise, className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {(title || action) && (
        <div className="mb-lg flex flex-wrap items-start justify-between gap-md">
          {title && (
            <div className="flex min-w-0 flex-col gap-xs">
              <Heading id={id} className="text-lg font-bold leading-tight">
                {title}
              </Heading>
              {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
            </div>
          )}
          {action && <div className="flex min-w-0 flex-wrap items-center gap-sm">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
