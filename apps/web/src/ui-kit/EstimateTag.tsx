import { common } from '@/copy';
import { Tag } from './Tag';

/** Marks a value we defaulted (isEstimate: true). The hint explains it on hover and to screen readers. */
export function EstimateTag({ className }: { className?: string }) {
  return (
    <Tag variant="dashed" title={common.estimateHint} className={className}>
      {common.estimateTag}
      <span className="sr-only">: {common.estimateHint}</span>
    </Tag>
  );
}
