// "Write your what-if" (/plan): the person types "a kid in 2029 and a move to Denver"; the AI parse route
// (kind 'plan') returns event types, years, labels and a metro; the engine (whatIfEvents) turns them into
// plan events with every number computed in code (defaults, the amounts written, a move's cost-of-living
// change from area data). All events land in the active scenario in one edit, so the chart redraws once;
// `undo` removes exactly those events.
import { areaData } from '@lifeguessr/data/areas';
import { whatIfEvent } from '@lifeguessr/engine';
import type { AreaData, PlanEvent, PlanEventContext, WhatIfItem } from '@lifeguessr/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { plan as copy } from '@/copy';
import { parseWhatIf } from '@/lib/api/aiParse';
import { ApiError } from '@/lib/api/http';
import { getAnonId } from '@/state/anonId';
import { EVENT_ICONS, eventContext, usePlanInputs } from './planEngine';
import { eventSummary, money } from './planFormat';
import { usePlanStore } from './planStore';
import type { WhatIfChipVM, WhatIfStatus, WhatIfVM } from './types';

/** Types whose amount is a default unless the sentence wrote one. */
const AMOUNT_TYPES: readonly WhatIfItem['type'][] = ['income', 'expense', 'buyHome', 'newJob', 'windfall'];

function chipOf(item: WhatIfItem, event: PlanEvent): WhatIfChipVM {
  const t = copy.whatIf;
  const isMove = item.type === 'move';
  const amountText = isMove
    ? event.type === 'expense' ? t.moveMore(money(event.amount)) : event.type === 'income' ? t.moveLess(money(event.monthly)) : ''
    : eventSummary(event);
  const isEstimate = isMove || item.type === 'haveKid' || (AMOUNT_TYPES.includes(item.type) && item.amount === null);
  return {
    id: event.id,
    label: item.label,
    year: event.year,
    icon: isMove ? 'home' : EVENT_ICONS[event.type],
    amountText,
    isEstimate,
    source: t.source,
  };
}

/**
 * Parsed items → plan events (re-id'd with `newId`, unique in the scenario) and their chips; `skipped`
 * counts items the engine could not turn into an event (a move to a metro we have no data for).
 */
export function whatIfPlan(
  items: readonly WhatIfItem[],
  ctx: PlanEventContext,
  areas: readonly AreaData[],
  newId: () => string,
): { events: PlanEvent[]; chips: WhatIfChipVM[]; skipped: number } {
  const events: PlanEvent[] = [];
  const chips: WhatIfChipVM[] = [];
  items.forEach((item, i) => {
    const e = whatIfEvent(item, i, ctx, areas);
    if (!e) return;
    const event = { ...e, id: newId() };
    events.push(event);
    chips.push(chipOf(item, event));
  });
  return { events, chips, skipped: items.length - events.length };
}

/** The inline message for a failed parse. */
export function whatIfErrorMessage(err: unknown): string {
  const e = copy.whatIf.errors;
  if (err instanceof ApiError) {
    if (err.code === 'unavailable' || err.status === 503) return e.unavailable;
    if (err.code === 'nothing_found') return e.nothingFound;
    if (err.status === 429) return e.rateLimited;
  }
  return e.generic;
}

export function useWhatIf(): WhatIfVM {
  const inputs = usePlanInputs();
  const edit = usePlanStore((s) => s.edit);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<WhatIfStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ scenarioId: string; chips: WhatIfChipVM[] } | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const submit = useCallback(() => {
    const sentence = text.trim();
    if (!sentence || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setStatus('loading');
    setError(null);
    void (async () => {
      try {
        const { value } = await parseWhatIf(sentence, { anonId: getAnonId(), signal: controller.signal });
        const { scenarios, activeId } = usePlanStore.getState();
        const active = scenarios.find((s) => s.id === activeId);
        if (!active) throw new Error('No active scenario');
        const { events, chips, skipped } = whatIfPlan(value.items, eventContext(inputs, active), areaData, () => `ev-${crypto.randomUUID()}`);
        if (events.length === 0) {
          setStatus('error');
          setError(skipped > 0 ? copy.whatIf.errors.skipped : copy.whatIf.errors.nothingFound);
          return;
        }
        edit(active.id, (s) => ({ ...s, events: [...s.events, ...events] }));
        setAdded({ scenarioId: active.id, chips });
        setStatus('done');
        setError(skipped > 0 ? copy.whatIf.errors.skipped : null);
        setText('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('error');
        setError(whatIfErrorMessage(err));
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    })();
  }, [text, inputs, edit]);

  const undo = useCallback(() => {
    if (!added) return;
    const ids = new Set(added.chips.map((c) => c.id));
    edit(added.scenarioId, (s) => ({ ...s, events: s.events.filter((e) => !ids.has(e.id)) }));
    setAdded(null);
    setStatus('idle');
    setError(null);
  }, [added, edit]);

  const lastAdded = added?.chips ?? NO_CHIPS;
  return useMemo(
    () => ({ text, setText, status, error, lastAdded, submit, undo }),
    [text, status, error, lastAdded, submit, undo],
  );
}
const NO_CHIPS: WhatIfChipVM[] = [];
