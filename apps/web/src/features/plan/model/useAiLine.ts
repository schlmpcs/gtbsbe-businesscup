// The dashed "AI estimate" line on the net worth chart. Off: it is not wired to /api/ai/forecast yet.
// That route forecasts a profile with its pay / spending / one-off life events, but not a plan's new
// debts and assets (a home's mortgage and value), so on a scenario with Buy a home or a financed expense
// it would not be a like-for-like second opinion. When it is wired (docs/ENGINEERING.md → AI forecast),
// the line shows only when today's value matches the plan's exactly and every point sits inside the
// Monte Carlo p5–p95 band (monteCarloPercentiles), and it never feeds a KPI.
//
// `preview` renders each state for design and tests; a 'shown' preview draws only the points it is
// given. No fixture path is ever drawn under the "AI estimate" label.
import { useMemo } from 'react';
import { plan as copy } from '@/copy';
import type { AiLineRejectReason, AiLineStatus, AiLineVM } from './types';

export type AiLinePreview = { status: AiLineStatus; reason?: AiLineRejectReason; points?: AiLineVM['points'] };

export function useAiLine(preview?: AiLinePreview): AiLineVM {
  const status = preview?.status ?? 'off';
  const reason = preview?.reason ?? 'outsideBand';
  const points = preview?.points;
  return useMemo((): AiLineVM => {
    const label = copy.aiLine.label;
    switch (status) {
      case 'shown':
        return points && points.length > 0 ? { status, label, points: points.map((p) => ({ ...p })) } : { status: 'off', label };
      case 'rejected':
        return { status, label, reason, reasonMessage: copy.aiLine.rejected[reason] };
      case 'off':
      case 'loading':
        return { status, label };
    }
  }, [status, reason, points]);
}
