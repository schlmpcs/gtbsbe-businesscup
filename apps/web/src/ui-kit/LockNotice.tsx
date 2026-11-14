import { buttonClassName } from './Button';
import { cx } from './cx';

export type LockNoticeProps = {
  title: string;
  body: string;
  /** Link text, e.g. "See Pro". */
  ctaLabel: string;
  /** Where the link goes (the paywall). */
  href: string;
  /** Heading level for `title` (default 3: it usually sits inside a screen section). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/** Says an action is locked and links to where it unlocks. Text only: the screen decides what is locked. */
export function LockNotice({ title, body, ctaLabel, href, headingLevel = 3, className }: LockNoticeProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div role="note" className={cx('flex flex-col items-start gap-sm rounded-lg bg-surface p-lg', className)}>
      <Heading className="flex items-center gap-sm text-base font-semibold leading-tight">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 fill-current text-text-muted">
          <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5H6V4.5a2 2 0 1 1 4 0V6Z" />
        </svg>
        {title}
      </Heading>
      <p className="text-sm text-text-muted">{body}</p>
      <a href={href} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
        {ctaLabel}
      </a>
    </div>
  );
}
