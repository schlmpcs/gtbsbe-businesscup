// "Why?" on a Next Move: POST /api/ai/explain for one move at the shown horizon, kept per move and
// horizon until the move changes. The server writes the two sentences (or its template fallback); no
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
type Entry = { effect: Money; source: ForecastSource | null; state: Loadable<ExplanationVM> };

/** One entry per move and horizon: asking "Why?" at 3 years keeps the sentence asked at 10. */
const entryKey = (moveId: string, years: HorizonYears): string => `${moveId}@${years}`;

/**
 * Explanations by move id, for the horizon each move is shown at. Entries are kept per move and
 * horizon, so picking another year hides a sentence and picking it back shows it again, with no new
 * request. An entry counts only while the move it was asked for is unchanged (same effect, from the
 * same source): when the profile changes or the model's answer replaces the rules', the move's number
 * changes and the old sentence is about another one.
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
      const id = entryKey(moveId, move.horizonYears);
      controllers.current.get(id)?.abort();
      const controller = new AbortController();
      controllers.current.set(id, controller);
      const key = { effect: move.effect, source: move.source };
      setEntries((e) => ({ ...e, [id]: { ...key, state: { status: 'loading' } } }));
      const input: ExplainInput = { move, horizon: { years: move.horizonYears, effect: move.effect } };
      explain(input, { anonId: getAnonId(), signal: controller.signal }).then(
        (res) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({
            ...e,
            [id]: { ...key, state: { status: 'ready', data: { text: res.text, fromAi: res.source === 'ai' } } },
          }));
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({ ...e, [id]: { ...key, state: { status: 'error', error: toVMError(err) } } }));
        },
      );
    },
    [moves, explain],
  );

  const explanations: Record<string, Loadable<ExplanationVM>> = {};
  for (const m of moves) {
    const entry = entries[entryKey(m.id, m.horizonYears)];
    if (entry && entry.effect === m.effect && entry.source === m.source) {
      explanations[m.id] = entry.state;
    }
  }

  return { explanations, explain: request };
}
