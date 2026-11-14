// S10 You in 10 years + Next Moves: the range-band forecast, which inputs are estimates, the top 3
// moves (engine rankMoves) and commit / done.
import { applyPatch, hasEstimates } from '@lifeguessr/engine';
import { useMemo, useState } from 'react';
import { runEngine } from '@/lib/model/errors';
import { displayForecast, estimatedFields } from '@/lib/model/profile';
import { useAppReady, useAppStore } from '@/state';
import type { FutureVM } from './types';
import { useNextMoves } from './useNextMoves';

export function useFuture(): FutureVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const committedMove = useAppStore((s) => s.committedMove);
  const [todaysDollars, setTodaysDollars] = useState(true);
  const nextMoves = useNextMoves(profile);

  const result = useMemo(() => runEngine(() => displayForecast(profile, todaysDollars)), [profile, todaysDollars]);

  const committedPreview = useMemo(() => {
    if (!committedMove || profile.committedMoveId !== committedMove.id) return null;
    const preview = runEngine(() => displayForecast(applyPatch(profile, committedMove.patch), todaysDollars));
    return preview.status === 'ready' ? { moveId: committedMove.id, in10y: preview.data.in10y } : null;
  }, [committedMove, profile, todaysDollars]);

  const band = useMemo(
    () => ({ isZero: !hasEstimates(profile), estimatedFields: estimatedFields(profile) }),
    [profile],
  );

  const points = useMemo(() => (result.status === 'ready' ? result.data.points : []), [result]);
  const yearly = useMemo(() => points.filter((p) => p.month % 12 === 0), [points]);
  const empty = { month: 0, low: 0, mid: 0, high: 0 };

  return {
    ...nextMoves,
    status: !ready ? 'loading' : result.status === 'ready' ? 'ready' : 'error',
    error: result.status === 'error' ? result.error : null,
    todaysDollars,
    setTodaysDollars,
    points,
    yearly,
    today: points[0] ?? empty,
    in10y: result.status === 'ready' ? result.data.in10y : empty,
    band,
    committedPreview,
  };
}
