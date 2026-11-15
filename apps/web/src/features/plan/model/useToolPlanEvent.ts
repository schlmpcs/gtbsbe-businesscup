// "Add to my plan" for the What if? tools (/afford, /loan, …): a tool hands over the plan event its
// answer describes (an Expense, one-time or monthly, financed or not); this hook measures it on the
// active scenario with the engine's previewEvent (the plan with the event vs without, the same plan()
// /plan draws) and adds it to that scenario on request, so it shows on /plan's timeline.
//
// The scenarios follow the profile until the person changes one (useScenarios seeds them), so the
// hook seeds first: adding an event before /plan was ever opened must not freeze the demo pair.
import { previewEvent } from '@lifeguessr/engine';
import type { PlanEvent, PlanKpis } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { runEngine } from '@/lib/model/errors';
import type { Loadable } from '@/lib/model/types';
import { calendarOf, NO_MOVES, profileFor, usePlanInputs } from './planEngine';
import { usePlanStore } from './planStore';
import { useScenarios } from './useScenarios';

/** A plan event without what the hook fills in: its id, its year (this plan year) and `enabled`. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type ToolEventDraft = DistributiveOmit<PlanEvent, 'id' | 'year' | 'enabled'>;

/** The event measured on the active scenario (engine previewEvent), in the plan's display unit. */
export type ToolPlanPreview = {
  /** KPIs of the plan without the event and with it. */
  without: PlanKpis;
  withEvent: PlanKpis;
  /** withEvent − without at retirement and at the end of the plan. */
  deltaAtRetirement: number;
  deltaAtEnd: number;
  /** Shortfall age with the event (null = the money lasts), and whether the event brings one on. */
  shortfallAge: number | null;
  causesShortfall: boolean;
  endAge: number;
  display: 'today' | 'future';
};

export type ToolPlanEventVM = {
  /** The active scenario's name ("Baseline"). */
  scenarioName: string;
  /** Null without a draft. */
  preview: Loadable<ToolPlanPreview> | null;
  /** Adds the draft to the active scenario (once per draft); returns the new event's id, or null. */
  add: () => string | null;
  /** The draft on screen is already in the plan (added from here). */
  added: boolean;
  planHref: string;
};

export const PLAN_HREF = '/plan';

export function useToolPlanEvent(draft: ToolEventDraft | null): ToolPlanEventVM {
  useScenarios(); // seeds the scenarios from the profile before anything is added
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId) ?? s.scenarios[0]);
  const moves = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const edit = usePlanStore((s) => s.edit);
  const [added, setAdded] = useState<{ key: string; id: string } | null>(null);

  const key = draft ? JSON.stringify(draft) : null;
  const event: PlanEvent | null = useMemo(() => {
    if (!draft || !scenario) return null;
    const year = calendarOf(inputs.profile, scenario.assumptions.endAge).firstYear;
    return { ...draft, id: 'tool-preview', year, enabled: true } as PlanEvent;
    // `key` stands for the draft's content, so a new object with the same fields does not re-run plan().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scenario, inputs]);

  const addedId = added && added.key === key ? added.id : null;
  const preview = useMemo((): Loadable<ToolPlanPreview> | null => {
    if (!event || !scenario) return null;
    // Once added, measure against the plan without that copy, so the numbers on screen do not double.
    const base = addedId ? { ...scenario, events: scenario.events.filter((e) => e.id !== addedId) } : scenario;
    return runEngine(() => {
      const p = previewEvent(profileFor(inputs, moves), inputs.accounts, base, event, inputs.area);
      return {
        without: p.without,
        withEvent: p.withEvent,
        deltaAtRetirement: p.withEvent.netWorthAtRetirement - p.without.netWorthAtRetirement,
        deltaAtEnd: p.withEvent.netWorthAtEnd - p.without.netWorthAtEnd,
        shortfallAge: p.withEvent.shortfallAge,
        causesShortfall: p.withEvent.shortfallAge !== null && (p.without.shortfallAge === null || p.withEvent.shortfallAge < p.without.shortfallAge),
        endAge: scenario.assumptions.endAge,
        display: scenario.assumptions.display,
      };
    });
  }, [event, scenario, inputs, moves, addedId]);

  const add = useCallback((): string | null => {
    if (!event || !scenario || key === null || added?.key === key) return null;
    const id = `ev-${crypto.randomUUID()}`;
    edit(scenario.id, (s) => ({ ...s, events: [...s.events, { ...event, id }] }));
    setAdded({ key, id });
    return id;
  }, [event, scenario, edit, key, added]);

  return {
    scenarioName: scenario?.name ?? '',
    preview,
    add,
    added: key !== null && added?.key === key,
    planHref: PLAN_HREF,
  };
}
