// "← What if?": the link back to the tools hub (/tools) at the top of every tool's page. A route-level
// block so the tool screens themselves stay untouched; `width` matches the screen's own column.
import Link from 'next/link';
import { tools } from '@/copy';

const WIDTH = {
  '7xl': 'max-w-(--container-7xl)',
  '5xl': 'max-w-(--container-5xl)',
  '3xl': 'max-w-(--container-3xl)',
  '2xl': 'max-w-(--container-2xl)',
} as const;

export function BackToTools({ width = '7xl' }: { width?: keyof typeof WIDTH }) {
  return (
    <div className={`mx-auto w-full ${WIDTH[width]} px-lg pt-md`}>
      <Link
        href="/tools"
        aria-label={tools.hub.backLabel}
        data-testid="back-to-tools"
        className="-ml-sm inline-flex min-h-11 items-center gap-xs rounded-full px-sm text-sm font-semibold text-primary hover:bg-primary-soft"
      >
        <span aria-hidden="true">←</span>
        {tools.hub.back}
      </Link>
    </div>
  );
}
