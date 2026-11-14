import type { ReactNode } from 'react';
import { cx } from './cx';
import { Sticker } from './Sticker';

export type PageHeaderProps = {
  title: ReactNode;
  /** Small dark pill above the title ("STEP 2 OF 5", "DAY 12"). */
  eyebrow?: ReactNode;
  intro?: ReactNode;
  align?: 'start' | 'center';
  /** Extra content on the right of the title on wide screens (an illustration, a toggle). */
  aside?: ReactNode;
  className?: string;
};

/** Page title block from the Figma screens: optional eyebrow pill, a big display h1, a muted intro. */
export function PageHeader({ title, eyebrow, intro, align = 'start', aside, className }: PageHeaderProps) {
  const center = align === 'center';
  return (
    <header className={cx('flex flex-col gap-lg sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className={cx('flex min-w-0 flex-col gap-md', center && 'items-center text-center sm:mx-auto')}>
        {eyebrow && <Sticker tone="ink">{eyebrow}</Sticker>}
        <h1 className="text-4xl leading-display sm:text-display">{title}</h1>
        {intro && <p className="max-w-prose text-lg text-text-muted">{intro}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
