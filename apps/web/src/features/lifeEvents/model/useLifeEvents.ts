'use client';

// View-model of the life events timeline (/tools/life-events). Uses the profile in the app store (the
// demo household until the person makes their own) and the real area data; the events live in this
// screen only. Every number comes from the engine via computeLifeEvents().
import { areaData, areaForMetro, coveredMetros } from '@lifeguessr/data/areas';
import type { AreaData, LifeEvent, LifeEventKind, Profile } from '@lifeguessr/types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { profileDemo } from '@/fixtures';
import { areaForZip } from '@/lib/areas';
import { LIFE_EVENT_KINDS, computeLifeEvents, newEvent } from './compute';
import type { LifeEventsVM, MetroOption } from './types';

const YEARS = Array.from({ length: 11 }, (_, i) => i);

/** One area per covered metro for a move: its mid-priced ZIP, else the first one we have. */
function metroOptions(): MetroOption[] {
  return coveredMetros().flatMap(({ metro, tiers }) => {
    const area = areaForMetro(metro, tiers.includes('mid') ? 'mid' : tiers[0]!);
    return area ? [{ zip: area.zip, metro }] : [];
  });
}

/** The area of the person's ZIP; without data for it, the demo household's area (flagged). */
function homeArea(profile: Profile): { home: AreaData; fallback: boolean } {
  const own = areaForZip(profile.zip);
  if (own) return { home: own, fallback: false };
  const demo = areaForZip(profileDemo.zip) ?? areaData[0]!;
  return { home: demo, fallback: true };
}

export function useLifeEvents(profile: Profile, opts: { initialEvents?: LifeEvent[]; currentYear?: number } = {}): LifeEventsVM {
  const [currentYear] = useState(() => opts.currentYear ?? new Date().getFullYear());
  const [events, setEvents] = useState<LifeEvent[]>(() => opts.initialEvents ?? []);
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nextId = useRef(opts.initialEvents?.length ?? 0);

  const metros = useMemo(() => metroOptions(), []);
  const { home, fallback } = useMemo(() => homeArea(profile), [profile]);

  const computed = useMemo(
    () => computeLifeEvents({ profile, events, edited, home, areas: areaData, currentYear }),
    [profile, events, edited, home, currentYear],
  );

  const add = useCallback(
    (kind: LifeEventKind) => {
      nextId.current += 1;
      const e = newEvent(kind, `event-${nextId.current}`, metros, home.metro);
      setEvents((list) => [...list, e]);
      setSelectedId(e.id);
    },
    [metros, home.metro],
  );
  const remove = useCallback((id: string) => {
    setEvents((list) => list.filter((e) => e.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);
  const setYear = useCallback((id: string, startYear: number) => {
    const year = Math.min(10, Math.max(0, Math.round(startYear)));
    setEvents((list) => list.map((e) => (e.id === id && e.startYear !== year ? { ...e, startYear: year } : e)));
  }, []);
  const update = useCallback((next: LifeEvent) => {
    setEvents((list) => list.map((e) => (e.id === next.id && e.kind === next.kind ? next : e)));
    setEdited((s) => (s.has(next.id) ? s : new Set([...s, next.id])));
  }, []);

  return {
    currentYear,
    years: YEARS,
    kinds: LIFE_EVENT_KINDS,
    events: computed.events,
    selectedId,
    select: setSelectedId,
    add,
    remove,
    setYear,
    update,
    metros,
    homeMetro: home.metro,
    homeIsFallback: fallback,
    result: computed.result,
  };
}
