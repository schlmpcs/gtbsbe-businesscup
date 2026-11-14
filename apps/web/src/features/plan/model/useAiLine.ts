// The dashed "AI estimate" line on the net worth chart. Fixture-backed: no fetch. It shows the Monte
// Carlo fixture's median path so the UI can draw the line; MP7b fetches /api/ai/forecast and shows the
// line only when every point sits inside the p5–p95 band and today's value matches exactly. Never used
// for the KPIs. `preview` lets the UI render each state while designing.
import { monteCarloDemo } from '@lifeguessr/data/fixtures/plan';
import { useMemo } from 'react';
import { plan as copy } from '@/copy';
import type { AiLineRejectReason, AiLineStatus, AiLineVM } from './types';

export type AiLinePreview = { status: AiLineStatus; reason?: AiLineRejectReason };

export function useAiLine(preview?: AiLinePreview): AiLineVM {
  const status = preview?.status ?? 'shown';
  const reason = preview?.reason ?? 'outsideBand';
  return useMemo((): AiLineVM => {
    const label = copy.aiLine.label;
    switch (status) {
      case 'shown':
        return { status, label, points: monteCarloDemo.bands.map((b) => ({ year: b.year, netWorth: b.p50 })) };
      case 'rejected':
        return { status, label, reason, reasonMessage: copy.aiLine.rejected[reason] };
      case 'off':
      case 'loading':
        return { status, label };
    }
  }, [status, reason]);
}
