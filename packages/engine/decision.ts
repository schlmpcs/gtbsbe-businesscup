// decisionSweep(): one decision on the plan, measured at every candidate year. The home page's "Life line"
// hero drags "Buy a home" along the years and shows, for the year picked, the whole plan to the end age
// and the Chance of success. Every number is plan() (./plan.ts) and monteCarlo() (./monteCarlo.ts);
// this file only moves the event and collects the results.
//
// 1. eventAtYear(scenario, eventId, year): a copy of the scenario with that event in `year` (an end year
//    that would come before the start moves with it, as on /plan). Retire is refused: its year is the
//    retirement age, an assumption, not an event to drag. Throws a RangeError when the event is missing.
// 2. decisionSweep(profile, accounts, scenario, eventId, years, area, settings?): for each year (in the
//    order given, repeated years once), plan() of eventAtYear(…) and, with Monte Carlo settings (a fixed
//    seed: null is a RangeError), monteCarlo() of it with that seed: successRate and the p10/p90 band per
//    plan year. One seed for every year means every year sees the same draws, so the change in
//    successRate between two years is the decision's.
import type {
  Account, AreaData, DecisionSweepPoint, MonteCarloSettings, PlanEvent, Profile, Scenario,
} from '@lifeguessr/types';
import { monteCarlo } from './monteCarlo';
import { plan } from './plan';

/** Most years one sweep measures (each costs one plan() and, with settings, one monteCarlo()). */
export const DECISION_SWEEP_MAX_YEARS = 25;

/** `scenario` with event `eventId` moved to `year`. See the header. */
export function eventAtYear(scenario: Scenario, eventId: string, year: number): Scenario {
  const event = scenario.events.find((e) => e.id === eventId);
  if (!event) throw new RangeError(`No event ${eventId} in scenario ${scenario.id}`);
  if (event.type === 'retire') throw new RangeError('Retire follows the retirement age; it is not moved by year');
  if (!Number.isInteger(year)) throw new RangeError(`Year must be a whole number, got ${year}`);
  const moved = { ...event, year } as PlanEvent;
  if ('endYear' in moved && moved.endYear !== undefined && moved.endYear <= year) {
    (moved as { endYear: number }).endYear = moved.type === 'careerBreak' ? year + 1 : year;
  }
  return { ...scenario, events: scenario.events.map((e) => (e.id === eventId ? moved : e)) };
}

/** The plan (and, with settings, the Chance of success) with the event at each of `years`. See the header. */
export function decisionSweep(
  profile: Profile,
  accounts: readonly Account[],
  scenario: Scenario,
  eventId: string,
  years: readonly number[],
  area?: AreaData,
  settings?: MonteCarloSettings,
): DecisionSweepPoint[] {
  const unique = [...new Set(years)];
  if (unique.length > DECISION_SWEEP_MAX_YEARS) throw new RangeError(`At most ${DECISION_SWEEP_MAX_YEARS} years per sweep`);
  if (settings && settings.seed === null) throw new RangeError('decisionSweep() needs a fixed seed: every year must see the same draws');
  return unique.map((year) => {
    const s = eventAtYear(scenario, eventId, year);
    const result = plan(profile, accounts, s, area);
    const first = result.years[0]!;
    const point: DecisionSweepPoint = { year, age: first.age + (year - first.year), plan: result };
    if (settings) {
      const mc = monteCarlo(profile, accounts, s, settings, area);
      point.chance = { successRate: mc.successRate, bands: mc.bands.map((b) => ({ year: b.year, p10: b.p10, p90: b.p90 })) };
    }
    return point;
  });
}
