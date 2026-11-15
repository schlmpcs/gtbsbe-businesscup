// A small category chip with its color dot (Transactions, Cash flow). The name comes from the copy.
import type { StatementClass } from '@lifeguessr/types';
import { cx } from '../cx';
import { CLASS_TONE, TONE_BG } from './tones';

export function CategoryChip({ category, name, className }: { category: StatementClass; name: string; className?: string }) {
  return (
    <span className={cx('inline-flex max-w-full items-center gap-xs rounded-full bg-surface-strong px-sm py-0.5 text-xs font-medium text-text', className)}>
      <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', TONE_BG[CLASS_TONE[category]])} />
      <span className="truncate">{name}</span>
    </span>
  );
}
