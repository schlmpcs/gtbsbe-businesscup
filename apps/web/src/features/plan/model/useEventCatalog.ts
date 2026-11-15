// "Add event": the nine event types, and the editor's open/closed state. `add` creates the event with
// the engine's defaults (defaultEvent, MP4: the area's numbers where it has them) and opens it in the
// editor.
import { defaultEvent } from '@lifeguessr/engine';
import { PLAN_EVENT_TYPES, type PlanEventContext, type PlanEventType } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { EVENT_ICONS, SINGLE_EVENT_TYPES } from './planFormat';
import { usePlanInputs, type PlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import type { EventCatalogVM } from './types';

/** Longest event id (PlanEventSchema). */
const ID_MAX_LENGTH = 64;

/** `id`, or `id_2`, `id_3`, …: the first one no event in `taken` has (defaultEvent's ids are `${type}-${year}`). */
export function uniqueEventId(id: string, taken: ReadonlySet<string>): string {
  if (!taken.has(id)) return id;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = id.slice(0, ID_MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/** What defaultEvent and defaultEventSources read for a scenario. */
export const eventContextOf = (inputs: PlanInputs, assumptions: PlanEventContext['assumptions']): PlanEventContext => ({
  profile: inputs.profile, assumptions, asOf: inputs.profile.asOf!, ...(inputs.area ? { area: inputs.area } : {}),
});

export function useEventCatalog(): EventCatalogVM {
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const openEventId = usePlanStore((s) => s.openEventId);
  const edit = usePlanStore((s) => s.edit);
  const setOpenEvent = usePlanStore((s) => s.setOpenEvent);

  const entries = useMemo(
    () =>
      PLAN_EVENT_TYPES.map((type) => ({
        type,
        titleKey: type,
        descriptionKey: type,
        title: copy.events[type].title,
        description: copy.events[type].description,
        icon: EVENT_ICONS[type],
        enabled: !(SINGLE_EVENT_TYPES.includes(type) && (scenario?.events.some((e) => e.type === type) ?? false)),
      })),
    [scenario],
  );

  const add = useCallback(
    (type: PlanEventType): string | null => {
      const { scenarios, activeId } = usePlanStore.getState();
      const active = scenarios.find((s) => s.id === activeId);
      if (!active) return null;
      if (SINGLE_EVENT_TYPES.includes(type) && active.events.some((e) => e.type === type)) return null;
      const made = defaultEvent(type, eventContextOf(inputs, active.assumptions));
      const event = { ...made, id: uniqueEventId(made.id, new Set(active.events.map((e) => e.id))) };
      edit(active.id, (s) => ({ ...s, events: [...s.events, event] }));
      setOpenEvent(event.id);
      track({ name: 'plan_event_added', props: { type } });
      return event.id;
    },
    [inputs, edit, setOpenEvent],
  );

  const openEditor = useCallback((id: string) => setOpenEvent(id), [setOpenEvent]);
  const closeEditor = useCallback(() => setOpenEvent(null), [setOpenEvent]);

  return useMemo(() => ({ entries, add, openEventId, openEditor, closeEditor }), [entries, add, openEventId, openEditor, closeEditor]);
}
