// "What it does to your plan" for the overpaying check: each line above its typical range as one Next Move
// (pay the range's middle instead: the engine's overpayingPatch, the same change its 10-year effect uses),
// measured on the active /plan scenario by plan() with and without it, and added to it from the row.
//
// The patch lowers the plan profile's own category (rent + utilities, car, groceries, childcare) by what you
// pay above the middle; a line the profile cannot absorb (it holds less than that) has no move.
import { overpayingPatch, OVERPAYING_CATEGORIES, type MoveCandidate } from '@lifeguessr/engine';
import type { Move, Profile } from '@lifeguessr/types';
import { useMemo } from 'react';
import { usePlanImpacts } from '@/features/subscriptions/model/usePlanImpact';
import { track as defaultTrack } from '@/lib/events';
import { useProfile } from '@/state/profile';
import type { BenchmarkLine, BenchmarkRowVM, Loadable, OverpayingResultVM, PlanImpactVM } from './types';

export const overpayingMoveId = (line: BenchmarkLine): string => `cutCategory:overpaying-${line}`;

/** One move per line above its range that the profile can absorb, in the rows' order. */
export function overpayingCandidates(rows: readonly BenchmarkRowVM[], profile: Pick<Profile, 'spending'>): MoveCandidate[] {
  const out: MoveCandidate[] = [];
  for (const r of rows) {
    const patch = overpayingPatch({ line: r.line, yours: r.yours, typical: r.typical, position: r.position }, profile);
    if (!patch) continue;
    out.push({ id: overpayingMoveId(r.line), kind: 'cutCategory', level: 1, category: OVERPAYING_CATEGORIES[r.line], patch });
  }
  return out;
}

/** Each above-range line's impact on the plan, by line (lines with no move are absent). */
export function useOverpayingImpacts(result: Loadable<OverpayingResultVM> | null): Partial<Record<BenchmarkLine, PlanImpactVM>> {
  const profile = useProfile();
  const rows = result?.status === 'ready' ? result.data.rows : null;
  const candidates = useMemo(() => (rows ? overpayingCandidates(rows, profile) : []), [rows, profile]);
  const impacts = usePlanImpacts(candidates, { onAdded: onAddedTrack });
  return useMemo(() => {
    const out: Partial<Record<BenchmarkLine, PlanImpactVM>> = {};
    candidates.forEach((c, i) => {
      const line = c.id.slice('cutCategory:overpaying-'.length) as BenchmarkLine;
      out[line] = impacts[i] ?? { status: 'none' };
    });
    return out;
  }, [candidates, impacts]);
}

const onAddedTrack = (move: Move) => defaultTrack({ name: 'move_committed', props: { kind: move.kind } });
