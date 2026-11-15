// "Add event": the nine event types, and the editor's open/closed state. `add` creates the event with
// the engine's defaultEvent on the person's profile and area (next year; Retire at the retirement age,
// Social Security at 67) and opens it in the editor.
import { defaultEvent } from '@lifeguessr/engine';
import { PLAN_EVENT_TYPES, type PlanEvent, type PlanEventType } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { EVENT_ICONS, eventContext, SINGLE_EVENT_TYPES, usePlanInputs } from './planEngine';
import { usePlanStore } from './planStore';
import type { EventCatalogVM } from './types';

export function useEventCatalog(): EventCatalogVM {
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const openEventId = usePlanStore((s) => s.openEventId);
  const edit = usePlanStore((s) => s.edit);
  const setOpenEvent = usePlanStore((s) => s.setOpenEvent);
  const inputs = usePlanInputs();

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
      const id = `ev-${crypto.randomUUID()}`;
      const event: PlanEvent = { ...defaultEvent(type, eventContext(inputs, active)), id };
      edit(active.id, (s) => ({ ...s, events: [...s.events, event] }));
      setOpenEvent(id);
      return id;
    },
    [edit, setOpenEvent, inputs],
  );

  const openEditor = useCallback((id: string) => setOpenEvent(id), [setOpenEvent]);
  const closeEditor = useCallback(() => setOpenEvent(null), [setOpenEvent]);

  return useMemo(() => ({ entries, add, openEventId, openEditor, closeEditor }), [entries, add, openEventId, openEditor, closeEditor]);
}
