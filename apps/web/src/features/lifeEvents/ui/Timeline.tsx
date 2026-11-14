'use client';

// The 10-year track: Now → +10 years, one chip per event at its year. A chip is a button: tap to
// select it, drag it along the track, or use the arrow keys to move it a year. The year select in the
// editor does the same for anyone who prefers a form.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { lifeEvents as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { LifeEventVM, LifeEventsVM } from '../model/types';

/** Short chip text: the kind, or for a move the city part of the metro. */
export function chipText(e: LifeEventVM): string {
  if (e.kind === 'move') return t.chip.move((e.toMetro ?? '').split(',')[0] ?? '');
  return t.chip[e.kind];
}

/** Events in rows so chips in the same year stack instead of covering each other. */
function rowsOf(events: readonly LifeEventVM[]): LifeEventVM[][] {
  const rows: LifeEventVM[][] = [];
  const perYear = new Map<number, number>();
  for (const e of events) {
    const r = perYear.get(e.startYear) ?? 0;
    perYear.set(e.startYear, r + 1);
    (rows[r] ??= []).push(e);
  }
  return rows;
}

export function Timeline({ vm }: { vm: LifeEventsVM }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; pointerId: number } | null>(null);
  const last = vm.years[vm.years.length - 1] ?? 10;

  const yearAt = (clientX: number): number | null => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return null;
    return Math.round(((clientX - box.left) / box.width) * last);
  };
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    drag.current = { id, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const year = yearAt(e.clientX);
    if (year !== null) vm.setYear(drag.current.id, year);
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, ev: LifeEventVM) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      vm.setYear(ev.id, ev.startYear + (e.key === 'ArrowRight' ? 1 : -1));
    }
  };

  return (
    <section aria-label={t.timeline.label} className="rounded-xl bg-surface p-lg shadow-md sm:p-xl" data-testid="life-timeline">
      <h2 className="mb-md text-xl font-bold">{t.timeline.label}</h2>
      <div ref={track} className="relative">
        {vm.events.length === 0 && <p className="py-md text-text-muted">{t.timeline.empty}</p>}
        {rowsOf(vm.events).map((row, r) => (
          <div key={r} className="relative h-3xl">
            {row.map((e) => {
              const selected = e.id === vm.selectedId;
              const share = e.startYear / last;
              return (
                <button
                  key={e.id}
                  type="button"
                  data-testid="life-chip"
                  data-kind={e.kind}
                  aria-pressed={selected}
                  aria-label={t.timeline.chipLabel(chipText(e), e.calendarYear)}
                  onClick={() => vm.select(selected ? null : e.id)}
                  onPointerDown={(p) => onPointerDown(p, e.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(k) => onKeyDown(k, e)}
                  // Position on the track: the chip's own anchor slides from its left edge (Now) to its right edge (+10).
                  style={{ left: `${share * 100}%`, transform: `translateX(-${share * 100}%)` }}
                  className={cx(
                    'absolute top-xs max-w-32 touch-none select-none truncate rounded-full border-2 px-md py-xs text-sm font-bold shadow-sm',
                    selected ? 'z-10 border-ink bg-ink text-on-primary' : 'border-primary bg-primary-soft text-text',
                  )}
                >
                  {chipText(e)}
                </button>
              );
            })}
          </div>
        ))}
        <div aria-hidden="true" className="mt-sm h-xs rounded-full bg-border" />
        <ol aria-hidden="true" className="mt-xs flex justify-between text-xs text-text-muted">
          {vm.years.map((y) => (
            <li key={y} className="tabular-nums">
              {t.timeline.yearTick(y)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
