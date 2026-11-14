// Future life events (S10 "Coming up"): calendar-month arithmetic and the schedule simulate() follows.
// Spec: docs/superpowers/specs/2026-11-15-life-events-design.md → Engine.
//
// An event is dated by calendar month ('YYYY-MM') so it does not drift as time passes; `Profile.asOf`
// is the month the profile's "today" values describe (forecast month 0). The engine only ever needs
// whole months from `asOf`: a month at or before it is clamped to 0 (the client folds started events
// into today's values, so this is only a safeguard).
import type { LifeEvent, Profile, YearMonth } from '@lifeguessr/types';

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Months since year 0 of a 'YYYY-MM' month; RangeError for anything else. */
function monthIndex(ym: YearMonth): number {
  const m = YEAR_MONTH.exec(ym);
  if (!m) throw new RangeError(`Invalid month: ${JSON.stringify(ym)} (expected YYYY-MM)`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

/** Whole months from `asOf` to `month` (the 0-based simulation month the event starts at), never below 0. */
export function eventStartMonth(asOf: YearMonth, month: YearMonth): number {
  return Math.max(0, monthIndex(month) - monthIndex(asOf));
}

/** The month `n` months after `ym` (before it when `n` < 0). */
export function addMonths(ym: YearMonth, n: number): YearMonth {
  if (!Number.isInteger(n)) throw new RangeError(`Invalid month count: ${n}`);
  const i = monthIndex(ym) + n;
  const year = Math.floor(i / 12);
  if (year < 0 || year > 9999) throw new RangeError(`Month out of range: ${ym} + ${n}`);
  return `${String(year).padStart(4, '0')}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/**
 * The profile without `events` and `asOf` (a shallow copy; the input is not mutated). For engine calls
 * the server makes on a stored profile (the avatar): those show today's values and never apply events.
 */
export function withoutEvents(p: Profile): Profile {
  const { events: _events, asOf: _asOf, ...rest } = p;
  return rest;
}

/** An event with the simulation month it starts at. */
export type ScheduledEvent = { start: number; event: LifeEvent };

/**
 * The profile's events with their start months, earliest first; events starting in the same month
 * keep their list order, so applying them in this order makes the latest start win and a tie go to
 * the later one in the list. RangeError when there are events but no `asOf`, or a value is invalid.
 */
export function scheduleEvents(p: Profile): ScheduledEvent[] {
  const events = p.events ?? [];
  if (events.length === 0) return [];
  if (p.asOf === undefined) throw new RangeError('Profile.asOf is required when the profile has events');
  const asOf = p.asOf;
  return events
    .map((event) => {
      const value = event.kind === 'pay' ? event.takeHomePay.value : event.kind === 'spending' ? event.monthly.value : event.amount;
      if (!Number.isFinite(value) || value < 0 || (event.kind === 'oneOff' && value === 0)) {
        throw new RangeError(`Invalid ${event.kind} event amount: ${value}`);
      }
      return { start: eventStartMonth(asOf, event.month), event };
    })
    .sort((a, b) => a.start - b.start); // stable: ties keep list order
}
