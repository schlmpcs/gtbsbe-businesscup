import { common } from '@/copy';
import { cx } from './cx';

/** Marks a value we defaulted (isEstimate: true). The hint explains it on hover and to screen readers. */
export function EstimateTag({ className }: { className?: string }) {
  return (
    <span
      title={common.estimateHint}
      className={cx(
        'inline-flex items-center rounded-full border border-dashed border-text-muted px-sm text-xs font-medium',
        'leading-normal text-text-muted',
        className,
      )}
    >
      {common.estimateTag}
      <span className="sr-only">: {common.estimateHint}</span>
    </span>
  );
}
