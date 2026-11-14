// "What we keep" (S9): exactly what the app persists from a statement, from the view-model's
// whatWeKeep (CLAUDE.md rule 6; docs/ARCHITECTURE.md → Privacy design). The "what leaves your
// browser" line for statement labels appears only once the in-browser reader is wired
// (`sendsLabels`). The forecast line is always there: S1 and S10 send the profile's numbers to the
// model provider whether or not a statement was uploaded.
import { common, ladder } from '@/copy';
import { Card, Stack } from '@/ui-kit';
import type { StatementUploadVM } from '../model/types';

const t = ladder.upload.keep;

export type WhatWeKeepProps = { keep: StatementUploadVM['whatWeKeep']; sendsLabels: boolean };

export function WhatWeKeep({ keep, sendsLabels }: WhatWeKeepProps) {
  const categories = keep.categories.map((c) => common.categories[c]);
  return (
    <Card title={t.title} tone="muted">
      <Stack gap="md" className="text-sm">
        {keep.months.length === 0 && <p>{t.none}</p>}
        <div>
          <p className="font-medium">{t.onlyThis}</p>
          <ul className="mt-xs list-disc pl-xl">
            <li>{t.months(keep.months)}</li>
            <li>{t.totals(categories)}</li>
            <li>{keep.takeHomePay ? t.payFound : t.pay}</li>
          </ul>
          <p className="mt-xs">{t.where}</p>
          {keep.savedProfileToServer && <p className="mt-xs">{t.server}</p>}
        </div>
        <div>
          <p className="font-medium">{t.neverTitle}</p>
          <ul className="mt-xs list-disc pl-xl">
            {t.never.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {sendsLabels && (
          <p>
            <span className="font-medium">{t.sentTitle}</span> {t.sent}
          </p>
        )}
        <p>{t.forecastSent}</p>
      </Stack>
    </Card>
  );
}
