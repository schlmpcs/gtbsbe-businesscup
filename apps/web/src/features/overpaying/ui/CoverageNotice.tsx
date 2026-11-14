// Which area the numbers are about: the ZIP's metro, the "we do not cover this ZIP" notice, or the
// "approximate, nearest metro" label when a metro was chosen instead.
import { overpaying as t } from '@/copy';
import { Tag } from '@/ui-kit';
import type { CoverageVM, OverpayingVM } from '../model/types';

export function CoverageNotice({ coverage, counts }: { coverage: CoverageVM; counts: OverpayingVM['coverageCounts'] }) {
  switch (coverage.kind) {
    case 'exact':
      return (
        <p data-testid="coverage" data-coverage="exact" className="text-sm text-text-muted">
          {t.coverage.exact(coverage.zip, coverage.metro)}
        </p>
      );
    case 'metro':
      return (
        <div data-testid="coverage" data-coverage="metro" role="note" className="flex flex-col items-start gap-sm rounded-lg bg-surface p-lg">
          <Tag variant="dashed">{t.coverage.approximate}</Tag>
          <p className="text-sm">{t.coverage.metro(coverage.metro, t.picker.tiers[coverage.tier])}</p>
        </div>
      );
    case 'none':
      return (
        <div data-testid="coverage" data-coverage="none" role="note" className="flex flex-col gap-xs rounded-lg bg-surface p-lg">
          <h2 className="text-base font-semibold leading-tight">{t.coverage.noneTitle}</h2>
          <p className="text-sm text-text-muted">{t.coverage.none(coverage.zip, counts.zips, counts.metros)}</p>
        </div>
      );
    default:
      return null;
  }
}
