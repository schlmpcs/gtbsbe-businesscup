// "Why?" on a Next Move: POST /api/ai/explain for one move, kept per move until the move changes.
// The server writes the two sentences (or its template fallback); no number comes from the model.
import type { ForecastSource } from '@lifeguessr/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { explainResult, type ExplainInput, type ExplainOptions, type ExplainResult } from '@/lib/api/aiExplain';
import { toVMError } from '@/lib/model/errors';
import { getAnonId } from '@/state/anonId';
import type { ExplanationVM, Loadable } from './types';

/** The explain call (swappable in tests). */
export type ExplainFn = (input: ExplainInput, opts: ExplainOptions) => Promise<ExplainResult>;

type Entry = { effect10y: number; source: ForecastSource | null; state: Loadable<ExplanationVM> };

/** A move with the forecast it was measured by (the VMs of S10 carry it): the server words the sentence by it. */
type ExplainableMove = NonNullable<ExplainInput['move']>;

/**
 * Explanations by move id. An entry counts only while the move it was asked for is unchanged (same
 * effect10y from the same source): when the profile changes, or the model's answer replaces the
 * rules', the move's number changes and the old sentence is about another one.
 */
export function useMoveExplain(moves: readonly ExplainableMove[], explain: ExplainFn = explainResult) {
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
      const { effect10y } = move;
      const source = move.source ?? null;
      setEntries((e) => ({ ...e, [moveId]: { effect10y, source, state: { status: 'loading' } } }));
      explain({ move }, { anonId: getAnonId(), signal: controller.signal }).then(
        (res) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({
            ...e,
            [moveId]: { effect10y, source, state: { status: 'ready', data: { text: res.text, fromAi: res.source === 'ai' } } },
          }));
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setEntries((e) => ({ ...e, [moveId]: { effect10y, source, state: { status: 'error', error: toVMError(err) } } }));
        },
      );
    },
    [moves, explain],
  );

  const explanations: Record<string, Loadable<ExplanationVM>> = {};
  for (const m of moves) {
    const entry = entries[m.id];
    if (entry && entry.effect10y === m.effect10y && entry.source === (m.source ?? null)) explanations[m.id] = entry.state;
  }

  return { explanations, explain: request };
}
