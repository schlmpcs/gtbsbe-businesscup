// "Why?" on a Next Move: POST /api/ai/explain for one move at the shown horizon, kept per move until
// the move or the horizon changes. The server writes the two sentences (or its template fallback); no
// number comes from the model.
import type { ForecastSource, HorizonYears, Money } from '@lifeguessr/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { explainResult, type ExplainInput, type ExplainOptions, type ExplainResult } from '@/lib/api/aiExplain';
import { toVMError } from '@/lib/model/errors';
import { getAnonId } from '@/state/anonId';
import type { ExplanationVM, Loadable, MoveVM } from './types';

/** The explain call (swappable in tests). */
export type ExplainFn = (input: ExplainInput, opts: ExplainOptions) => Promise<ExplainResult>;

/** What an explanation was asked for: the move's effect at that year, from that source. */
type Entry = { effect: Money; source: ForecastSource | null; horizonYears: HorizonYears; state: Loadable<ExplanationVM> };

/**
 * Explanations by move id. An entry counts only while the move it was asked for is unchanged (same
 * effect, from the same source, at the same horizon): when the profile changes, the model's answer
 * replaces the rules', or another year is picked, the move's number changes and the old sentence is
 * about another one. Picking the year back shows it again.
 */
export function useMoveExplain(moves: readonly MoveVM[], explain: ExplainFn = explainResult) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const request = useCallback(
    (moveId: string) => {
      const move = moves.find((m) => m.id === moveId);
      if (!move) return;
      controllers.current.get(moveId)?.abort();
      const controller = new AbortController();
      controllers.current.set(moveId, controller);
      const key = { effect: move.effect, source: move.source, horizonYears: move.horizonYears };
      setEntries((e) => ({ ...e, [moveId]: { ...key, state: { status: 'loading' } } }));
      const input: ExplainInput = { move, horizon: { years: move.horizonYears, effect: move.effect } };
      explain(input, { anonId: getAnonId(), signal: controller.signal }).then(
        (res) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({
            ...e,
            [moveId]: { ...key, state: { status: 'ready', data: { text: res.text, fromAi: res.source === 'ai' } } },
          }));
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({ ...e, [moveId]: { ...key, state: { status: 'error', error: toVMError(err) } } }));
        },
      );
    },
    [moves, explain],
  );

  const explanations: Record<string, Loadable<ExplanationVM>> = {};
  for (const m of moves) {
    const entry = entries[m.id];
    if (entry && entry.effect === m.effect && entry.source === m.source && entry.horizonYears === m.horizonYears) {
      explanations[m.id] = entry.state;
    }
  }

  return { explanations, explain: request };
}
