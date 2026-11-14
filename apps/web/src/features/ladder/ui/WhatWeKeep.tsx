// "What we keep" (S9, Design v3): a white card with the one-line gist, then the ✓ kept / ✕ never
// lists in plain view: exactly what the app persists from a statement, from the view-model's
// whatWeKeep (CLAUDE.md rule 6; docs/ARCHITECTURE.md → Privacy design). Where it is stored and what
// leaves the browser sit under "Exactly what we keep". The "what leaves your browser" line for
// statement labels appears only once the in-browser reader is wired (`sendsLabels`). The forecast
// line is always there: S1 and S10 send the profile's numbers to the model provider whether or not
// a statement was uploaded.
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
      <Stack gap="md" className="text-sm">
        <p className="text-text-muted">{keep.months.length === 0 ? t.none : t.gist}</p>
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
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-text-muted">{t.details}</summary>
          <Stack gap="sm" className="mt-sm">
            <p className="text-text-muted">{t.where}</p>
            {keep.savedProfileToServer && <p className="text-text-muted">{t.server}</p>}
            {sendsLabels && (
              <p className="rounded-md bg-bg p-md">
                <span className="font-semibold">{t.sentTitle}</span> {t.sent}
              </p>
            )}
            <p className="rounded-md bg-bg p-md">{t.forecastSent}</p>
            <p className="rounded-md bg-bg p-md">{t.tools}</p>
          </Stack>
        </details>
      </Stack>
    </Card>
  );
}
