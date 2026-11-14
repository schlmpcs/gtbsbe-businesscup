'use client';

import { loan as t } from '@/copy';
import { Card, EstimateTag, formatRate, Gauge } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';

/** Debt load today and with the selected offer, on the same dial and thresholds. */
export function DebtLoadGauges({ gauge, selectedName }: { gauge: LoanLabVM['gauge']; selectedName: string | null }) {
  const { before, after, max, isEstimate } = gauge;
  const zoneLabels = t.gauge.zones;
  return (
    <Card title={t.gauge.title} action={isEstimate ? <EstimateTag /> : undefined}>
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        <Gauge
          label={t.gauge.before}
          value={before.value}
          thresholds={before.thresholds}
          max={max}
          formatValue={(v) => formatRate(v)}
          zoneLabels={zoneLabels}
        />
        {after && selectedName ? (
          <Gauge
            label={t.gauge.after(selectedName)}
            value={after.value}
            thresholds={after.thresholds}
            max={max}
            formatValue={(v) => formatRate(v)}
            zoneLabels={zoneLabels}
          />
        ) : (
          <p className="self-center text-sm text-text-muted">{t.gauge.noOffer}</p>
        )}
      </div>
      <p className="mt-md text-xs text-text-muted">
        {t.gauge.hint} {t.gauge.guidance(formatRate(before.thresholds.yellow), formatRate(before.thresholds.red))}
      </p>
    </Card>
  );
}
