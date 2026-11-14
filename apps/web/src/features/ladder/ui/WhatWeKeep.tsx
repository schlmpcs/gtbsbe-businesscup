// "What we keep" (S9): a one-line gist, with the ✓ kept / ✕ never lists collapsed under it: exactly what the app persists from a statement, from the view-model's
// whatWeKeep (CLAUDE.md rule 6; docs/ARCHITECTURE.md → Privacy design). The "what leaves your
// browser" line appears only once the in-browser reader is wired (`sendsLabels`).
import { common, ladder } from '@/copy';
import { Card, Stack } from '@/ui-kit';
import type { StatementUploadVM } from '../model/types';

const t = ladder.upload.keep;

export type WhatWeKeepProps = { keep: StatementUploadVM['whatWeKeep']; sendsLabels: boolean };

export function WhatWeKeep({ keep, sendsLabels }: WhatWeKeepProps) {
  const categories = keep.categories.map((c) => common.categories[c]);
  const kept = [t.months(keep.months), t.totals(categories), keep.takeHomePay ? t.payFound : t.pay];
  return (
    <Card title={t.title}>
      <Stack gap="sm" className="text-sm">
        <p className="text-text-muted">{keep.months.length === 0 ? t.none : t.gist}</p>
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-text-muted">{t.details}</summary>
          <Stack gap="md" className="mt-sm">
            <div>
              <p className="font-semibold">{t.onlyThis}</p>
              <ul className="mt-xs flex flex-col gap-xs">
                {kept.map((item) => (
                  <li key={item} className="flex gap-sm">
                    <span aria-hidden="true" className="shrink-0 font-bold text-positive">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-xs text-text-muted">{t.where}</p>
              {keep.savedProfileToServer && <p className="mt-xs text-text-muted">{t.server}</p>}
            </div>
            <div>
              <p className="font-semibold">{t.neverTitle}</p>
              <ul className="mt-xs flex flex-col gap-xs">
                {t.never.map((item) => (
                  <li key={item} className="flex gap-sm">
                    <span aria-hidden="true" className="shrink-0 font-bold text-primary">
                      ✕
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {sendsLabels && (
              <p className="rounded-md bg-bg p-md">
                <span className="font-semibold">{t.sentTitle}</span> {t.sent}
              </p>
            )}
          </Stack>
        </details>
      </Stack>
    </Card>
  );
}
