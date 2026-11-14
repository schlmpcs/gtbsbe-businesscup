// "Add event": the nine event types, and the editor's open/closed state. `add` creates the event with
// its defaults (fixtureDefaultEvent until MP4's defaultEvent lands) and opens it in the editor.
import { PLAN_EVENT_TYPES, type PlanEventType } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { EVENT_ICONS, FIXTURE_FIRST_YEAR, fixtureDefaultEvent, SINGLE_EVENT_TYPES, yearAtAge } from './fixturePlan';
import { usePlanStore } from './planStore';
import type { EventCatalogVM } from './types';

export function useEventCatalog(): EventCatalogVM {
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
      const id = `ev-${crypto.randomUUID()}`;
      // New events start next year; Retire starts at the retirement age.
      const year = type === 'retire' ? yearAtAge(active.assumptions.retireAge) : FIXTURE_FIRST_YEAR + 1;
      edit(active.id, (s) => ({ ...s, events: [...s.events, fixtureDefaultEvent(type, id, year)] }));
      setOpenEvent(id);
      return id;
    },
    [edit, setOpenEvent],
  );

  const openEditor = useCallback((id: string) => setOpenEvent(id), [setOpenEvent]);
  const closeEditor = useCallback(() => setOpenEvent(null), [setOpenEvent]);

  return useMemo(() => ({ entries, add, openEventId, openEditor, closeEditor }), [entries, add, openEventId, openEditor, closeEditor]);
}
