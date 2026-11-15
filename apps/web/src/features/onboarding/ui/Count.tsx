// A counted-up number for the story (the kit's CountUp, which renders the exact final text and only
// animates the display), with the story's classes, a test id and the final text in `data-value`.
import { cx } from '@/ui-kit';
import { CountUp } from '@/ui-kit/reports';

export function Count({
  value,
  format,
  className,
  'data-testid': testId,
}: {
  value: number;
  format: (value: number) => string;
  /** Kept for call sites; the kit's count starts at once. */
  delay?: number;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <span className={cx('tabular-nums', className)} data-testid={testId} data-value={format(value)}>
      <CountUp value={value} format={format} duration={900} />
    </span>
  );
}
