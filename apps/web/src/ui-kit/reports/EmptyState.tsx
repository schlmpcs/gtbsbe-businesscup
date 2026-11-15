// The report screens' empty state: a small piece of house art, one bold line, one muted line, the
// actions, over an optional ghosted preview of the chart that will be there (decorative, no numbers).
import type { ReactNode } from 'react';
import { Art, type ArtName } from '../Art';
import { cx } from '../cx';
import { MOTION } from './tones';

export type EmptyStateProps = {
  title: ReactNode;
  body?: ReactNode;
  art?: ArtName;
  /** Buttons or links. */
  actions?: ReactNode;
  /** A faded chart shape behind the message (aria-hidden). */
  ghost?: ReactNode;
  /** Heading level of `title` (default 2). */
  headingLevel?: 2 | 3;
  className?: string;
  'data-testid'?: string;
};

export function EmptyState({ title, body, art, actions, ghost, headingLevel = 2, className, ...rest }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={cx('relative isolate overflow-hidden rounded-xl bg-surface p-xl shadow-md sm:p-2xl', MOTION.rise, className)} {...rest}>
      {ghost && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center p-lg opacity-[0.14] grayscale-[0.3]">
          {ghost}
        </div>
      )}
      <div className="mx-auto flex max-w-md flex-col items-center gap-md text-center">
        {art && <Art name={art} className="w-28 sm:w-32" loading="eager" />}
        <Heading className="font-display text-2xl font-extrabold leading-tight">{title}</Heading>
        {body && <p className="text-text-muted">{body}</p>}
        {actions && <div className="mt-sm flex flex-wrap justify-center gap-sm">{actions}</div>}
      </div>
    </section>
  );
}
